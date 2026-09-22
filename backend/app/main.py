"""
ClearReq AI backend.

Full session workflow:
  Start session:      POST /sessions
  Discovery:            POST /sessions/{id}/discovery
  Detection phase:       POST /requirements/analyze
  Resolution phase:      POST /requirements/translate
  Review/edit:            PATCH /requirements/{id}/edit
  Report (data):           GET  /sessions/{id}/report
  Report (Word file):       GET  /sessions/{id}/report/docx
"""
import io
import json
import hashlib
from datetime import datetime

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session as DBSession
from docx import Document

from . import models, rule_detector, ai_provider
from .database import engine, get_db
from .schemas import RequirementIn, TranslateRequest, SessionIn, RequirementEdit, DiscoverySubmit

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="ClearReq AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "ClearReq AI backend running"}


@app.post("/sessions")
def start_session(payload: SessionIn, db: DBSession = Depends(get_db)):
    project = models.Project(name=payload.project_name, client_name=payload.client_name)
    db.add(project)
    db.commit()
    db.refresh(project)

    session = models.Session(project_id=project.id)
    db.add(session)
    db.commit()
    db.refresh(session)

    return {"session_id": session.id, "project_id": project.id, "project_name": project.name}


@app.post("/sessions/{session_id}/discovery")
def submit_discovery(session_id: int, payload: DiscoverySubmit, db: DBSession = Depends(get_db)):
    for item in payload.answers:
        db.add(models.DiscoveryAnswer(
            session_id=session_id,
            question=item.question,
            answer=item.answer,
        ))
    db.commit()
    return {"status": "saved", "count": len(payload.answers)}


def _merge_ambiguities(rule_results: list[dict], ai_results: list[dict]) -> list[dict]:
    by_term = {r["term"].lower(): r for r in rule_results}
    for r in ai_results:
        key = r["term"].lower()
        if key not in by_term:
            by_term[key] = r
    return list(by_term.values())


def _find_previous_answer(db: DBSession, session_id: int, exclude_requirement_id: int, term: str) -> str | None:
    result = (
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
    return result.answer if result else None


def _classify_fr_nfr(category: str) -> str:
    """
    Heuristic FR/NFR classification based on which ambiguity category
    dominated a requirement's clarification. A simplification — the RE
    literature notes the FR/NFR boundary is often not clear-cut in
    practice. Documented explicitly as a heuristic, not a definitive
    classifier.
    """
    return "Non-Functional" if category in ("performance", "security", "UX") else "Functional"


def _compute_cache_key(translated: list[dict]) -> str:
    joined = "|".join(
        f"{t['requirement_id']}:{t['translated_text']}"
        for t in sorted(translated, key=lambda x: x["requirement_id"])
    )
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


def _get_overview_and_redundancy(db: DBSession, session: models.Session, project_name: str,
                                  discovery_data: list[dict], translated_for_analysis: list[dict]):
    """
    Computes, or reuses a cached, system overview and redundancy flags for
    a session — both expensive AI calls that only need to change when the
    set of translated requirements changes.
    """
    cache_key = _compute_cache_key(translated_for_analysis)

    if session.cached_key == cache_key and session.cached_overview is not None:
        redundancy = json.loads(session.cached_redundancy) if session.cached_redundancy else []
        return session.cached_overview, redundancy

    overview = ai_provider.generate_system_overview(project_name, discovery_data, translated_for_analysis)
    redundancy = ai_provider.check_redundancy(translated_for_analysis)

    session.cached_key = cache_key
    session.cached_overview = overview
    session.cached_redundancy = json.dumps(redundancy)
    db.commit()

    return overview, redundancy


@app.post("/requirements/analyze")
def analyze_requirement(payload: RequirementIn, db: DBSession = Depends(get_db)):
    requirement = models.Requirement(
        session_id=payload.session_id,
        original_text=payload.text,
        status="clarifying",
    )
    db.add(requirement)
    db.commit()
    db.refresh(requirement)

    rule_results = rule_detector.detect(payload.text)
    ai_results = ai_provider.detect_ambiguity(payload.text)
    merged = _merge_ambiguities(rule_results, ai_results)

    other_requirements = (
        db.query(models.Requirement)
        .filter(models.Requirement.session_id == payload.session_id)
        .filter(models.Requirement.id != requirement.id)
        .all()
    )
    existing_texts = []
    for r in other_requirements:
        latest = (
            db.query(models.RequirementVersion)
            .filter(models.RequirementVersion.requirement_id == r.id)
            .order_by(models.RequirementVersion.version_number.desc())
            .first()
        )
        existing_texts.append(latest.translated_text if latest else r.original_text)
    conflicts = ai_provider.check_conflicts(payload.text, existing_texts)
    for c in conflicts:
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
            requirement_id=requirement.id,
            term=item["term"],
            category=item["category"],
            detector=item["detector"],
            confidence=item["confidence"],
        )
        db.add(ambiguity)
        db.commit()
        db.refresh(ambiguity)

        clarification = models.Clarification(
            ambiguity_id=ambiguity.id,
            question=item["question"],
        )
        db.add(clarification)
        db.commit()

        suggested_answer = None
        if item["category"] != "conflict":
            suggested_answer = _find_previous_answer(db, payload.session_id, requirement.id, item["term"])

        saved.append({
            "ambiguity_id": ambiguity.id,
            "term": ambiguity.term,
            "category": ambiguity.category,
            "detector": ambiguity.detector,
            "confidence": ambiguity.confidence,
            "question": clarification.question,
            "suggested_answer": suggested_answer,
            "options": answer_options.get(item["term"], []),
        })

    return {"requirement_id": requirement.id, "ambiguities": saved}


@app.post("/requirements/translate")
def translate_requirement(payload: TranslateRequest, db: DBSession = Depends(get_db)):
    requirement = db.get(models.Requirement, payload.requirement_id)

    clarifications_for_prompt = []
    for ans in payload.answers:
        clarification = (
            db.query(models.Clarification)
            .filter(models.Clarification.ambiguity_id == ans.ambiguity_id)
            .first()
        )
        clarification.answer = ans.answer
        clarification.answered_at = datetime.utcnow()
        db.commit()
        clarifications_for_prompt.append({
            "term": clarification.ambiguity.term,
            "question": clarification.question,
            "answer": ans.answer,
        })

    context_versions = (
        db.query(models.RequirementVersion)
        .join(models.Requirement)
        .filter(models.Requirement.session_id == requirement.session_id)
        .filter(models.Requirement.id != requirement.id)
        .all()
    )
    context_texts = [v.translated_text for v in context_versions]

    discovery_answers = (
        db.query(models.DiscoveryAnswer)
        .filter(models.DiscoveryAnswer.session_id == requirement.session_id)
        .all()
    )
    discovery_data = [{"question": d.question, "answer": d.answer} for d in discovery_answers]

    result = ai_provider.translate_and_verify(requirement.original_text, clarifications_for_prompt, context_texts, discovery_data)

    existing_versions = (
        db.query(models.RequirementVersion)
        .filter(models.RequirementVersion.requirement_id == requirement.id)
        .count()
    )
    version = models.RequirementVersion(
        requirement_id=requirement.id,
        version_number=existing_versions + 1,
        translated_text=result["translated_text"],
        confidence_score=result["confidence"],
    )
    db.add(version)
    requirement.status = "translated"
    db.commit()
    db.refresh(version)

    return {
        "requirement_id": requirement.id,
        "version_number": version.version_number,
        "translated_text": version.translated_text,
        "confidence_score": version.confidence_score,
    }


@app.patch("/requirements/{requirement_id}/edit")
def edit_requirement_translation(requirement_id: int, payload: RequirementEdit, db: DBSession = Depends(get_db)):
    existing_versions = (
        db.query(models.RequirementVersion)
        .filter(models.RequirementVersion.requirement_id == requirement_id)
        .count()
    )
    version = models.RequirementVersion(
        requirement_id=requirement_id,
        version_number=existing_versions + 1,
        translated_text=payload.translated_text,
        confidence_score=1.0,
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return {
        "requirement_id": requirement_id,
        "version_number": version.version_number,
        "translated_text": version.translated_text,
    }


@app.get("/requirements/{requirement_id}")
def get_requirement(requirement_id: int, db: DBSession = Depends(get_db)):
    requirement = db.get(models.Requirement, requirement_id)
    versions = (
        db.query(models.RequirementVersion)
        .filter(models.RequirementVersion.requirement_id == requirement_id)
        .all()
    )
    return {
        "id": requirement.id,
        "original_text": requirement.original_text,
        "status": requirement.status,
        "versions": [
            {"version_number": v.version_number, "translated_text": v.translated_text,
             "confidence_score": v.confidence_score, "created_at": v.created_at.isoformat()}
            for v in sorted(versions, key=lambda v: v.version_number, reverse=True)
        ],
    }


@app.get("/sessions/{session_id}/report")
def get_session_report(session_id: int, db: DBSession = Depends(get_db)):
    session = db.get(models.Session, session_id)
    project = db.get(models.Project, session.project_id) if session else None

    requirements = (
        db.query(models.Requirement)
        .filter(models.Requirement.session_id == session_id)
        .all()
    )

    items = []
    translated_for_analysis = []
    for r in requirements:
        latest = (
            db.query(models.RequirementVersion)
            .filter(models.RequirementVersion.requirement_id == r.id)
            .order_by(models.RequirementVersion.version_number.desc())
            .first()
        )

        ambiguities = (
            db.query(models.Ambiguity)
            .filter(models.Ambiguity.requirement_id == r.id)
            .filter(models.Ambiguity.category != "conflict")
            .all()
        )
        category_counts: dict[str, int] = {}
        for a in ambiguities:
            category_counts[a.category] = category_counts.get(a.category, 0) + 1
        dominant_category = max(category_counts, key=category_counts.get) if category_counts else "general"

        items.append({
            "requirement_id": r.id,
            "original_text": r.original_text,
            "status": r.status,
            "translated_text": latest.translated_text if latest else None,
            "confidence_score": latest.confidence_score if latest else None,
            "category": dominant_category,
            "req_type": _classify_fr_nfr(dominant_category),
        })
        if latest:
            translated_for_analysis.append({"requirement_id": r.id, "translated_text": latest.translated_text})

    discovery = (
        db.query(models.DiscoveryAnswer)
        .filter(models.DiscoveryAnswer.session_id == session_id)
        .all()
    )
    discovery_data = [{"question": d.question, "answer": d.answer} for d in discovery]

    system_overview, redundancy_flags = _get_overview_and_redundancy(
        db, session, project.name if project else "System", discovery_data, translated_for_analysis
    )

    return {
        "session_id": session_id,
        "project_name": project.name if project else None,
        "system_overview": system_overview,
        "requirements": items,
        "discovery": discovery_data,
        "redundancy_flags": redundancy_flags,
    }


@app.get("/sessions/{session_id}/report/docx")
def download_report_docx(session_id: int, db: DBSession = Depends(get_db)):
    session = db.get(models.Session, session_id)
    project = db.get(models.Project, session.project_id) if session else None
    requirements = (
        db.query(models.Requirement)
        .filter(models.Requirement.session_id == session_id)
        .all()
    )

    discovery = (
        db.query(models.DiscoveryAnswer)
        .filter(models.DiscoveryAnswer.session_id == session_id)
        .all()
    )
    discovery_data = [{"question": d.question, "answer": d.answer} for d in discovery]

    enriched = []
    for r in requirements:
        latest = (
            db.query(models.RequirementVersion)
            .filter(models.RequirementVersion.requirement_id == r.id)
            .order_by(models.RequirementVersion.version_number.desc())
            .first()
        )
        ambiguities = (
            db.query(models.Ambiguity)
            .filter(models.Ambiguity.requirement_id == r.id)
            .filter(models.Ambiguity.category != "conflict")
            .all()
        )
        category_counts: dict[str, int] = {}
        for a in ambiguities:
            category_counts[a.category] = category_counts.get(a.category, 0) + 1
        dominant_category = max(category_counts, key=category_counts.get) if category_counts else "general"
        enriched.append({
            "requirement_id": r.id,
            "original_text": r.original_text,
            "translated_text": latest.translated_text if latest else "(no translation)",
            "category": dominant_category,
            "req_type": _classify_fr_nfr(dominant_category),
        })

    translated_for_analysis = [
        {"requirement_id": e["requirement_id"], "translated_text": e["translated_text"]}
        for e in enriched if e["translated_text"] != "(no translation)"
    ]
    system_overview, redundancy_flags = _get_overview_and_redundancy(
        db, session, project.name if project else "System", discovery_data, translated_for_analysis
    )

    doc = Document()
    title = project.name if project else "ClearReq AI Report"
    doc.add_heading(f"{title} — Software Requirements Specification", level=1)
    doc.add_paragraph(f"Generated by ClearReq AI on {datetime.utcnow().strftime('%Y-%m-%d')}")
    doc.add_paragraph(
        "This document follows the ISO/IEC/IEEE 29148 requirements "
        "engineering standard's convention of a system overview followed "
        "by functional and non-functional requirements, with full "
        "traceability to original stakeholder wording."
    )

    if discovery_data:
        doc.add_heading("Project Discovery", level=2)
        for d in discovery_data:
            doc.add_paragraph(f"{d['question']} — {d['answer'] or '(skipped)'}")

    doc.add_heading("System Overview", level=2)
    doc.add_paragraph(system_overview or "(no requirements finalized yet)")

    functional = [e for e in enriched if e["req_type"] == "Functional"]
    non_functional = [e for e in enriched if e["req_type"] == "Non-Functional"]

    doc.add_heading("Functional Requirements", level=2)
    if functional:
        for e in functional:
            doc.add_paragraph(e["translated_text"], style="List Number")
    else:
        doc.add_paragraph("(none)")

    doc.add_heading("Non-Functional Requirements", level=2)
    if non_functional:
        nfr_groups: dict[str, list] = {}
        for e in non_functional:
            nfr_groups.setdefault(e["category"], []).append(e)
        for cat, group in nfr_groups.items():
            doc.add_heading(cat.capitalize(), level=3)
            for e in group:
                doc.add_paragraph(e["translated_text"], style="List Number")
    else:
        doc.add_paragraph("(none)")

    if redundancy_flags:
        doc.add_heading("Possible Redundant Requirements", level=2)
        doc.add_paragraph(
            "The following requirement groups were flagged as potentially "
            "overlapping in intent and may be worth merging or reviewing:"
        )
        for group in redundancy_flags:
            ids_str = ", ".join(f"#{i}" for i in group.get("requirement_ids", []))
            doc.add_paragraph(f"{ids_str}: {group.get('reason', '')}", style="List Bullet")

    doc.add_page_break()
    doc.add_heading("Requirements Traceability Matrix", level=2)
    doc.add_paragraph(
        "Every finalized requirement below is traceable to the client's "
        "original wording, preserving the source of each stated need."
    )
    table = doc.add_table(rows=1, cols=4)
    table.style = "Light Grid Accent 1"
    hdr = table.rows[0].cells
    hdr[0].text = "ID"
    hdr[1].text = "Type"
    hdr[2].text = "Final Requirement"
    hdr[3].text = "Original Client Statement"
    for e in enriched:
        row = table.add_row().cells
        row[0].text = str(e["requirement_id"])
        row[1].text = e["req_type"]
        row[2].text = e["translated_text"]
        row[3].text = e["original_text"]

    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)

    safe_title = (project.name if project else "clearreq").replace(" ", "_")
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={safe_title}_report.docx"},
    )