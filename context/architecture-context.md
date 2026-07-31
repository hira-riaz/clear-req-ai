# Architecture context — ClearReq AI

## System layers
```
Frontend (plain HTML/JS)
      |
FastAPI backend (backend/app/main.py)
      |
      +---> Rule-based detector (backend/app/rule_detector.py)
      |
      +---> AI provider (backend/app/ai_provider.py)
              - Gemini (primary)
              - Groq (fallback on failure)
      |
SQLite database (backend/clearreq.db)
```

## Request flow — detection phase
1. Frontend POSTs `{session_id, text}` to `/requirements/analyze`.
2. Backend saves a new `Requirement` row (status="clarifying").
3. Backend runs `rule_detector.detect(text)` and `ai_provider.detect_ambiguity(text)`
   on the *same* input text.
4. Results are merged/deduplicated by term (`_merge_ambiguities` in main.py).
5. Each ambiguity is saved as an `Ambiguity` row, with an attached
   `Clarification` row holding the generated question (answer is null until
   the frontend submits it).
6. Response returns the merged list to the frontend for rendering.

## Request flow — resolution phase
1. Frontend POSTs `{requirement_id, answers: [{ambiguity_id, answer}]}` to
   `/requirements/translate`.
2. Backend writes each answer onto its `Clarification` row.
3. Backend calls `ai_provider.translate(original_text, clarifications)`.
4. A new `RequirementVersion` row is created (version_number increments —
   never overwrite a previous version).
5. Requirement status is updated to "translated".
6. Response returns the translated text and confidence score.

## Key design rule: never call the AI provider directly from routes
All AI calls go through `ai_provider.py`'s `detect_ambiguity()` and
`translate()` functions. This keeps the Gemini→Groq fallback logic in one
place and means main.py never needs to know which vendor actually answered.

## Database schema
See docs/diagram_erd.png and docs/ClearReq_AI_Planning_Document.docx
section 5 for the full entity-relationship diagram. Key point: schema is
versioned — a Requirement can have multiple RequirementVersions over time,
so re-translating never destroys history.

## Deliberate scope decisions (don't "fix" these without asking)
- SQLite, not Postgres — correct for this project's scale.
- No auth/multi-user system — single-user is in scope; do not add login
  flows unless explicitly asked.
- No Celery/background task queue — synchronous AI calls are fine at this
  volume.
