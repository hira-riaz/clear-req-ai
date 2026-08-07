from pydantic import BaseModel


class RequirementIn(BaseModel):
    session_id: int
    text: str


class ClarificationAnswer(BaseModel):
    ambiguity_id: int
    answer: str


class TranslateRequest(BaseModel):
    requirement_id: int
    answers: list[ClarificationAnswer]


class SessionIn(BaseModel):
    """Input for POST /sessions"""
    project_name: str
    client_name: str | None = None

class RequirementEdit(BaseModel):
    """Input for PATCH /requirements/{id}/edit"""
    translated_text: str