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
