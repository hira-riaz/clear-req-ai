# AI workflow rules — ClearReq AI

## Provider order
1. Try Gemini (`gemini-2.5-flash`) first — free tier, generous limits.
2. On any exception, fall back to Groq (`llama-3.3-70b-versatile`).
3. If both fail, raise a clear error — never fail silently or return fake
   data pretending to be a model response.

This logic lives ONLY in `ai_provider.py::_call_with_fallback`. Do not
duplicate provider-selection logic anywhere else in the codebase.

## Prompt contracts
Both AI-facing functions expect the model to return **JSON only, no prose,
no markdown fences** (though `_extract_json` strips fences defensively in
case the model adds them anyway).

- `detect_ambiguity(text)` expects a JSON array of
  `{term, category, confidence, question}` objects. Category must be one
  of: `performance`, `security`, `scope`, `UX`.
- `translate(text, clarifications)` expects a JSON object
  `{translated_text, confidence}`.

If you change either prompt, keep the "respond ONLY with JSON" instruction
and keep the example format in the prompt — models are much more reliable
at valid JSON when shown an example.

## What the AI should never be asked to do
- Never ask it to invent or guess database IDs, schema fields, or table
  names — those come from the application, not the model.
- Never ask it to fabricate a confidence score for something it didn't
  actually assess (e.g. don't ask it to score the rule-based detector's
  output — confidence there is fixed at 1.0 by construction, see
  `rule_detector.py`).
- Never feed it two required-answers requests in a single call if you can
  avoid it — one clear task per call is more reliable than combining
  detection and translation into one prompt.

## Handling failures gracefully
- A malformed/non-JSON response should never crash the request — both
  `detect_ambiguity` and `translate` catch `JSONDecodeError` and return a
  safe fallback (empty list / original text with confidence 0.0). Preserve
  this pattern in any new AI-calling function.
- Log the raw failed response with `print()` for now (acceptable for FYP
  scope) so failures are debuggable without becoming user-facing errors.

## Evaluation-specific rule
When running `eval/evaluate.py --with-ai`, every requirement in the test
set must be sent through the exact same `detect_ambiguity()` function used
in production — never a separate "evaluation-only" prompt. The whole point
of the comparison is that both detectors see identical input through their
real code path.
