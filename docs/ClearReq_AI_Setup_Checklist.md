# ClearReq AI — Environment Setup Checklist

Do these in order. Everything here is free.

---

## 1. VS Code

1. Download from code.visualstudio.com, install.
2. Extensions to install (Extensions panel, Ctrl+Shift+X):
   - **Python** (Microsoft) — backend development
   - **Pylance** — Python type checking / autocomplete
   - **ESLint** — if using React frontend
   - **SQLite Viewer** — inspect your `.db` file without leaving the editor
   - **GitLens** — see who changed what line, useful with two people
   - **markdownlint** — keeps your context `.md` files and thesis docs clean

No paid extensions needed for this project.

---

## 2. Git and GitHub

1. Install Git: git-scm.com (or `winget install Git.Git` on Windows).
2. Set your identity once, globally:
   ```
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```
3. Create a free GitHub account if you don't have one.
4. Create the repo on GitHub (Private is fine — you can make it public later for the thesis submission if required).
5. Clone it locally:
   ```
   git clone https://github.com/<your-org>/clearreq-ai.git
   cd clearreq-ai
   ```
6. Set up authentication — GitHub no longer accepts passwords over HTTPS:
   - Easiest: install **GitHub CLI** (`gh auth login`) and follow the browser prompt.
   - Alternative: generate a Personal Access Token (GitHub → Settings → Developer settings → Tokens) and use it as your password when Git asks.
7. Create the folder structure:
   ```
   clearreq-ai/
   ├── backend/
   ├── frontend/
   ├── eval/
   ├── docs/
   └── context/          <- your ai-workflow-rules.md etc go here
   ```
8. Create `.gitignore` in the repo root **before your first commit**:
   ```
   .env
   __pycache__/
   *.pyc
   node_modules/
   .venv/
   *.db
   .DS_Store
   ```
   This is the single most important step to do early — it stops API keys and the SQLite file from ever reaching GitHub.
9. First commit:
   ```
   git add .
   git commit -m "Initial project structure"
   git push
   ```
10. Branch workflow going forward (from your earlier plan): both of you branch off `main` per feature, open a pull request, review each other's code, then merge.

---

## 3. Python environment (backend)

1. Check you have Python 3.11+: `python3 --version`.
2. Inside `backend/`, create a virtual environment:
   ```
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate      # Windows: .venv\Scripts\activate
   ```
3. Install core packages:
   ```
   pip install fastapi uvicorn sqlalchemy pydantic python-dotenv google-generativeai groq
   ```
4. Verify the server runs (once you have a basic `main.py`):
   ```
   uvicorn main:app --reload
   ```

---

## 4. Node environment (frontend, only if using Vite + React)

1. Check Node is installed: `node --version` (18+ recommended). If not, install from nodejs.org.
2. Inside `frontend/`:
   ```
   npm create vite@latest . -- --template react
   npm install
   npm run dev
   ```
   If you'd rather skip the React/Vite setup entirely for a leaner MVP, plain HTML + JS with `fetch()` calls to your FastAPI backend works fine and has zero build step — reasonable given your hardware and timeline.

---

## 5. AI API keys — two separate things

Don't conflate these — one is for building your app, the other is for you personally getting coding help.

### A. Keys your *application* uses (Gemini + Groq)
This is the AI layer inside ClearReq AI itself — the ambiguity detector and translator.

1. **Google AI Studio (Gemini)**: go to aistudio.google.com, sign in with a Google account, generate an API key. No credit card required.
2. **Groq**: go to console.groq.com, sign up free, generate an API key.
3. Store both in a `.env` file inside `backend/` (already excluded by `.gitignore`):
   ```
   GEMINI_API_KEY=your_key_here
   GROQ_API_KEY=your_key_here
   ```
4. Never commit this file. Never paste these keys into a Claude.ai chat either — treat them like passwords.

### B. Claude.ai for coding help (you, personally — not the app)
Since you're using free Claude.ai chat rather than Claude Code:

1. Go to claude.ai, create a free account if you don't have one.
2. Create a **Project** (left sidebar → Projects → Create project). Name it "ClearReq AI".
3. Upload your six context files (`project-overview.md`, `architecture-context.md`, `code-standards.md`, `ai-workflow-rules.md`, `ui-context.md`, `progress-tracker.md`) into the Project's knowledge base.
4. Every new chat you start inside that project will already have this context loaded — you won't need to re-explain the architecture each session.
5. Update `progress-tracker.md` yourself as you go (both of you), and re-upload it periodically so the project knowledge stays current — Claude won't know what changed unless the file is updated.

---

## 6. Order of operations from here

1. Finish this environment setup (both people, separately, on your own laptops).
2. I draft the six context files based on the blueprint and diagrams already built.
3. You upload them into the Claude.ai Project.
4. You start Phase 1 (schema + FastAPI skeleton) using the Project chat for help, committing to GitHub as you go.

Once your environment is confirmed working, tell me and I'll start drafting the context files.
