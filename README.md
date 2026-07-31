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
pip install -r requirements.txt
cp .env.example .env                # then fill in your API keys
uvicorn app.main:app --reload
```

The API will be running at http://127.0.0.1:8000 — visit
http://127.0.0.1:8000/docs for the interactive API explorer FastAPI generates
automatically.

## Frontend setup

No build step required. Open `frontend/index.html` directly in a browser, or
serve it locally:

```
cd frontend
python -m http.server 5500
```

Then visit http://127.0.0.1:5500. The frontend expects the backend to be
running at http://127.0.0.1:8000 (see `API_BASE` at the top of `app.js`).

## Running the evaluation

```
cd eval
python evaluate.py
```

This runs both detectors against `test_requirements.csv` and prints a
precision / recall / F1 comparison table.

## Environment variables (`backend/.env`)

```
GEMINI_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
```

Get a free Gemini key at https://aistudio.google.com and a free Groq key at
https://console.groq.com. Never commit this file — it's already excluded in
`.gitignore`.
