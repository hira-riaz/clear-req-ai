# ClearReq AI — preview run doc

No build step: this is a FastAPI backend + static HTML/JS frontend.

## Reproduce the uncommitted artifacts

Run these from the project root (`C:\Users\Hira\Desktop\clearreq-ai`):

1. Backend venv (already present at `backend/.venv`; recreate if missing):
   ```
   cd backend
   python -m venv .venv
   .venv\Scripts\python.exe -m pip install -r requirements.txt
   ```
   (requirements are in the root `requirements.txt` — install from there if backend layout changes.)
2. Backend env file — copy `backend/.env.example` to `backend/.env` and fill in
   `GEMINI_API_KEY` and `GROQ_API_KEY` (never commit or record the values).
3. The SQLite DB (`backend/clearreq.db`) is created automatically by
   `app/main.py` (`Base.metadata.create_all`) on first server start — no manual step.

## Run the servers

Two processes, started from the project root. Use the venv Python so PATH is not a factor.

1. Backend API (port 8000 — the project default; `frontend/app.js` hardcodes `API_BASE = http://127.0.0.1:8000`):
   ```
   cd backend
   .venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
   ```
   CWD must be `backend/` so the relative SQLite path `sqlite:///./clearreq.db` resolves.
2. Frontend static server (port 5500 — the project default from the README):
   ```
   cd frontend
   ..\backend\.venv\Scripts\python.exe -m http.server 5500
   ```

Then open http://127.0.0.1:5500. To preview with other ports, change the
`--port` flags and update `API_BASE` in `frontend/app.js` accordingly.
