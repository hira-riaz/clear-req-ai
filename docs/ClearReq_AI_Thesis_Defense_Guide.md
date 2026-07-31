# ClearReq AI — Thesis Defense Preparation Guide

A defense is not a test of whether your app works. It's a test of whether *you* understand every decision behind it well enough to justify it under pressure. Everything below is built around that.

---

## 1. Presentation Structure (10–15 slides, ~15–20 min talk)

1. **Title slide** — project name, both names, supervisor, university
2. **Problem statement** — one sentence: ambiguous client requirements cause rework; existing tools are costly or discontinued
3. **Related work** — QVscribe (commercial), NASA ARM / QuARS / RETA (academic), recent LLM-based ambiguity research — position your project as replicating an active research question at small scale
4. **Objectives** — the 5 bullet points from your planning document
5. **System architecture** — Figure 1 from your Word doc
6. **Workflow / lifecycle** — Figure 2
7. **Database design** — Figure 3, briefly, don't over-explain every field
8. **The core contribution: rule-based vs AI-assisted detection** — this is your most important slide. State the comparison clearly before showing numbers.
9. **Evaluation results** — precision / recall / F1 table, one clear takeaway sentence
10. **Live demo** (or recorded backup) — 2–3 minutes, one clear example end-to-end
11. **Limitations** — say these yourself before the panel finds them (see Section 3)
12. **Future work** — multi-tenant, Jira/Confluence integration, fine-tuned detection model
13. **Conclusion** — restate the contribution in one sentence
14. **Thank you / questions**

Rule of thumb: if a slide doesn't help you answer "why does this project deserve a passing grade," cut it.

---

## 2. How to Talk About the Comparison (Your Strongest Card)

Panels reward projects that **know their own limitations and measured them**, not projects that claim perfection. Practice saying this fluently, not reading it:

> "We didn't just wire up an AI model and call it done. We built a rule-based baseline first, measured its precision and recall against a labelled test set, then measured the AI-assisted approach on the same set, and compared them directly. That comparison — not the app itself — is the core contribution."

If your numbers show the AI approach is better on recall but worse on precision (very likely, given how these detectors behave), say that plainly. A panel trusts a "some tradeoffs" result far more than a "our approach is perfect" claim.

---

## 3. Say Your Own Limitations First

This is the single highest-leverage defense tactic. Panels probe for weaknesses — if you've already named them and explained why they're acceptable for an FYP scope, there's nothing left to catch you on.

Likely limitations to state upfront:
- **Small test set.** If you hand-labelled 30–50 requirements rather than thousands, say so, and explain that the *methodology* generalizes even if the sample size is FYP-scale.
- **Single-user, no auth.** State it was intentionally out of scope to focus effort on the detection/evaluation contribution.
- **SQLite, not Postgres.** Explain this was a deliberate scope decision given the project size, not a lack of knowledge — you know how you'd migrate it (mention pgvector/Postgres from the earlier blueprint if asked).
- **Free-tier API dependency.** Acknowledge that rate limits are a constraint of the zero-budget approach, and explain your Gemini→Groq fallback exists specifically because of this.
- **AI non-determinism.** The AI detector can give slightly different results on reruns — mention you observed this and either averaged over multiple runs or noted it as a known limitation.

---

## 4. Anticipated Questions and How to Answer Them

**"Why is this different from QVscribe / existing tools?"**
> Existing commercial tools like QVscribe are Word-integrated, rule/pattern-based, and often costly or enterprise-focused. We add a direct, measured comparison against an LLM-based approach on the same data — which is closer to current academic research than what's in most existing commercial tools.

**"Why not just use the AI for everything? Why bother with rules at all?"**
> Because the comparison itself is the contribution. Also, rule-based detection is fast, free, deterministic, and fully explainable — useful properties an LLM doesn't have. We wanted to show where each is actually stronger, not just pick the fancier one.

**"How do you know your AI detector is accurate and not just confidently wrong?"**
> That's exactly why we measured precision/recall against a labelled set instead of trusting it blindly. We can show you where it disagreed with the rule-based detector and with the ground truth.

**"Isn't your dataset too small / biased to generalize?"**
> Yes, and we say so directly in our limitations. The contribution is the evaluation methodology, which would scale to a larger dataset — we're demonstrating the approach is sound, not claiming production-scale validation.

**"What happens if the AI API is down or rate-limited during real use?"**
> That's exactly why we built the Gemini-to-Groq fallback in the AIProvider layer — [briefly explain the wrapper]. If both fail, the rule-based detector still runs independently.

**"Why did two of you split the work this way? What did each person actually do?"**
> [Have this answer ready individually, not jointly — panels sometimes ask each student separately.] Be ready to explain your own contribution in detail without relying on your teammate to fill gaps.

**"Is this just a wrapper around ChatGPT/Gemini? What's the actual engineering contribution?"**
> The engineering contribution is the schema (versioned, traceable, attributable clarifications), the dual-detector architecture, and the evaluation harness — not the API call itself. Anyone can call an LLM API; the contribution is what surrounds it and how it's measured.

**"How would this scale to a real company's requirements process?"**
> Point to the future-work items from the enhanced blueprint: multi-tenant auth, Postgres + pgvector for larger-scale similarity search, integration with tools like Jira/Confluence via the `source_system` field already designed into the schema.

---

## 5. Demo Strategy

- Lead with the **comparison table**, not the UI. A slide with precision/recall numbers next to a live screenshot is more convincing than five minutes of clicking.
- Have a **recorded backup** of the live demo — university wifi during a defense is not to be trusted.
- Pre-warm your API keys the morning of.
- Pick **one clear example** for the live walkthrough (the "manage/fast/secure" example we've used throughout this conversation works well — it's simple, and you can explain every step from memory).
- If the demo breaks live, don't panic-debug in front of the panel — switch to the recording and keep talking.

---

## 6. Rehearsal Checklist

- Practice the 15–20 minute talk out loud, timed, at least 3 times before the actual defense.
- Do at least one full run where your teammate (or a friend) interrupts you with random questions mid-slide — defenses are rarely a clean, uninterrupted talk.
- Both of you should be able to answer *any* question about the whole system, not just your own module — but you should each own deep, fluent explanations of your part.
- If you don't know an answer in the real defense: **say so honestly and reason through it out loud** rather than guessing confidently. Panels respect "I haven't tested that specific case, but based on the architecture I'd expect X" far more than a made-up answer that falls apart under a follow-up question.

---

## 7. The One Sentence to Have Ready at All Times

If a panel member interrupts and says "just tell me in one sentence what this project actually does" — have this memorized, not read:

> "ClearReq AI turns vague client requirements into clear, traceable, development-ready requirements, and measures whether rule-based or AI-assisted detection does that job better."

Everything else in your defense is elaboration on that one sentence.
