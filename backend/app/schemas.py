"""
Pydantic request/response schemas — API input shapes and validation.

Validation is applied here, at the API boundary, as defense-in-depth
alongside frontend output escaping (see app.js escapeHtml). Text
containing HTML/script-like patterns is rejected outright rather than
sanitized-and-passed-through, because this project's AI prompts treat
requirement text as trusted natural language — letting tag-like content
through risks prompt injection (the AI attempting to charitably interpret
a <script> tag as a literal feature request), not just browser-side XSS.
"""
import re
from pydantic import BaseModel, field_validator

_TAG_PATTERN = re.compile(r"<\s*/?\s*[a-zA-Z][^>]*>")


def _reject_html_like(value: str, field_name: str) -> str:
    value = value.strip()
    if _TAG_PATTERN.search(value):
        raise ValueError(
            f"{field_name} appears to contain HTML/script content, "
            "which is not accepted as plain requirement text"
        )
    return value


class RequirementIn(BaseModel):
    session_id: int
    text: str

    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
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
    def validate_answer(cls, v: str) -> str:
        return _reject_html_like(v.strip(), "Answer")


class TranslateRequest(BaseModel):
    requirement_id: int
    answers: list[ClarificationAnswer]


class SessionIn(BaseModel):
    project_name: str
    client_name: str | None = None

    @field_validator("project_name")
    @classmethod
    def validate_project_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Project name cannot be empty")
        return _reject_html_like(v, "Project name")

    @field_validator("client_name")
    @classmethod
    def validate_client_name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return _reject_html_like(v.strip(), "Client name")


class RequirementEdit(BaseModel):
    translated_text: str

    @field_validator("translated_text")
    @classmethod
    def validate_translated_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Translated text cannot be empty")
        return _reject_html_like(v, "Translated text")


class DiscoveryAnswerIn(BaseModel):
    question: str
    answer: str | None = None

    @field_validator("answer")
    @classmethod
    def validate_answer(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return _reject_html_like(v.strip(), "Answer")


class DiscoverySubmit(BaseModel):
    answers: list[DiscoveryAnswerIn]