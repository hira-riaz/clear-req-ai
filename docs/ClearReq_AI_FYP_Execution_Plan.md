# ClearReq AI — FYP Execution Plan (2 people, 8GB RAM, $0 budget)

## 1. The One Rule That Makes This Feasible

**All AI inference happens over the internet, never on your laptop.** Your machine only ever runs FastAPI + SQLite + a lightweight frontend dev server — that's under 1GB RAM combined. The "AI layer" is just HTTP calls to a free API.

This also solves your "no budget" problem, not just your RAM problem.

---

## 2. Which Free APIs to Actually Use

As of mid-2026, stack these two — don't rely on one:

| Provider | Why | Free limit (approx) |
|---|---|---|
| **Google AI Studio (Gemini Flash)** | Best quality-for-free, no credit card needed, huge context window | <cite index="10-1">1,500 requests/day, no credit card, no expiry</cite> |
| **Groq (Llama 3.3)** | Fallback when Gemini rate-limits you, extremely fast responses (good for live demo) | <cite index="11-1">30 requests/minute, 1,000 requests/day</cite> |

Sign up for both keys on day one. Write your `AIProvider` wrapper (from the earlier blueprint) so it tries Gemini first, falls back to Groq on a 429 error. This also becomes a legitimate engineering talking point in your defense: "we designed for provider failure, not just happy path."

Avoid OpenAI's API — <cite index="10-1">it requires a credit card and has no indefinite free tier</cite>. Avoid running anything via Ollama locally — technically possible with a tiny quantized model, but not worth the RAM fight for a demo that needs to be reliable in front of a panel.

---

## 3. Cut the Scope — Hard

Forget Postgres, pgvector, Celery, JWT auth, multi-tenant anything. For a two-person FYP, here is the entire system:

```
SQLite (single file, zero setup)
        |
FastAPI backend (one process)
        |
Simple frontend (plain HTML/JS or minimal Vite+React — no heavy component libs)
        |
AIProvider wrapper → Gemini (primary) → Groq (fallback)
```

That's it. No Docker required — `uvicorn` running locally is enough for both development and your live demo.

**Cut list (do not build these for the thesis):**
- Multi-user accounts / login system → single-user is fine, mention it as "future work"
- Real-time collaboration
- Approval workflow with multiple reviewers
- Anything involving deployment infrastructure

**Keep list (this is what actually makes it a thesis, not a script):**
- The versioned requirement schema (Section 2 of the earlier blueprint) — this is your novelty
- Confidence scoring
- The rule-based vs. AI-based comparison (see below — this is your actual research contribution)

---

## 4. This Is What Makes It Defensible Nationally

A panel doesn't get impressed by a working CRUD app with an AI call bolted on — every FYP has one of those now. What makes yours defensible is a **measured comparison**, because that's a research claim, not just an engineering claim.

Concretely:

1. Get the **PROMISE NFR dataset** (a well-known public dataset of real software requirements, used in academic requirements-engineering research) or hand-label 30–50 sample requirements yourselves with known ambiguities.
2. Build your rule-based detector first (word lists — cheap, explainable).
3. Run the same test set through Gemini/Groq with a well-designed prompt.
4. Report **precision, recall, and F1** for both approaches, side by side.
5. Your thesis claim becomes: *"Rule-based detection achieves X% precision but Y% recall; LLM-assisted detection improves recall to Z% at the cost of some false positives, and combining both yields the best F1."*

That's a defensible, quantified, non-trivial claim. It also means your app doesn't need to be flawless — your *evaluation methodology* is the contribution, and a panel respects rigor over polish.

---

## 5. Two-Person Split

Don't split "frontend vs backend" — split by **who owns what's defensible**.

**Person A — System & Backend**
- FastAPI, SQLite schema, AIProvider wrapper, rule-based detector
- Owns the architecture diagram and can explain every request's lifecycle in the defense

**Person B — Evaluation & Frontend**
- Builds the test dataset, runs the precision/recall comparison, owns the results chapter
- Builds the minimal UI (just enough to demo live — input box, ambiguity list, clarification questions, final translation)

Both of you should be able to explain the whole system — panels ask "you" not "your teammate" — but having one clear owner per deliverable avoids the classic FYP failure mode of both people lightly touching everything and neither being deeply fluent in any part.

---

## 6. Suggested Timeline (assuming ~5-month FYP window)

| Weeks | Milestone |
|---|---|
| 1–2 | Finalize schema, set up FastAPI + SQLite skeleton, get both API keys working |
| 3–4 | Build rule-based detector + hand-label/collect test dataset |
| 5–6 | Wire up Gemini/Groq for detection + question generation, minimal UI |
| 7–8 | Translation engine + confidence scoring |
| 9–10 | Run full evaluation (precision/recall/F1), write results |
| 11–12 | Polish demo flow, prepare slides, rehearse live demo with fallback plan (screen recording backup in case wifi fails during defense) |
| Remaining | Buffer + writing the thesis document itself |

---

## 7. Demo-Day Practical Advice

- **Record a backup demo video.** University wifi during a defense is not to be trusted. If the live API call hangs, you switch to the recording without missing a beat.
- **Pre-warm your API keys** the morning of — free tiers occasionally have cold-start latency.
- **Show the comparison table, not just the app.** A slide with your precision/recall numbers next to a screenshot of the working translator is more convincing to a panel than five minutes of clicking through the UI.
- **Have Groq as your live fallback** during the demo itself, not just in code — if Gemini free tier is rate-limited from the whole class demoing that day, you want your literal backup ready.

---

## 8. Bottom Line

You don't need budget or a powerful machine — you need a scoped system, one clean research comparison, and a rehearsed demo with a fallback. The full enterprise blueprint from before is your *roadmap for after graduation*, not your thesis scope.
