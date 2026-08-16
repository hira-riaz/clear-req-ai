# ClearReq AI — Full System Context

Single source of truth for the current state of the project. Replace
`context/progress-tracker.md` with this file, upload it to your Claude.ai
Project, and commit it to the repo. Update it after any real work session.

---

## 1. What this project is

ClearReq AI is an AI-assisted requirements translator: it detects
ambiguous terms in informal client requirements, asks structured
clarification questions (via clickable options, not free text), checks
for conflicts with other requirements in the same session, and produces
clear, versioned, development-ready translations. The core academic
contribution is a measured comparison of rule-based vs. AI-assisted
ambiguity detection (see Section 6).

Two-person FYP team. Member A: backend, schema, detectors, AI provider.
Member B: evaluation, dataset, frontend.

---

## 2. Tech stack

- **Backend:** Python, FastAPI, SQLAlchemy, SQLite
- **AI layer:** Google Gemini (`gemini-2.5-flash-lite`, primary) → Groq
  (`llama-3.3-70b-versatile`, fallback), both free-tier, no budget required
- **Rule-based detection:** lexicon matching + spaCy POS-tagging
- **Frontend:** plain HTML/CSS/JS, no build step, no framework
- **Report export:** python-docx
- **Version control:** Git + GitHub

---

## 3. Architecture

```
Frontend (plain HTML/JS)
      |
FastAPI backend (backend/app/main.py)
      |
      +---> Rule-based detector (rule_detector.py): lexicon + spaCy POS
      |
      +---> AI provider (ai_provider.py): Gemini -> Groq fallback
      |        - detect_ambiguity()
      |        - generate_answer_options()
      |        - check_conflicts()
      |        - translate() / translate_and_verify()
      |
SQLite database (backend/clearreq.db — NOT committed to git)
```

**Full session workflow (in order):**
1. `POST /sessions` — start a project/session
2. Project discovery — 6 fixed questions (platform, users, existing
   system?, sensitive data?, scale, constraints), clickable + skippable,
   saved via `POST /sessions/{id}/discovery`
3. Loop: `POST /requirements/analyze` — detects ambiguity (rule + AI,
   merged/deduped by term), checks conflicts against prior translated
   requirements in the session, generates clickable answer options
4. User resolves each ambiguity one at a time (clickable options, a
   "reused from earlier" suggestion if the same term was answered before
   in this session, or free-text "Other...")
5. `POST /requirements/translate` — composes final text using
   clarifications + prior session translations (consistency) + discovery
   answers (context) + `translate_and_verify` self-check (re-runs rule
   detection on the AI's own output, retries once if it reintroduced
   vagueness, lowers confidence if still unresolved)
6. "Finish & review" — `PATCH /requirements/{id}/edit` lets the user
   hand-edit any translation (creates a new version, never overwrites);
   "History" shows every version with confidence + timestamp
7. "Generate report" — one consolidated document (numbered translated
   requirements) + appendix (original client wording, verbatim)
8. `GET /sessions/{id}/report/docx` — same report as a downloadable Word file

---

## 4. Database schema

```
User        — id, name, email, role                         (table exists, no API yet)
Project     — id, name, client_name, created_at
Session     — id, project_id (FK), started_at, ended_at
Requirement — id, session_id (FK), original_text, status, created_at
Ambiguity   — id, requirement_id (FK), term, category, detector, confidence
Clarification — id, ambiguity_id (FK), question, answer, answered_at
RequirementVersion — id, requirement_id (FK), version_number,
              translated_text, confidence_score, created_at
              (versioned by design — never overwritten)
Approval    — id, requirement_version_id (FK), approved_by, approved_at, notes
              (table exists, no API yet)
DiscoveryAnswer — id, session_id (FK), question, answer, answered_at
```

Full diagram: `docs/diagram_erd.png`. Note: `User` and `Approval` tables
exist in the schema but have no endpoints touching them yet — future work,
not a bug.

---

## 5. Features built and working (tested end to end)

- [x] Full session workflow (discovery → requirements loop → review/edit → report)
- [x] Dual detection: lexicon (NASA ARM / INCOSE / Hooks-sourced word list)
      + spaCy POS-tagging, merged and deduplicated
- [x] AI-assisted detection (Gemini → Groq fallback)
- [x] Clickable clarification options (AI-generated, 3-4 per ambiguity,
      plus "Other..." free-text fallback)
- [x] Session memory — a term already clarified earlier in the session is
      suggested (not re-asked from scratch) on later requirements
- [x] Conflict detection — new requirements checked against
      already-translated ones in the same session; conflicts render as a
      distinct red/warning card in the UI
- [x] Discovery-context-aware translation — project discovery answers are
      injected into the translation prompt for grounding
- [x] Output self-verification (`translate_and_verify`) — re-checks the
      AI's own translated output for reintroduced vagueness, retries once,
      lowers confidence if still unresolved
- [x] Versioned edit history, viewable per requirement
- [x] Word document export of the final report
- [x] XSS protection — all dynamic content escaped before `innerHTML`
      insertion (`escapeHtml()` in app.js)
- [x] Prompt-injection / input validation — Pydantic validators reject
      HTML/script-like content at the API boundary before it reaches any
      AI prompt or the database (see `backend/app/schemas.py`)
- [x] DB path pinned to the backend module directory (not CWD-relative)

## Known limitations (say these yourself in the defense)

- No auth / single-user only — deliberate scope decision
- Ambiguity detection is lexical-only (Option A scope) — underspecification
  (missing parameters, not vague wording) is explicitly out of scope
- CORS is wide open (`allow_origins=["*"]`) — fine for local dev/demo,
  would need tightening before any real deployment
- No background job queue — AI calls are synchronous; acceptable at this
  scale, a known tradeoff if scaling up
- Wizard state lives in frontend JS variables only — a page refresh mid-session
  loses in-progress UI state (though saved data in the DB is safe)
- N+1 query pattern in the report/export endpoints — fine at demo scale,
  would need batching before scaling to hundreds of requirements

---

## 6. Evaluation — the actual thesis numbers

**Dataset:** 26 independently hand-labelled requirement sentences (mix of
self-written across multiple app domains + candidates sourced from the
PROMISE NFR dataset, not yet merged in — see Section 8). Labelled
separately by both team members; 80% raw agreement on the first 15-sentence
batch; 3 items kept as documented disputes rather than forced to consensus
(scored using rater A's labels — stated explicitly as a methodological
choice in the write-up).

**Word list sources (cited, not invented):** NASA SATC ARM tool "weak
phrases" list (Wilson, 1997); INCOSE Guide for Writing Requirements v4,
Rules R7 and R34; Hooks (1993), "Writing Good Requirements."

**Results (26-row dataset):**

| Method | Precision | Recall | F1 |
|---|---|---|---|
| Rule-based: lexicon only | 0.20 | 0.15 | 0.17 |
| Rule-based: POS-tagging only | 0.22 | 0.31 | 0.26 |
| Rule-based: combined (lexicon + POS) | 0.19 | 0.38 | 0.25 |
| AI-assisted (mean of 3 runs) | 0.22 | 0.85 | 0.35 |

AI non-determinism check: recall was identical across all 3 runs (0.85);
precision varied only 0.22–0.23. Stable in practice on this dataset.

**Headline finding:** each rule-based refinement trades a little precision
for meaningfully more recall; the AI detector sits in a different regime
entirely (far higher recall, comparable precision to POS-tagging).

**Scope decision (Option A):** ambiguity = lexical/unmeasurable wording
only. Underspecification (missing detail, e.g. "notifications" without a
defined channel) is explicitly excluded and documented as a distinct,
out-of-scope problem class.

---

## 7. Real-world validation encountered during testing (cite these — good defense material)

- **Gemini quota exhaustion mid-eval-run** → Groq fallback fired
  transparently, no pipeline interruption. Validates the resilience design
  under genuine load, not just in theory.
- **Contradictory translation output** (a conflict-resolution answer
  produced "shall X, but shall not X") → root-caused to an under-specified
  translation prompt, fixed by adding explicit single-statement and
  override rules. Directly motivated `translate_and_verify`.
- **Prompt injection test** — submitting `<script>console.log('Test')</script>`
  as a requirement three times produced three different AI behaviors,
  including once treating it as a legitimate feature request. Directly
  motivated input validation at the API boundary (not just frontend
  escaping) — a stronger, defense-in-depth security story than a simple
  XSS fix alone.
- **"A certain threshold" bug** — a clarified numeric answer got diluted
  into vague placeholder language during translation composition. This is
  the concrete example motivating the output self-verification retry.

---

## 8. Not yet done

- [ ] Expand test dataset beyond 26 rows using PROMISE NFR sentences
      (20 candidates already selected, not yet labelled/merged — team
      decided to pause this given time constraints; documented as a
      conscious scope decision, not an oversight)
- [ ] Category-level (performance/security/scope/UX) results breakdown
- [ ] Risk Insight panel using published CHAOS Report statistics
      cross-referenced against session ambiguity/conflict counts
      (discussed, not built — real citable data identified, see below)
- [ ] Session resumability on page refresh (sessionStorage rehydration)
- [ ] Remove dead/commented-out code in app.js if any remains from prior edits
- [ ] Full thesis document assembly (abstract, results, limitations,
      discussion — all raw material exists across this conversation)
- [ ] Defense slide deck

**Citable data identified for the Risk Insight feature, if built later:**
Standish Group CHAOS Report figures (widely republished in RE academic
literature): incomplete/changing requirements rank among the top 2-3
causes of challenged or failed software projects (~12-13% each). Caveat to
state honestly: the CHAOS Report's methodology has documented validity
criticisms in the RE research community — cite alongside the numbers, not
instead of them.

---

## 9. Git / repo notes (important — avoid repeating a past incident)

- **`backend/clearreq.db` must never be tracked in git** — it's runtime
  data, not source, and was the direct cause of repeated merge conflicts.
  Already removed from tracking (`git rm --cached`) and added to
  `.gitignore`. If it reappears in `git status` as trackable, something
  regressed — fix `.gitignore` immediately.
- **Past incident (resolved):** a merge conflict between `main` and
  `newFeature` was resolved by keeping `main`'s old file versions instead
  of `newFeature`'s newer ones, silently dropping several commits' worth of
  feature work even though the merge commit itself looked "complete" in
  git's history. Recovered via `git checkout <good-commit> -- <paths>`.
  **Lesson for future merges:** after any merge with conflicts, always
  verify with `findstr`/`grep` that key recent functions/features are
  actually present in the result — don't trust "merge succeeded" alone.
- Branch workflow going forward: keep `main` always demoable, use
  short-lived feature branches, merge promptly (don't let a branch outlive
  its purpose by accumulating many commits before merging), delete
  branches after merging.

---

## 10. Environment setup notes (for a fresh machine / teammate)

- Python 3.12 required (3.14 breaks `pydantic-core` wheel builds on Windows)
- `pip install -r requirements.txt` then `python -m spacy download en_core_web_sm`
- `.env` needs `GEMINI_API_KEY` and `GROQ_API_KEY` (both free tier, no card)
- Windows: if `.venv\Scripts\activate` is blocked, run
  `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` once
- Run backend from inside `backend/` specifically:
  `uvicorn app.main:app --reload`
- Frontend: `python -m http.server 5500` from inside `frontend/`, or open
  `index.html` directly