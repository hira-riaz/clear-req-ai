# Architecture context — ClearReq AI

## Layered system architecture
See `docs/diagram_architecture.svg` for the rendered layered architecture.

1. **Presentation:** Plain HTML, CSS, and JavaScript browser UI; Supabase
   browser SDK manages sign-in and sends bearer tokens with protected API
   requests. FastAPI serves the frontend from the same origin.
2. **API / application:** FastAPI routes in `backend/app/main.py` handle
   projects, sessions, discovery, requirement analysis and translation,
   review, reporting, and DOCX export. `auth.py` verifies Supabase tokens and
   enforces local user and project ownership.
3. **Domain / processing:** The rule-based detector (lexicon and spaCy POS)
   and AI ambiguity detector run on submitted requirements. The application
   merges detections, manages clarification answers, translates requirements,
   records confidence and versions, and supports review and reporting.
4. **Data access / persistence:** SQLAlchemy models and database access
   persist users, projects, sessions, requirements, ambiguities,
   clarifications, versions, discovery answers, and approvals. SQLite is the
   default;
5. **External integrations:** Supabase Auth provides identity verification.
   `ai_provider.py` centralizes Gemini as the primary model provider and Groq
   as the fallback.

The evaluation scripts and labelled datasets are a separate research workflow,
not part of the production request path.

## Request flow — detection phase
1. Supabase Auth supplies the user access token; the frontend sends it as a
   bearer token on protected API requests.
2. Frontend POSTs `{session_id, text}` to `/requirements/analyze`.
3. Backend saves a new `Requirement` row (status="clarifying").
4. Backend runs `rule_detector.detect(text)` and `ai_provider.detect_ambiguity(text)`
   on the *same* input text.
5. Results are merged/deduplicated by term (`_merge_ambiguities` in main.py).
6. Each ambiguity is saved as an `Ambiguity` row, with an attached
   `Clarification` row holding the generated question (answer is null until
   the frontend submits it).
7. Response returns the merged list to the frontend for rendering.

## Request flow — resolution phase
1. Frontend POSTs `{requirement_id, answers: [{ambiguity_id, answer}]}` to
   `/requirements/translate`.
2. Backend writes each answer onto its `Clarification` row.
3. Backend calls `ai_provider.translate(original_text, clarifications)`.
4. A new `RequirementVersion` row is created (version_number increments —
   never overwrite a previous version).
5. Requirement status is updated to "translated".
6. Response returns the translated text and confidence score.

## Session, review, and report requests
- `/projects` lists and creates projects for the authenticated user;
  `/projects/{id}/sessions` creates sessions within a project.
- A project can contain multiple sessions. Each session has an optional name,
  a saved start date/time, and its own requirements and report. Discovery
  questions are asked in the first session only; later sessions inherit its
  answers.
- `GET` and `POST /sessions/{id}/discovery` load and save project discovery
  answers through the first session; later sessions reuse the inherited data.
- `/sessions/{id}/report` supplies translated requirements for review and the
  final report; requirement edit and approve routes persist review decisions.
- `/sessions/{id}/report/docx` returns the authenticated Word export.
- FastAPI serves the frontend from `frontend/`, so browser API requests use
  the same origin as the backend.

## Key design rule: never call the AI provider directly from routes
All AI calls go through `ai_provider.py`. This keeps the Gemini→Groq fallback
logic in one place and means `main.py` never needs to know which vendor
actually answered.

## Database schema
See docs/diagram_erd.png and docs/ClearReq_AI_Planning_Document.docx
section 5 for the full entity-relationship diagram. Key point: schema is
versioned — a Requirement can have multiple RequirementVersions over time,
so re-translating never destroys history. Projects own multiple sessions, and
session names are optional; `started_at` provides the date/time label when a
session is unnamed. Project discovery is stored on the first session and
copied to subsequent sessions.

## Deliberate scope decisions (don't "fix" these without asking)
- SQLite is the default local database; PostgreSQL is supported through
  `DATABASE_URL` for deployment.
- Supabase Auth protects user data; keep identity checks and ownership
  enforcement on the backend.
- No Celery/background task queue — synchronous AI calls are fine at this
  volume.
