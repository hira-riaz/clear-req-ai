# ClearReq AI

An AI-assisted requirements translator that detects ambiguity in informal client
requirements, asks structured clarification questions, and produces clear,
versioned, development-ready requirement translations.

See `docs/` for the architecture diagrams and the full planning document, and
`context/` for the project knowledge files used with Claude.ai.

## Project layout

```
clearreq-ai/
├── backend/      FastAPI app, SQLite database, rule-based + AI detectors
├── frontend/     Plain HTML/JS UI (fetches from the backend API)
├── eval/         Labelled test set + precision/recall/F1 evaluation script
├── docs/         Architecture diagrams, ERD, planning documents
└── context/      Project knowledge files (for Claude.ai Projects)
```

## Backend setup

```
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r ..\requirements.txt
cp .env.example .env                # then fill in your API keys
uvicorn app.main:app --reload
```

The API will be running at http://127.0.0.1:8000 — visit
http://127.0.0.1:8000/docs for the interactive API explorer FastAPI generates
automatically.

## Frontend setup

No build step required. Because the frontend uses JavaScript modules, serve
`frontend/index.html` over HTTP rather than opening it as a `file://` URL:

```
cd frontend
python -m http.server 5500
```

Then visit http://127.0.0.1:5500. The frontend expects the backend to be
running at http://127.0.0.1:8000. When serving the frontend separately, set
`window.CLEARREQ_API_BASE` before `app.js` loads, for example:

```html
<script>window.CLEARREQ_API_BASE = "http://127.0.0.1:8000";</script>
<script type="module" src="app.js"></script>
```

For the local frontend server, add the configuration script to
`frontend/index.html` before the module script, or use the same setting in your
static host's runtime HTML configuration. No frontend `.env` file is used:
plain browser JavaScript cannot read one without a build step. The frontend
gets the public Supabase project URL and anon key from the backend's
`/public-config` endpoint.

## Supabase Auth setup

1. Create a Supabase project and enable the sign-in providers you want under
   **Authentication → Providers**. Configure the site's URL and allowed
   redirect URLs in **Authentication → URL Configuration**.
2. Copy the project URL and its public **anon/publishable key** into
   `backend/.env` (start from `backend/.env.example`):

   ```dotenv
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_ANON_KEY=your-public-anon-key
   ```

   Set the same variables in the backend deployment environment. Never use
   `service_role`/secret keys in this application.
3. Install the backend requirements and start FastAPI as described above.
   The frontend initializes `@supabase/supabase-js` from the Supabase ESM CDN;
   the browser therefore needs network access to `esm.sh` and your Supabase
   project.
4. Users sign in or sign up through Supabase Auth. The SDK manages browser
   session persistence and token refresh. Protected API requests send its
   access token as a bearer token; the backend calls Supabase Auth's
   `get_user(token)` before allowing access.
5. On first sign-in, the backend creates a local ownership record keyed by
   Supabase's immutable user ID. Existing local projects are linked only when
   Supabase confirms the account's email and it matches an unlinked legacy
   account.

On startup, the backend migrates the existing `users` table by adding the
Supabase subject column and dropping the old `password_hash` column. This
intentionally removes local password hashes; back up the database first if you
need a rollback. Existing project/session data remains and can be linked by
the verified-email rule above.

## Running the evaluation

```
cd eval
python evaluate.py
```

This runs both detectors against `test_requirements.csv` and prints a
precision / recall / F1 comparison table.

## Other backend environment variables (`backend/.env`)

```
GEMINI_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
```

Get a free Gemini key at https://aistudio.google.com and a free Groq key at
https://console.groq.com. Never commit this file — it's already excluded in
`.gitignore`.
