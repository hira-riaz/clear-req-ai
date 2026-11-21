# ClearReq AI Integration Test Results

## Execution result

| Test group | Result | Evidence |
|---|---|---|
| IT-01: frontend hosting and project/session API flow | PASS | `test_it_01_frontend_served_and_api_creates_project_session` |
| IT-02: auth identity mapping and missing-token rejection | PASS | `test_it_02_auth_identity_mapping_persists_and_missing_token_is_rejected` |
| IT-03: analyze, clarify, translate, and database persistence | PASS | `test_it_03_analysis_clarification_translation_and_database_persistence` |
| IT-04: conflict result and clarification persistence | PASS | `test_it_04_conflict_analysis_saves_conflict_and_clarification` |
| IT-05: report retrieval and DOCX generation | PASS | `test_it_05_report_retrieval_and_docx_generation` |
| Live Supabase Auth invalid-token smoke check | PASS | `test_live_supabase_auth_rejects_invalid_test_token` |
| Live AI provider smoke check | PASS | `test_live_ai_provider_smoke` |

Core suite: **5 passed, 0 failed**.  
Live smoke suite: **2 passed, 0 failed**.

## Scope and limitations

- Route and persistence tests use FastAPI `TestClient` and a temporary in-memory SQLite database. They did not read or write `backend/clearreq.db` or production data.
- The core AI workflow tests replace the external AI functions with deterministic test responses. The separate live smoke made one small AI provider request; it verifies connectivity and a response, not ambiguity or translation quality.
- The live Supabase check verifies rejection of an invalid token. It does not verify successful sign-in with a real user's access token.
- The frontend test confirms the app shell is served and the frontend's API routes work through FastAPI's test client. It does not execute the browser JavaScript or the real sign-in UI.
- In the inspected local environment, `DATABASE_URL` is empty. The backend therefore defaults to the local SQLite database, not the Supabase-managed PostgreSQL database. The test suite's in-memory persistence result is not proof of persistence to a Supabase database.
- Pytest reported existing `datetime.utcnow()` deprecation warnings in backend code and a Pydantic deprecation warning in the Google GenAI SDK. These did not fail tests and production code was not changed.

## Reproduction commands (PowerShell)

Core tests:

```powershell
$env:PYTHONPATH = '.'
$env:DATABASE_URL = 'sqlite://'
.\backend\.venv\Scripts\python.exe -m pytest -q integration_tests\test_integration.py
```

Optional live smoke checks (one small AI request and one invalid-token request to Supabase Auth):

```powershell
$env:PYTHONPATH = '.'
$env:DATABASE_URL = 'sqlite://'
$env:CLEARREQ_LIVE_SUPABASE = '1'
$env:CLEARREQ_LIVE_AI = '1'
.\backend\.venv\Scripts\python.exe -m pytest -q -rs integration_tests\test_live_smoke.py
```
