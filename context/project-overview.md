# Project overview — ClearReq AI

## What this is
ClearReq AI is a final year project: a requirements translation tool that
helps requirement engineers, business analysts, and developers convert
informal client statements into clear, development-ready requirements.

## The problem
Clients describe what they want in vague language ("the system should be
fast," "make it secure"). This ambiguity, if left unresolved, propagates
into design, implementation, and testing, causing rework and disputes.

## What it does
1. Detects ambiguous terms in a submitted requirement using two independent
   methods: a rule-based word/pattern matcher and an AI-assisted detector.
2. Generates structured clarification questions for each detected ambiguity.
3. Records attributable answers.
4. Translates the clarified requirement into precise, development-ready text
   with a confidence score.
5. Keeps a versioned, auditable history of every requirement.

## The research contribution
The core academic contribution is NOT the app — it's a measured comparison
of rule-based vs. AI-assisted ambiguity detection, scored with precision,
recall, and F1 against a labelled test set. See eval/evaluate.py.

## Team
Two-person FYP team.
- Member A owns: backend, database schema, AI provider wrapper, rule-based
  detector.
- Member B owns: evaluation harness, test dataset, frontend UI.

## Constraints that shaped every decision
- $0 budget — all AI inference happens via free-tier cloud APIs (Gemini
  primary, Groq fallback), never locally.
- 8GB RAM laptops — no local model hosting.
- Two-person team — scope is deliberately cut down from an enterprise
  version of this idea (see docs/enhanced_blueprint.md for what was cut
  and why).

## Out of scope for this project (explicitly)
- Multi-tenant accounts / billing
- Real-time collaborative editing
- Fine-tuned custom models
- Third-party integrations (Jira/Confluence) — schema allows for it later
  via a `source_system` field, but it is not built now.
