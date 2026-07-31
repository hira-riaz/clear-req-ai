from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str


class ProjectOut(BaseModel):
    id: int
    name: str
    created_at: datetime

    class Config:
        from_attributes = True


class SessionCreate(BaseModel):
    project_id: int


class SessionOut(BaseModel):
    id: int
    project_id: int
    started_at: datetime
    ended_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RequirementCreate(BaseModel):
    session_id: int
    original_text: str


class ClarificationOut(BaseModel):
    id: int
    category: str
    question: str
    answer: Optional[str] = None
    confidence: float

    class Config:
        from_attributes = True


class RequirementOut(BaseModel):
    id: int
    session_id: int
    original_text: str
    status: str
    version: int
    clarifications: List[ClarificationOut] = []

    class Config:
        from_attributes = True


class AnswerIn(BaseModel):
    answer: str
