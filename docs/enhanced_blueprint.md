# ClearReq AI — Enhanced Engineering Blueprint

The original plan is solid on sequencing. What's missing is the stuff that separates a demo from a product: traceability, confidence, versioning, and a data model that survives contact with real requirements. Below are the concrete additions.

---

## 1. Reframe the Core Value Prop

Right now the pitch is "detect ambiguous words → ask questions → rewrite." That's a linter, not a translator. The real value of a requirements tool is **traceability**: every final requirement should be able to answer "why does this say what it says, and who confirmed it?"

Enhanced goal:

> Convert informal client statements into development-ready requirements, with every ambiguity resolved, every clarification attributed to a person, and every translation versioned and re-approvable when the source changes.

That single sentence justifies most of the schema changes below.

---

## 2. Data Model — This Is the Part Worth Getting Right First

Your original tables are a fine start but flat. A requirement isn't a static row — it has a lifecycle and a history. Enhanced schema:

```
User
  id, name, email, role (analyst / reviewer / admin)

Project
  id, name, client_name, created_at

Session
  id, project_id, created_by, started_at, ended_at

Requirement
  id, session_id, original_text, status (draft/clarifying/translated/approved),
  created_by, created_at

RequirementVersion          <-- NEW
  id, requirement_id, version_number, translated_text,
  confidence_score, created_at, created_by

Ambiguity                    <-- NEW (replaces implicit detection)
  id, requirement_id, term, category (performance/security/scope/UX),
  detector (rule/model), confidence

Clarification
  id, ambiguity_id, question, answer, answered_by, answered_at

Approval                     <-- NEW
  id, requirement_version_id, approved_by, approved_at, notes
```

Why this matters in practice:
- **RequirementVersion** lets you re-translate when a client changes their mind without losing history — critical for audits and for "wait, what did we agree to originally?" conversations.
- **Ambiguity** as its own table (not just a detection event) lets you track which terms recur across a project — that's a dataset you can mine later to improve the detector.
- **Approval** gives you a sign-off trail. Without this, "Verified" status in your report is just a label nobody's accountable for.

---

## 3. Architecture — Split Detection From Generation Early

Don't let one AI call do both "find the ambiguity" and "write the clarification question" and "translate the final text." Three distinct responsibilities, three distinct failure modes:

```
Requirement Text
       |
       v
[Ambiguity Detector]  --- rule-based first, model-assisted later
       |
       v
[Question Generator]  --- template-driven, AI fills in specifics
       |
       v
[Clarification Store] --- structured answers, not free text where possible
       |
       v
[Translator]           --- only runs once all ambiguities resolved
       |
       v
[Confidence Scorer]    --- flags translations that still look vague
```

Practical reason: rule-based ambiguity detection (your original plan) is precise but has poor recall — it'll miss "the system should work well" if "well" isn't in your adjective list. Keep rules as a fast first pass, but plan from day one for a second pass using embeddings (compare each sentence against a bank of known-ambiguous requirement patterns) rather than bolting it on later as a rewrite.

**Confidence scoring is the piece most teams skip and regret.** A translated requirement with a confidence score of 0.55 should visibly differ in the UI from one at 0.95 — otherwise your reviewers stop trusting (or start over-trusting) the AI output.

---

## 4. Answer Structure — Prefer Structured Over Free Text

Your example uses buttons (`[Authentication] [Authorization] [Encryption] [All]`) — good instinct, but don't let it degrade into a free-text box for anything non-trivial. Free-text clarification answers are exactly the same ambiguity problem one level down. Where possible:

- Multi-select for scope questions
- Numeric input with units for performance questions ("response time" → number + ms/s dropdown, not a sentence)
- Free text only as a last resort, and when used, run it back through the ambiguity detector

---

## 5. Technology Stack — Refinements

| Layer | Original | Enhancement | Why |
|---|---|---|---|
| Backend | FastAPI | + Pydantic v2 models mirroring the DB schema | Enforces the structured-answer discipline above at the API boundary |
| Database | SQLite → Postgres | Add pgvector extension when you move to Postgres | You'll want embedding search for ambiguity detection v2 without adding a separate vector DB |
| AI Layer | "replaceable" | Wrap behind a single `AIProvider` interface with `detect_ambiguity()`, `generate_question()`, `translate()`, `score_confidence()` as separate methods | Matches the architecture split above; lets you swap models per-function, not just globally |
| Background work | none mentioned | Add a lightweight task queue (even just FastAPI `BackgroundTasks` initially, Celery/RQ later) | Translation + scoring shouldn't block the request thread once you're calling an LLM API |
| Auth | none mentioned | JWT-based auth from day one, even single-tenant | Client requirement data is sensitive; retrofitting auth later is painful |
| Observability | none mentioned | Structured logging (request → detected ambiguities → questions asked → final confidence) | This is your evaluation dataset. Without it, Phase 5 ("accuracy measurement") has nothing to measure against |

---

## 6. Revised Development Order

Your five phases are right; I'd insert one thing and reorder one thing:

**Phase 1: Foundation** — as planned, but build the full schema above now, not the flat version. Migrating a live schema mid-project is more expensive than designing it right once.

**Phase 2: Requirement Management** — as planned.

**Phase 2.5 (NEW): Logging & Evaluation Harness** — before any AI is added, build the logging pipeline and a small set of ~20 hand-labeled test requirements with known ambiguities. This costs a day and pays for itself the moment you add the intelligence layer, because you can measure precision/recall immediately instead of eyeballing it.

**Phase 3: Intelligence Layer** — as planned, but ship rule-based detection, measure it against your test set, *then* add model-assisted detection and measure the delta. Don't add AI you can't prove is better than the rules.

**Phase 4: Report** — as planned, add version history and approval trail to the export.

**Phase 5: Evaluation** — now this phase has real data to work with instead of starting cold.

---

## 7. First Milestone — Slightly Sharper Than the Original

Your original first screen is good. One addition: make "Analyze" return a structured ambiguity list even in the no-LLM version, so the frontend contract (list of `{term, category, question}` objects) doesn't change when you swap in real detection later:

```json
{
  "requirement_id": 1,
  "ambiguities": [
    { "term": "fast", "category": "performance", "question": "What is the expected response time?" }
  ]
}
```

Build the UI against this shape from day one. It means Phase 3 becomes "replace the rule engine behind this endpoint," not "redesign the frontend."

---

## 8. What I'd Deliberately Leave Out of MVP

To keep scope honest:
- Multi-tenant org/billing — single project owner is fine for now
- Real-time collaborative editing — sequential is fine
- Fine-tuned custom models — rules + prompted API model is enough to validate the idea
- Jira/Confluence integration — worth planning the schema so it's possible later (via `source_system` field on Requirement), not worth building now

---

## Next Practical Step

Same as your original list, with one addition before wireframes:

1. **Finalize the schema above** (this is the highest-leverage hour you'll spend)
2. System architecture diagram
3. Use case diagram
4. Database ERD
5. UI wireframes
6. Development repository structure

Then start coding — Phase 1, with the full schema, not the flat one.
