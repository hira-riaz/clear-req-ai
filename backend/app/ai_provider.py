"""
AIProvider — wraps calls to Gemini (primary) and Groq (fallback) behind a
single interface, so the rest of the app never talks to a specific vendor
directly. See docs/enhanced_blueprint.md section 5 for the reasoning.

Each public method returns plain Python data (dicts/lists), never raw SDK
response objects, so callers don't need to know which provider answered.
"""
import os
import json
from google import genai
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

_gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
_groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

DETECTION_PROMPT = """You are analysing a software requirement for ambiguity.
Requirement: "{text}"

Identify every term whose meaning is not objectively measurable (e.g. "fast",
"secure", "easy" without a concrete definition). For each one, return an
entry with: term, category (performance/security/scope/UX), confidence
(0-1), and a short clarification question.

Respond ONLY with a JSON array, no other text. Example:
[{{"term": "fast", "category": "performance", "confidence": 0.9,
   "question": "What is the expected response time?"}}]
If there are no ambiguous terms, respond with []."""

TRANSLATION_PROMPT = """Rewrite this software requirement as a clear,
development-ready statement, incorporating the clarifications given. Keep
terminology consistent with the other requirements already established for
this system, listed below.

Original requirement: "{text}"

Clarifications:
{clarifications}

Other already-translated requirements for this system (for consistency only, do not repeat them):
{context}

Respond ONLY with a JSON object: {{"translated_text": "...", "confidence": 0.0-1.0}}"""

CONFLICT_PROMPT = """You are checking whether a new software requirement
conflicts with requirements already agreed upon for the same system.

New requirement: "{new_text}"

Already-approved requirements for this system:
{existing_list}

Does the new requirement contradict, duplicate the intent of, or conflict
with any of the already-approved requirements above? Only flag a genuine
contradiction (two requirements that cannot both be true), not simply a
related or overlapping topic.

Respond ONLY with a JSON array. If there is a conflict, one entry per conflict:
[{{"conflicts_with": "<the existing requirement text>", "question": "<a question asking the user to resolve the conflict>"}}]
If there is no conflict, respond with []."""

def _call_gemini(prompt: str) -> str:
    response = _gemini_client.models.generate_content(
        model="gemini-2.5-flash", contents=prompt
    )
    return response.text


def _call_groq(prompt: str) -> str:
    completion = _groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
    )
    return completion.choices[0].message.content


def _call_with_fallback(prompt: str) -> str:
    """Try Gemini first; fall back to Groq on any failure."""
    if _gemini_client:
        try:
            return _call_gemini(prompt)
        except Exception as e:
            print(f"[AIProvider] Gemini failed ({e}), falling back to Groq")
    if _groq_client:
        return _call_groq(prompt)
    raise RuntimeError("No AI provider available — check your .env API keys")


def _extract_json(raw_text: str):
    """Model responses occasionally wrap JSON in markdown fences — strip them."""
    cleaned = raw_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(cleaned)


def detect_ambiguity(text: str) -> list[dict]:
    """AI-assisted ambiguity detection. Returns the same shape as rule_detector.detect()."""
    raw = _call_with_fallback(DETECTION_PROMPT.format(text=text))
    try:
        results = _extract_json(raw)
    except (json.JSONDecodeError, ValueError):
        print(f"[AIProvider] Could not parse detection response: {raw!r}")
        return []
    for r in results:
        r["detector"] = "ai"
    return results


def translate(text: str, clarifications: list[dict], context: list[str] | None = None) -> dict:
    """
    Compose the final translated requirement.
    clarifications: list of {"term": ..., "question": ..., "answer": ...}
    context: other already-translated requirements in the same session,
             used only for terminology consistency.
    Returns {"translated_text": ..., "confidence": ...}
    """
    clar_text = "\n".join(f"- {c['question']} -> {c['answer']}" for c in clarifications)
    context_text = "\n".join(f"- {c}" for c in context) if context else "(none yet)"
    raw = _call_with_fallback(
        TRANSLATION_PROMPT.format(text=text, clarifications=clar_text, context=context_text)
    )
    try:
        return _extract_json(raw)
    except (json.JSONDecodeError, ValueError):
        print(f"[AIProvider] Could not parse translation response: {raw!r}")
        return {"translated_text": text, "confidence": 0.0}


def check_conflicts(new_text: str, existing_requirements: list[str]) -> list[dict]:
    """
    Checks a new requirement against already-translated requirements in the
    same session for direct contradictions. Returns clarification-style
    entries the frontend renders like any other ambiguity, category="conflict".
    """
    if not existing_requirements:
        return []
    existing_list = "\n".join(f"- {r}" for r in existing_requirements)
    raw = _call_with_fallback(CONFLICT_PROMPT.format(new_text=new_text, existing_list=existing_list))
    try:
        return _extract_json(raw)
    except (json.JSONDecodeError, ValueError):
        print(f"[AIProvider] Could not parse conflict-check response: {raw!r}")
        return []
