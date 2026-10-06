"""
ClearReq AI backend.

Every data endpoint requires a logged-in user and checks that the session /
requirement being touched belongs to that user. FastAPI also serves the
frontend, so deployment is a single service.
"""
import io
import os
from datetime import datetime

from docx import Document
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import case, func
from sqlalchemy.orm import Session as DBSession

from . import ai_provider, models, rule_detector
from .auth import get_current_user
from .database import engine, get_db, migrate_legacy_user_auth
from .schemas import (
    ApproveIn, DiscoverySubmit, RequirementEdit, RequirementIn, SessionIn,
    TranslateRequest,
)

models.Base.metadata.create_all(bind=engine)
migrate_legacy_user_auth()

app = FastAPI(title="ClearReq AI")

_origins = [o.strip() for o in os.getenv(
    "ALLOWED_ORIGINS",
    "http://127.0.0.1:8000,http://localhost:8000,http://127.0.0.1:5500,http://localhost:5500",
).split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=_origins, allow_methods=["*"], allow_headers=["*"])

DAILY_ANALYZE_LIMIT = int(os.getenv("DAILY_ANALYZE_LIMIT", "40"))
_usage: dict[int, tuple[str, int]] = {}  # in-memory; resets on restart (see DEPLOY.md)


# ---------- helpers ----------

def _check_rate_limit(user: models.User) -> None:
    today = datetime.utcnow().strftime("%Y-%m-%d")
    day, count = _usage.get(user.id, (today, 0))
    if day != today:
        count = 0
    if count >= DAILY_ANALYZE_LIMIT:
        raise HTTPException(429, f"Daily limit of {DAILY_ANALYZE_LIMIT} analyses reached. Try again tomorrow.")
    _usage[user.id] = (today, count + 1)


def _owned_session(db: DBSession, session_id: int, user: models.User):
    session = db.get(models.Session, session_id)
    project = db.get(models.Project, session.project_id) if session else None
    if not session or not project or project.user_id != user.id:
        raise HTTPException(404, "Session not found")
    return session, project


def _owned_requirement(db: DBSession, requirement_id: int, user: models.User):
    req = db.get(models.Requirement, requirement_id)
    if not req:
        raise HTTPException(404, "Requirement not found")
    session, project = _owned_session(db, req.session_id, user)
    return req, session, project


def _latest_version(db: DBSession, requirement_id: int):
    return (
        db.query(models.RequirementVersion)
        .filter(models.RequirementVersion.requirement_id == requirement_id)
        .order_by(models.RequirementVersion.version_number.desc())
        .first()
    )


def _classify_fr_nfr(category: str) -> str:
    """Heuristic: performance/security/UX clarifications imply a quality (non-functional) requirement."""
    return "Non-Functional" if category in ("performance", "security", "UX") else "Functional"


def _requirement_view(db: DBSession, req: models.Requirement) -> dict:
    latest = _latest_version(db, req.id)
    ambiguities = db.query(models.Ambiguity).filter(models.Ambiguity.requirement_id == req.id).all()
    counts: dict[str, int] = {}
    times = []
    for a in ambiguities:
        if a.category != "conflict":
            counts[a.category] = counts.get(a.category, 0) + 1
        if a.clarification and a.clarification.answered_at:
            times.append(a.clarification.answered_at)
    category = max(counts, key=counts.get) if counts else "general"

    approved_by = None
    if latest and req.status == "approved":
        ap = (
            db.query(models.Approval)
            .filter(models.Approval.requirement_version_id == latest.id)
            .order_by(models.Approval.id.desc())
            .first()
        )
        approved_by = ap.approved_by if ap else None

    return {
        "requirement_id": req.id,
        "original_text": req.original_text,
        "status": req.status,
        "translated_text": latest.translated_text if latest else None,
        "confidence_score": latest.confidence_score if latest else None,
        "category": category,
        "req_type": _classify_fr_nfr(category),
        "clarified_at": max(times).isoformat() if times else None,
        "approved_by": approved_by,
        "ambiguities": [
            {
                "term": ambiguity.term,
                "category": ambiguity.category,
                "detector": ambiguity.detector,
                "confidence": ambiguity.confidence,
                "question": ambiguity.clarification.question if ambiguity.clarification else None,
                "answer": ambiguity.clarification.answer if ambiguity.clarification else None,
                "answered_at": ambiguity.clarification.answered_at.isoformat()
                if ambiguity.clarification and ambiguity.clarification.answered_at else None,
            }
            for ambiguity in ambiguities
        ],
    }


def _merge_ambiguities(rule_results: list[dict], ai_results: list[dict]) -> list[dict]:
    by_term = {r["term"].lower(): r for r in rule_results}
    for r in ai_results:
        by_term.setdefault(r["term"].lower(), r)
    return list(by_term.values())


def _find_previous_answer(db: DBSession, session_id: int, exclude_requirement_id: int, term: str):
    row = (
        db.query(models.Clarification)
        .join(models.Ambiguity, models.Clarification.ambiguity_id == models.Ambiguity.id)
        .join(models.Requirement, models.Ambiguity.requirement_id == models.Requirement.id)
        .filter(models.Requirement.session_id == session_id)
        .filter(models.Requirement.id != exclude_requirement_id)
        .filter(models.Ambiguity.term.ilike(term))
        .filter(models.Clarification.answer.isnot(None))
        .order_by(models.Clarification.answered_at.desc())
        .first()
    )
    return row.answer if row else None


def _delete_session_cascade(db: DBSession, session: models.Session, project: models.Project) -> None:
    for req in db.query(models.Requirement).filter(models.Requirement.session_id == session.id).all():
        amb_ids = [i for (i,) in db.query(models.Ambiguity.id).filter(models.Ambiguity.requirement_id == req.id)]
        if amb_ids:
            db.query(models.Clarification).filter(models.Clarification.ambiguity_id.in_(amb_ids)).delete(synchronize_session=False)
        db.query(models.Ambiguity).filter(models.Ambiguity.requirement_id == req.id).delete(synchronize_session=False)
        ver_ids = [i for (i,) in db.query(models.RequirementVersion.id).filter(models.RequirementVersion.requirement_id == req.id)]
        if ver_ids:
            db.query(models.Approval).filter(models.Approval.requirement_version_id.in_(ver_ids)).delete(synchronize_session=False)
        db.query(models.RequirementVersion).filter(models.RequirementVersion.requirement_id == req.id).delete(synchronize_session=False)
        db.delete(req)
    db.query(models.DiscoveryAnswer).filter(models.DiscoveryAnswer.session_id == session.id).delete(synchronize_session=False)
    db.delete(session)
    db.flush()
    if db.query(models.Session).filter(models.Session.project_id == project.id).count() == 0:
        db.delete(project)
    db.commit()


# ---------- health + auth configuration ----------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/public-config")
def public_config():
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    anon_key = os.getenv("SUPABASE_ANON_KEY", "").strip()
    if not supabase_url or not anon_key:
        raise HTTPException(503, "Supabase authentication is not configured.")
    return {"supabase_url": supabase_url, "supabase_anon_key": anon_key}


# ---------- sessions (sidebar) ----------

@app.post("/sessions")
def start_session(payload: SessionIn, db: DBSession = Depends(get_db), user: models.User = Depends(get_current_user)):
    project = models.Project(name=payload.project_name, client_name=payload.client_name, user_id=user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    session = models.Session(project_id=project.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"session_id": session.id, "project_id": project.id, "project_name": project.name}


@app.get("/sessions")
def list_sessions(db: DBSession = Depends(get_db), user: models.User = Depends(get_current_user)):
    rows = (
        db.query(models.Session, models.Project)
        .join(models.Project, models.Session.project_id == models.Project.id)
        .filter(models.Project.user_id == user.id)
        .order_by(models.Session.started_at.desc())
        .all()
    )
    stats: dict[int, tuple[int, int]] = {}
    ids = [s.id for s, _ in rows]
    if ids:
        done = case((models.Requirement.status.in_(["translated", "approved"]), 1), else_=0)
        for sid, total, finished in (
            db.query(models.Requirement.session_id, func.count(models.Requirement.id), func.sum(done))
            .filter(models.Requirement.session_id.in_(ids))
            .group_by(models.Requirement.session_id)
            .all()
        ):
            stats[sid] = (int(total), int(finished or 0))
    return [
        {
            "session_id": s.id,
            "project_name": p.name,
            "started_at": s.started_at.isoformat(),
            "requirement_count": stats.get(s.id, (0, 0))[0],
            "translated_count": stats.get(s.id, (0, 0))[1],
        }
        for s, p in rows
    ]


@app.patch("/sessions/{session_id}")
def rename_session(session_id: int, payload: SessionIn, db: DBSession = Depends(get_db), user: models.User = Depends(get_current_user)):
    _, project = _owned_session(db, session_id, user)
    project.name = payload.project_name
    db.commit()
    return {"session_id": session_id, "project_name": project.name}


@app.delete("/sessions/{session_id}")
def delete_session(session_id: int, db: DBSession = Depends(get_db), user: models.User = Depends(get_current_user)):
    session, project = _owned_session(db, session_id, user)
    _delete_session_cascade(db, session, project)
    return {"status": "deleted"}


@app.post("/sessions/{session_id}/discovery")
def submit_discovery(session_id: int, payload: DiscoverySubmit, db: DBSession = Depends(get_db), user: models.User = Depends(get_current_user)):
    _owned_session(db, session_id, user)
    for item in payload.answers:
        db.add(models.DiscoveryAnswer(session_id=session_id, question=item.question, answer=item.answer))
    db.commit()
    return {"status": "saved", "count": len(payload.answers)}


# ---------- requirements ----------

@app.post("/requirements/analyze")
def analyze_requirement(payload: RequirementIn, db: DBSession = Depends(get_db), user: models.User = Depends(get_current_user)):
    _owned_session(db, payload.session_id, user)
    _check_rate_limit(user)

    requirement = models.Requirement(session_id=payload.session_id, original_text=payload.text, status="clarifying")
    db.add(requirement)
    db.commit()
    db.refresh(requirement)

    merged = _merge_ambiguities(rule_detector.detect(payload.text), ai_provider.detect_ambiguity(payload.text))

    existing_texts = []
    for other in (
        db.query(models.Requirement)
        .filter(models.Requirement.session_id == payload.session_id, models.Requirement.id != requirement.id)
        .all()
    ):
        latest = _latest_version(db, other.id)
        existing_texts.append(latest.translated_text if latest else other.original_text)
    for c in ai_provider.check_conflicts(payload.text, existing_texts):
        merged.append({
            "term": f"conflict with: {c['conflicts_with'][:60]}",
            "category": "conflict",
            "detector": "ai",
            "confidence": 1.0,
            "question": c["question"],
        })

    answer_options = ai_provider.generate_answer_options(payload.text, merged)

    saved = []
    for item in merged:
        ambiguity = models.Ambiguity(
            requirement_id=requirement.id, term=item["term"], category=item["category"],
            detector=item["detector"], confidence=item["confidence"],
        )
        db.add(ambiguity)
        db.commit()
        db.refresh(ambiguity)
        clarification = models.Clarification(ambiguity_id=ambiguity.id, question=item["question"])
        db.add(clarification)
        db.commit()
        saved.append({
            "ambiguity_id": ambiguity.id,
            "term": ambiguity.term,
            "category": ambiguity.category,
            "detector": ambiguity.detector,
            "question": clarification.question,
            "suggested_answer": None if item["category"] == "conflict"
            else _find_previous_answer(db, payload.session_id, requirement.id, item["term"]),
            "options": answer_options.get(item["term"], []),
        })
    return {"requirement_id": requirement.id, "ambiguities": saved}


@app.post("/requirements/translate")
def translate_requirement(payload: TranslateRequest, db: DBSession = Depends(get_db), user: models.User = Depends(get_current_user)):
    requirement, session, _ = _owned_requirement(db, payload.requirement_id, user)

    clarifications = []
    for ans in payload.answers:
        clarification = (
            db.query(models.Clarification)
            .join(models.Ambiguity, models.Clarification.ambiguity_id == models.Ambiguity.id)
            .filter(models.Clarification.ambiguity_id == ans.ambiguity_id, models.Ambiguity.requirement_id == requirement.id)
            .first()
        )
        if not clarification:
            raise HTTPException(404, "Unknown clarification for this requirement")
        clarification.answer = ans.answer
        clarification.answered_at = datetime.utcnow()
        clarifications.append({"term": clarification.ambiguity.term, "question": clarification.question, "answer": ans.answer})
    db.commit()

    context_texts = []
    for other in (
        db.query(models.Requirement)
        .filter(models.Requirement.session_id == session.id, models.Requirement.id != requirement.id)
        .all()
    ):
        latest = _latest_version(db, other.id)
        if latest:
            context_texts.append(latest.translated_text)
    discovery = [
        {"question": d.question, "answer": d.answer}
        for d in db.query(models.DiscoveryAnswer).filter(models.DiscoveryAnswer.session_id == session.id).all()
    ]

    result = ai_provider.translate_and_verify(requirement.original_text, clarifications, context_texts, discovery)

    count = db.query(models.RequirementVersion).filter(models.RequirementVersion.requirement_id == requirement.id).count()
    version = models.RequirementVersion(
        requirement_id=requirement.id, version_number=count + 1,
        translated_text=result["translated_text"], confidence_score=result["confidence"],
    )
    db.add(version)
    requirement.status = "translated"
    db.commit()
    db.refresh(version)
    return {"requirement_id": requirement.id, "version_number": version.version_number, "translated_text": version.translated_text}


@app.patch("/requirements/{requirement_id}/edit")
def edit_requirement_translation(requirement_id: int, payload: RequirementEdit, db: DBSession = Depends(get_db), user: models.User = Depends(get_current_user)):
    requirement, _, _ = _owned_requirement(db, requirement_id, user)
    count = db.query(models.RequirementVersion).filter(models.RequirementVersion.requirement_id == requirement.id).count()
    version = models.RequirementVersion(
        requirement_id=requirement.id, version_number=count + 1,
        translated_text=payload.translated_text, confidence_score=1.0,
    )
    db.add(version)
    requirement.status = "translated"  # an edit invalidates any earlier approval
    db.commit()
    db.refresh(version)
    return {"requirement_id": requirement.id, "version_number": version.version_number, "translated_text": version.translated_text}


@app.post("/requirements/{requirement_id}/approve")
def approve_requirement(requirement_id: int, payload: ApproveIn, db: DBSession = Depends(get_db), user: models.User = Depends(get_current_user)):
    requirement, _, _ = _owned_requirement(db, requirement_id, user)
    latest = _latest_version(db, requirement.id)
    if not latest:
        raise HTTPException(400, "Nothing to approve yet")
    db.add(models.Approval(requirement_version_id=latest.id, approved_by=user.name, notes=payload.notes))
    requirement.status = "approved"
    db.commit()
    return {"requirement_id": requirement.id, "status": "approved", "approved_by": user.name}


@app.get("/requirements/{requirement_id}")
def get_requirement(requirement_id: int, db: DBSession = Depends(get_db), user: models.User = Depends(get_current_user)):
    requirement, _, _ = _owned_requirement(db, requirement_id, user)
    versions = (
        db.query(models.RequirementVersion)
        .filter(models.RequirementVersion.requirement_id == requirement.id)
        .order_by(models.RequirementVersion.version_number.desc())
        .all()
    )
    return {
        "id": requirement.id,
        "original_text": requirement.original_text,
        "status": requirement.status,
        "versions": [
            {"version_number": v.version_number, "translated_text": v.translated_text,
             "confidence_score": v.confidence_score, "created_at": v.created_at.isoformat()}
            for v in versions
        ],
    }


# ---------- report ----------

def _report_items(db: DBSession, session_id: int) -> list[dict]:
    reqs = db.query(models.Requirement).filter(models.Requirement.session_id == session_id).order_by(models.Requirement.id).all()
    return [_requirement_view(db, r) for r in reqs]


@app.get("/sessions/{session_id}/report")
def get_session_report(session_id: int, db: DBSession = Depends(get_db), user: models.User = Depends(get_current_user)):
    _, project = _owned_session(db, session_id, user)
    return {"session_id": session_id, "project_name": project.name, "requirements": _report_items(db, session_id)}


@app.get("/sessions/{session_id}/report/docx")
def download_report_docx(session_id: int, db: DBSession = Depends(get_db), user: models.User = Depends(get_current_user)):
    _, project = _owned_session(db, session_id, user)
    items = _report_items(db, session_id)

    doc = Document()
    doc.add_heading(f"{project.name} — Requirements", level=1)
    doc.add_paragraph(f"Generated by ClearReq AI on {datetime.utcnow().strftime('%Y-%m-%d')}")

    def write_list(entries: list[dict]) -> None:
        if not entries:
            doc.add_paragraph("(none)")
        for i, e in enumerate(entries, 1):
            doc.add_paragraph(f"{i}. {e['translated_text'] or '(no translation)'}")

    doc.add_heading("Functional Requirements", level=2)
    write_list([e for e in items if e["req_type"] == "Functional"])

    doc.add_heading("Non-Functional Requirements", level=2)
    nfr = [e for e in items if e["req_type"] == "Non-Functional"]
    if not nfr:
        doc.add_paragraph("(none)")
    for cat in sorted({e["category"] for e in nfr}):
        doc.add_heading(cat.capitalize(), level=3)
        write_list([e for e in nfr if e["category"] == cat])

    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    safe = "".join(c if c.isalnum() else "_" for c in project.name)[:60] or "requirements"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{safe}_requirements.docx"'},
    )


# ---------- frontend (must be mounted last) ----------

_FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend")
if os.path.isdir(_FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=_FRONTEND_DIR, html=True), name="frontend")
