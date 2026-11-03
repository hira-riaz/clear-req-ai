# ClearReq AI Architecture

This document reflects the current project structure and implementation in this repository. It is intentionally a documentation-only update and does not change any application code.

## 1. Overview

ClearReq AI is a FastAPI-based requirement analysis and translation workflow for software requirements. It takes informal client requirements, detects ambiguous or weak terms, asks clarification questions, and produces a cleaner, versioned requirement statement that can be reviewed and approved.

The project is currently implemented as a single application service:

- Backend: FastAPI application in `backend/app/`
- Frontend: static HTML/CSS/JavaScript app served by the same FastAPI service
- Persistence: SQLAlchemy with SQLite as the active local database for this project
- Authentication: Supabase Auth JWT verification
- AI layer: centralized provider wrapper with Gemini primary and Groq fallback
- Evaluation: separate research scripts under `eval/`

## 2. System architecture

The current application is structured as a layered system with a browser-based UI, one backend API service, and a relational database.

### Presentation layer

- `frontend/index.html` provides the browser UI shell.
- `frontend/css/styles.css` contains the styling.
- `frontend/js/app.js` manages application state, user flow, rendering, API calls, and workflow steps.
- The frontend is served from the FastAPI app using static file hosting; no Node.js or build step is required.

### API and application layer

The main backend service is defined in `backend/app/main.py`.

Key responsibilities:

- Session creation, listing, rename, delete, completion, and discovery submission
- Requirement analysis (detect ambiguity)
- Requirement translation after clarification
- Translation editing and approval
- Exporting the final requirements report to DOCX
- Serving the frontend from the same origin
- Enforcing per-user ownership for sessions and requirements

This module owns the main request flow and uses helper functions to validate ownership, ensure session state, apply rate limiting, and create versioned requirement records.

### Domain and processing layer

This is the logic that turns raw requirement text into clarified and translated output.

- `backend/app/rule_detector.py`
  - Lexicon-based ambiguity detection using a weak-words list
  - spaCy-based POS detection for vague adjectives not on the safe allowlist
  - Deduplicates rule results before passing them onward

- `backend/app/ai_provider.py`
  - Centralized AI integration for all provider calls
  - Supports Gemini as the primary model and Groq as fallback
  - Handles ambiguity detection, translation, answer option generation, and conflict checking
  - Adds a retry / fallback path without leaking provider details into route handlers

- `backend/app/schemas.py`
  - Pydantic validation for API payloads
  - Rejects obvious HTML/script-like content before it reaches AI prompts

### Data access and persistence layer

- `backend/app/database.py`
  - Creates the SQLAlchemy engine
  - Uses SQLite in local development (`backend/clearreq.db` by default)
  - Performs migration for legacy user-auth schema changes

- `backend/app/models.py`
  - ORM models for users, projects, sessions, requirements, ambiguities, clarifications, versions, approvals, and discovery answers
  - Requirement versioning is a core design decision: translation history is preserved rather than overwritten

### Identity and access layer

- `backend/app/auth.py`
  - Verifies Supabase JWT bearer tokens
  - Maps the Supabase user identity to the local `User` row
  - Links legacy local accounts by verified email when possible
  - Enforces ownership checks before allowing access to sessions or requirements

## 3. Request flow

### 3.1 Session creation flow

1. The user signs in through Supabase Auth in the browser.
2. The frontend requests `/public-config` for the Supabase project URL and anon key.
3. The frontend calls `/sessions` with project metadata.
4. The backend creates a `Project` and a `Session` owned by the authenticated user.
5. The session appears in the sidebar and becomes the working context for all further requirement processing.

### 3.2 Discovery flow

1. The UI gathers project discovery answers from a predefined set of questions.
2. The frontend submits them to `/sessions/{session_id}/discovery`.
3. The backend stores each response as `DiscoveryAnswer` records associated with the session.
4. The stored answers are later used as project-context input for requirement translation.

### 3.3 Analysis flow

1. The frontend sends a requirement string and `session_id` to `/requirements/analyze`.
2. The backend validates the session ownership and input.
3. The backend creates a new `Requirement` row with status `clarifying`.
4. It runs two detector pathways on the same text:
   - `rule_detector.detect()`
   - `ai_provider.detect_ambiguity()`
5. Results are merged by term and duplicate ambiguities are removed.
6. A conflict check compares the new requirement against earlier approved translations in the same session.
7. The backend creates `Ambiguity` and `Clarification` records for each flagged item.
8. The API returns a list of ambiguities and questions for user clarification.

### 3.4 Clarification and translation flow

1. The frontend collects user answers for the ambiguity questions.
2. It sends them to `/requirements/translate`.
3. The backend writes each answer to the associated `Clarification` record.
4. It gathers project-discovery context and earlier translated requirements in the same session.
5. The backend calls `ai_provider.translate_and_verify()`.
6. A new `RequirementVersion` row is created with the translated output and confidence score.
7. The current `Requirement.status` is set to `translated`.
8. The frontend displays the translated requirement for review.

### 3.5 Review and approval flow

1. The user may edit the translated text using the edit API.
2. Each edit creates a new version row, preserving prior history.
3. The user may approve the current version through `/requirements/{requirement_id}/approve`.
4. The backend records the approval in `Approval` and marks the requirement as `approved`.
5. The report endpoint aggregates all requirements and their status details for review.

### 3.6 Reporting export flow

1. `/sessions/{session_id}/report` returns the project report payload.
2. `/sessions/{session_id}/report/docx` builds a Word document.
3. The backend uses Python `docx` generation to export:
   - project metadata
   - discovery answers
   - functional and non-functional requirements
   - original requirement texts
4. It streams the `.docx` file to the browser for download.

## 4. Data model summary

The core data model is designed around versioned requirements and per-user project ownership.

### Primary entities

- `User`
  - Local application user identity
  - Linked to Supabase user ID
  - Stores name and email

- `Project`
  - Represents a client project or work item
  - Owned by one user

- `Session`
  - Represents a working session within a project
  - Holds requirement records and discovery answers
  - Can be completed and made read-only

- `Requirement`
  - Raw requirement text submitted by the user
  - Keeps a status such as `draft`, `clarifying`, `translated`, or `approved`
  - Has many versioned outputs

- `Ambiguity`
  - A flagged ambiguous term from the detector output
  - Includes category, detector, confidence, and linkage to a requirement

- `Clarification`
  - Holds the generated question and the user’s answer
  - Tracks `answered_at` for auditability

- `RequirementVersion`
  - Stores each produced translation version with confidence and timestamp
  - Enables historical review and version comparisons

- `Approval`
  - Records approval of a specific requirement version

- `DiscoveryAnswer`
  - Stores answers to project-scoping questions used for translation context

## 5. Runtime constraints and design decisions

The current project intentionally follows these patterns:

- Single-service deployment: FastAPI serves both the API and the frontend.
- Authentication is enforced on every protected route through middleware-like dependency injection.
- AI calls are centralized in `ai_provider.py` to avoid scattered provider logic and keep fallback logic in one place.
- Requirement history is preserved by versioning rather than overwriting translations.
- Local development uses SQLite; there is no PostgreSQL implementation in the current project.
- The evaluation scripts in `eval/` are treated as a separate research workflow and are not part of the main runtime path.

## 6. Current file-level structure

```text
clearreq-ai/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── ai_provider.py
│   │   ├── ambiguity.py
│   │   ├── auth.py
│   │   ├── database.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── rule_detector.py
│   │   └── schemas.py
│   └── clearreq.db
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── app.js
│       └── preview.js
├── eval/
│   ├── evaluate.py
│   ├── evaluate_conflicts.py
│   ├── evaluate_mendeley.py
│   ├── security_test.py
│   ├── test_conflicts.csv
│   └── test_requirements.csv
├── docs/
│   ├── diagram_architecture.png
│   ├── diagram_architecture.svg
│   ├── diagram_erd.png
│   ├── diagram_workflow.png
│   ├── enhanced_blueprint.md
│   └── ...
├── context/
│   ├── ai-workflow-rules.md
│   ├── architecture-context.md
│   ├── code-standards.md
│   ├── progress-tracker.md
│   ├── project-overview.md
│   ├── ui-context.md
│   └── userFlow.md
├── README.md
├── requirements.txt
└── architecture.md
```

## 7. Summary

The current project architecture is a single-service FastAPI application that combines user-owned session management, rule-based and AI ambiguity detection, clarification-driven translation, versioned requirement history, and exportable reporting. The browser UI is served directly from the same backend, with identity provided by Supabase and persistence handled through SQLAlchemy. This architecture is intentionally simple, focused, and aligned with the current implementation in this repository.
