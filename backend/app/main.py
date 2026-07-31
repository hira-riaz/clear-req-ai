"""
ClearReq AI backend.

Endpoints map directly onto the two pipeline diagrams:

  Detection phase:   POST /requirements/analyze
  Resolution phase:  POST /requirements/translate
"""
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session as DBSession

from . import models, rule_detector, ai_provider
from .database import engine, get_db
from .schemas import RequirementIn, TranslateRequest

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="ClearReq AI")

# Allow the plain HTML/JS frontend (different port) to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this before any real deployment
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "ClearReq AI backend running"}


@app.post("/requirements/analyze")
def analyze_requirement(payload: RequirementIn, db: DBSession = Depends(get_db)):
    """
    Detection phase: run both detectors on the submitted text, merge and
    deduplicate results, save the requirement + ambiguities + clarification
    questions, and return them to the frontend.
    """
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

        saved.append({
            "ambiguity_id": ambiguity.id,
            "term": ambiguity.term,
            "category": ambiguity.category,
            "detector": ambiguity.detector,
            "confidence": ambiguity.confidence,
            "question": clarification.question,
        })

    return {"requirement_id": requirement.id, "ambiguities": saved}


def _merge_ambiguities(rule_results: list[dict], ai_results: list[dict]) -> list[dict]:
    """Deduplicate by term, preferring the rule-based entry when both agree
    (it's deterministic and free), otherwise keeping each unique catch."""
    by_term = {r["term"].lower(): r for r in rule_results}
    for r in ai_results:
        key = r["term"].lower()
        if key not in by_term:
            by_term[key] = r
    return list(by_term.values())


@app.post("/requirements/translate")
def translate_requirement(payload: TranslateRequest, db: DBSession = Depends(get_db)):
    """
    Resolution phase: save clarification answers, call the AI provider to
    compose the final translation, score confidence, save a new version.
    """
    requirement = db.get(models.Requirement, payload.requirement_id)

    clarifications_for_prompt = []
    for ans in payload.answers:
        clarification = (
            db.query(models.Clarification)
            .filter(models.Clarification.ambiguity_id == ans.ambiguity_id)
            .first()
        )
        clarification.answer = ans.answer
        db.commit()
        clarifications_for_prompt.append({
            "term": clarification.ambiguity.term,
            "question": clarification.question,
            "answer": ans.answer,
        })

    result = ai_provider.translate(requirement.original_text, clarifications_for_prompt)

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
             "confidence_score": v.confidence_score}
            for v in versions
        ],
    }
