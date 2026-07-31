# Code standards — ClearReq AI

## Python (backend)
- Follow PEP 8. 4-space indentation, snake_case for functions/variables,
  PascalCase for classes.
- Type hints on all function signatures (see existing files for the style).
- One responsibility per module: `rule_detector.py` only detects, only
  `ai_provider.py` talks to external AI APIs, `main.py` only orchestrates
  routes — it should not contain detection or translation logic itself.
- Never hardcode API keys. Always load from `.env` via `python-dotenv`.
- Database session handling: always use the `get_db` FastAPI dependency,
  never open a session manually inside a route.
- Docstrings on every module explaining its role in the pipeline (see
  existing files as the template) — this makes the codebase self-explaining
  for the thesis writeup.

## JavaScript/HTML (frontend)
- No frameworks required for the MVP — plain HTML + vanilla JS with
  `fetch()`. If the team later adds Vite+React, keep components small and
  colocate state with the component that owns it.
- `API_BASE` constant at the top of `app.js` is the only place the backend
  URL should appear — never hardcode it elsewhere.
- All backend calls should have error handling (try/catch around fetch)
  and disable the triggering button while in flight, per the existing
  `analyzeBtn`/`translateBtn` pattern.

## Git / GitHub
- `main` branch stays demoable at all times.
- One feature branch per unit of work: `feat/<short-description>`.
- Pull requests reviewed by the other team member before merging — this
  produces the contribution record referenced in the thesis defense guide.
- Commit messages: short imperative sentence ("Add confidence scoring to
  translate endpoint"), not "fixed stuff" or "update".
- Never commit `.env`, `*.db`, or `node_modules/` — already covered by
  `.gitignore`, but double-check before `git add .`.

## Naming conventions specific to this project
- "Ambiguity" always refers to a single flagged term (DB entity + concept).
- "Clarification" always refers to the question+answer pair for one
  ambiguity — never use it to mean the whole clarification phase.
- "Requirement" is the original text; "RequirementVersion" is a translated
  output. Never conflate the two in code or writing.
