"""
Pydantic request/response schemas — API input shapes only.

These mirror the ER diagram (docs/diagram_erd.png): Requirement holds no
version field directly (version numbers live on RequirementVersion, a
separate table, so history is never overwritten). Category lives on
Ambiguity, not Clarification. See context/architecture-context.md for the
full schema reasoning.
"""
import datetime

from pydantic import BaseModel


class RequirementIn(BaseModel):
    """Input for POST /requirements/analyze"""
    session_id: int
    text: str


class ClarificationAnswer(BaseModel):
    """One answer within a translate request"""
    ambiguity_id: int
    answer: str


class TranslateRequest(BaseModel):
    """Input for POST /requirements/translate"""
    requirement_id: int
    answers: list[ClarificationAnswer]


class SessionIn(BaseModel):
    """Input for POST /sessions"""
    project_name: str
    client_name: str | None = None

class ProjectOut(BaseModel):
    id: int
    name: str
    created_at: datetime

    class Config:
        from_attributes = True

