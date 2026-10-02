"""AIProvider: Gemini (primary) -> Groq (fallback), one seam for all AI calls.
Model names are read from env so a provider deprecating a model is a config
change, not a code change (this has happened twice during development)."""
import os
import json
from google import genai
from groq import Groq
from dotenv import load_dotenv
from . import rule_detector

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

_gemini_client = genai.Client(api_key=GEMINI_API_KEY, http_options={"timeout": 30000}) if GEMINI_API_KEY else None
_groq_client = Groq(api_key=GROQ_API_KEY, timeout=30.0) if GROQ_API_KEY else None

DETECTION_PROMPT = """You are analysing a software requirement for ambiguity.
Requirement: "{text}"
Identify every term whose meaning is not objectively measurable. For each,
return term, category (performance/security/scope/UX), confidence (0-1),
and a short clarification question.
Respond ONLY with a JSON array, e.g.
[{{"term": "fast", "category": "performance", "confidence": 0.9, "question": "What is the expected response time?"}}]
If none, respond with []."""

TRANSLATION_PROMPT = """Rewrite this software requirement as a single, clear,
development-ready statement, incorporating the clarifications given.

Project context (from discovery questions): {discovery_context}
Original requirement: "{text}"
Clarifications: {clarifications}
Other already-translated requirements (for terminology consistency only, do not repeat them): {context}

RULES:
- Exactly ONE coherent statement. Never "shall X, but shall not X".
- A clarification resolving a conflict OVERRIDES the original wording on that point.
- PRESERVE absolute/exclusive claims ("must never", "only", "offline-first") unless
  a clarification explicitly softens them. Do not hedge by default.
- If an answer is vague, still write one clear statement and lower confidence
  rather than hedging inside the sentence.
Respond ONLY with a JSON object: {{"translated_text": "...", "confidence": 0.0-1.0}}"""

OPTIONS_PROMPT = """For each ambiguous term below, generate 3-4 short,
concrete, mutually distinct answer options a client could pick from live in
a meeting. Under 10 words each.
Requirement: "{text}"
Terms and questions: {terms_list}
Respond ONLY with a JSON object mapping each term to a list of options."""

CONFLICT_PROMPT = """Does this new requirement contradict, duplicate, or
conflict with any already-approved requirement below? Only flag a genuine
contradiction, not a related topic.
New requirement: "{new_text}"
Already-approved requirements: {existing_list}
Respond ONLY with a JSON array, one entry per conflict:
[{{"conflicts_with": "<text>", "question": "<question to resolve it>"}}]
If none, respond with []."""


def _call_gemini(prompt: str) -> str:
    return _gemini_client.models.generate_content(model=GEMINI_MODEL, contents=prompt).text


def _call_groq(prompt: str) -> str:
    completion = _groq_client.chat.completions.create(model=GROQ_MODEL, messages=[{"role": "user", "content": prompt}])
    return completion.choices[0].message.content


def _call_with_fallback(prompt: str) -> str:
    if _gemini_client:
        try:
            return _call_gemini(prompt)
        except Exception as e:
            print(f"[AIProvider] Gemini failed ({e}), falling back to Groq")
    if _groq_client:
        return _call_groq(prompt)
    raise RuntimeError("No AI provider available — check API keys")


def _extract_json(raw: str):
    cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(cleaned)


def detect_ambiguity(text: str) -> list[dict]:
    try:
        results = _extract_json(_call_with_fallback(DETECTION_PROMPT.format(text=text)))
    except (json.JSONDecodeError, ValueError):
        return []
    for r in results:
        r["detector"] = "ai"
    return results


def translate(text: str, clarifications: list[dict], context: list[str] | None = None, discovery: list[dict] | None = None) -> dict:
    clar_text = "\n".join(f"- {c['question']} -> {c['answer']}" for c in clarifications)
    context_text = "\n".join(f"- {c}" for c in context) if context else "(none yet)"
    discovery_text = "\n".join(f"- {d['question']} -> {d['answer']}" for d in discovery if d.get("answer")) if discovery else "(none provided)"
    try:
        return _extract_json(_call_with_fallback(TRANSLATION_PROMPT.format(
            text=text, clarifications=clar_text, context=context_text, discovery_context=discovery_text)))
    except (json.JSONDecodeError, ValueError):
        return {"translated_text": text, "confidence": 0.0}


def translate_and_verify(text: str, clarifications: list[dict], context=None, discovery=None) -> dict:
    result = translate(text, clarifications, context, discovery)
    leftover = rule_detector.detect(result["translated_text"])
    if leftover:
        terms = ", ".join(f'"{i["term"]}"' for i in leftover)
        retry = clarifications + [{"term": "output review", "question": "avoid vague terms",
                                    "answer": f"Still vague: {terms}. Rewrite using the specifics already given — no placeholders."}]
        result = translate(text, retry, context, discovery)
        if rule_detector.detect(result["translated_text"]):
            result["confidence"] = min(result.get("confidence", 1.0), 0.5)
    return result


def generate_answer_options(text: str, ambiguities: list[dict]) -> dict:
    real = [a for a in ambiguities if a["category"] != "conflict"]
    if not real:
        return {}
    terms_list = "\n".join(f"- {a['term']}: {a['question']}" for a in real)
    try:
        return _extract_json(_call_with_fallback(OPTIONS_PROMPT.format(text=text, terms_list=terms_list)))
    except (json.JSONDecodeError, ValueError):
        return {}


def check_conflicts(new_text: str, existing: list[str]) -> list[dict]:
    if not existing:
        return []
    existing_list = "\n".join(f"- {r}" for r in existing)
    try:
        return _extract_json(_call_with_fallback(CONFLICT_PROMPT.format(new_text=new_text, existing_list=existing_list)))
    except (json.JSONDecodeError, ValueError):
        return []
