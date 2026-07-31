# Progress tracker — ClearReq AI

Update this file as you go, and re-upload it to the Claude.ai Project
periodically so context stays current.

## Status: Phase 1 scaffold complete (starting point)

### Done
- [x] Repository structure created (backend/frontend/eval/docs/context)
- [x] Database schema implemented (SQLAlchemy models matching the ERD)
- [x] Rule-based detector implemented and smoke-tested
- [x] AI provider wrapper implemented (Gemini primary, Groq fallback)
- [x] FastAPI endpoints: `/requirements/analyze`, `/requirements/translate`,
      `/requirements/{id}`
- [x] Frontend MVP screens (input, ambiguity/clarification, result) wired
      to the backend
- [x] Starter evaluation script and 10-row labelled test set
- [x] Context files drafted

### Not started yet
- [ ] Expand test_requirements.csv to 30-50+ labelled rows
- [ ] Run full evaluation with `--with-ai` once API keys are configured
- [ ] "Start session" screen (currently hardcoded to session_id=1)
- [ ] History/list view of past requirements
- [ ] Approval workflow (Approval table exists in schema, not yet exposed
      via API or UI)
- [ ] Deployment to a free-tier host for remote demo access
- [ ] Thesis write-up sections beyond the planning document

### Known limitations to mention in the defense
- Rule-based word list is small and hand-curated — expand using
  NASA ARM / INCOSE weak-word sources before final evaluation (see
  the market-research discussion in the thesis defense guide).
- AI detector output is non-deterministic between runs.
- No auth — single-user only.

## How to update this file
After finishing a milestone, move it from "Not started" to "Done" with a
one-line note on what changed and who did it. Keep entries short — this is
a status file, not a diary.
