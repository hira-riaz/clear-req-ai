from typing import List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session as DBSession

import models
import schemas
from ambiguity import analyze_requirement
from database import Base, engine, get_db

Base.metadata.create_all(bind=engine)

app = FastAPI(title="ClearReq AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def log_action(db: DBSession, entity_type: str, entity_id: int, action: str, details: str = None):
    entry = models.AuditLog(
        entity_type=entity_type, entity_id=entity_id, action=action, details=details
    )
    db.add(entry)
    db.commit()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/projects", response_model=schemas.ProjectOut)
def create_project(payload: schemas.ProjectCreate, db: DBSession = Depends(get_db)):
    project = models.Project(name=payload.name)
    db.add(project)
    db.commit()
    db.refresh(project)
    log_action(db, "project", project.id, "created")
    return project


@app.get("/projects", response_model=List[schemas.ProjectOut])
def list_projects(db: DBSession = Depends(get_db)):
    return db.query(models.Project).all()


@app.post("/sessions", response_model=schemas.SessionOut)
def start_session(payload: schemas.SessionCreate, db: DBSession = Depends(get_db)):
    project = db.query(models.Project).get(payload.project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    session = models.Session(project_id=payload.project_id)
    db.add(session)
    db.commit()
    db.refresh(session)
    log_action(db, "session", session.id, "started")
    return session


@app.get("/projects/{project_id}/sessions", response_model=List[schemas.SessionOut])
def list_sessions(project_id: int, db: DBSession = Depends(get_db)):
    return db.query(models.Session).filter(models.Session.project_id == project_id).all()


@app.post("/requirements", response_model=schemas.RequirementOut)
def add_requirement(payload: schemas.RequirementCreate, db: DBSession = Depends(get_db)):
    session = db.query(models.Session).get(payload.session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    req = models.Requirement(
        session_id=payload.session_id,
        original_text=payload.original_text,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    log_action(db, "requirement", req.id, "created", details=payload.original_text)
    return req


@app.post("/requirements/{requirement_id}/analyze", response_model=schemas.RequirementOut)
def analyze(requirement_id: int, db: DBSession = Depends(get_db)):
    req = db.query(models.Requirement).get(requirement_id)
    if not req:
        raise HTTPException(404, "Requirement not found")

    findings = analyze_requirement(req.original_text)

    # Clear out unanswered clarifications from any previous analysis pass,
    # keep answered ones so re-analyzing doesn't throw away user input.
    db.query(models.Clarification).filter(
        models.Clarification.requirement_id == requirement_id,
        models.Clarification.answer.is_(None),
    ).delete()

    for f in findings:
        clar = models.Clarification(
            requirement_id=req.id,
            category=f["category"],
            question=f["question"],
            confidence=f["confidence"],
        )
        db.add(clar)

    req.status = "needs_clarification" if findings else "clear"
    db.commit()
    db.refresh(req)
    log_action(
        db, "requirement", req.id, "analyzed",
        details=f"{len(findings)} ambiguities found",
    )
    return req


@app.post("/clarifications/{clarification_id}/answer", response_model=schemas.ClarificationOut)
def answer_clarification(
    clarification_id: int, payload: schemas.AnswerIn, db: DBSession = Depends(get_db)
):
    clar = db.query(models.Clarification).get(clarification_id)
    if not clar:
        raise HTTPException(404, "Clarification not found")

    clar.answer = payload.answer
    db.commit()
    db.refresh(clar)
    log_action(db, "clarification", clar.id, "answered", details=payload.answer)

    req = db.query(models.Requirement).get(clar.requirement_id)
    unanswered = (
        db.query(models.Clarification)
        .filter(
            models.Clarification.requirement_id == req.id,
            models.Clarification.answer.is_(None),
        )
        .count()
    )
    if unanswered == 0:
        req.status = "ready_for_translation"
        db.commit()

    return clar


@app.get("/requirements/{requirement_id}", response_model=schemas.RequirementOut)
def get_requirement(requirement_id: int, db: DBSession = Depends(get_db)):
    req = db.query(models.Requirement).get(requirement_id)
    if not req:
        raise HTTPException(404, "Requirement not found")
    return req


@app.get("/sessions/{session_id}/requirements", response_model=List[schemas.RequirementOut])
def list_requirements(session_id: int, db: DBSession = Depends(get_db)):
    return (
        db.query(models.Requirement)
        .filter(models.Requirement.session_id == session_id)
        .all()
    )
