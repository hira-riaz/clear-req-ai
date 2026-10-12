"""
Request schemas with validation at the API boundary. Text that looks like
HTML/script is rejected outright: the AI prompts treat requirement text as
trusted natural language, so tag-like input is a prompt-injection risk, not
just a browser XSS risk.
"""
import re
from pydantic import BaseModel, field_validator

_TAG_PATTERN = re.compile(r"<\s*/?\s*[a-zA-Z][^>]*>")


def _reject_html_like(value: str, field_name: str) -> str:
    value = value.strip()
    if _TAG_PATTERN.search(value):
        raise ValueError(f"{field_name} appears to contain HTML/script content, which is not accepted as plain text")
    return value


class SessionIn(BaseModel):
    project_name: str
    client_name: str | None = None

    @field_validator("project_name")
    @classmethod
    def v_project(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 120:
            raise ValueError("Project name must be 1-120 characters")
        return _reject_html_like(v, "Project name")

    @field_validator("client_name")
    @classmethod
    def v_client(cls, v: str | None) -> str | None:
        return None if v is None else _reject_html_like(v.strip(), "Client name")


class RequirementIn(BaseModel):
    session_id: int
    text: str

    @field_validator("text")
    @classmethod
    def v_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Requirement text cannot be empty")
        if len(v) > 2000:
            raise ValueError("Requirement text exceeds maximum length (2000 characters)")
        return _reject_html_like(v, "Requirement text")


class ClarificationAnswer(BaseModel):
    ambiguity_id: int
    answer: str

    @field_validator("answer")
    @classmethod
    def v_answer(cls, v: str) -> str:
        return _reject_html_like(v, "Answer")


class TranslateRequest(BaseModel):
    requirement_id: int
    answers: list[ClarificationAnswer]


class RequirementEdit(BaseModel):
    translated_text: str

    @field_validator("translated_text")
    @classmethod
    def v_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Translated text cannot be empty")
        return _reject_html_like(v, "Translated text")


class ApproveIn(BaseModel):
    notes: str | None = None

    @field_validator("notes")
    @classmethod
    def v_notes(cls, v: str | None) -> str | None:
        return None if not v else _reject_html_like(v, "Notes")


class DiscoveryAnswerIn(BaseModel):
    question: str
    answer: str | None = None

    @field_validator("answer")
    @classmethod
    def v_answer(cls, v: str | None) -> str | None:
        return None if v is None else _reject_html_like(v, "Answer")


class DiscoverySubmit(BaseModel):
    answers: list[DiscoveryAnswerIn]
