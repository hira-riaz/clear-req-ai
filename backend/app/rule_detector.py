"""
Rule-based ambiguity detector — combines two independent methods:

1. Lexicon matching (detect_lexicon): exact word/phrase matches against a
   list sourced from published requirements-engineering literature. Fast,
   deterministic, fully explainable, but limited to words it was told about.

2. POS-tagging (detect_pos): uses spaCy to flag adjectives describing the
   requirement that aren't paired with a measurable quantity anywhere in
   the sentence, and aren't on a "safe" allowlist. This generalizes beyond
   the fixed lexicon — it can catch vague adjectives never explicitly
   listed (e.g. a word like "seamless" that isn't in WEAK_WORDS).

detect() combines both, deduplicated by term. Both sub-methods are also
exposed separately so eval/evaluate.py can score each in isolation and
compare them against the AI-assisted detector.

Word list sourced from three published references (see docs/ for full
citations):
  - NASA SATC's ARM tool "weak phrases" list (Wilson, 1997)
  - INCOSE Guide for Writing Requirements v4, Rule R7 (vague terms) and
    Rule R34 (measurable performance)
  - Hooks (1993), "Writing Good Requirements" — commonly cited ambiguous
    word list in requirements engineering literature
"""
import spacy

try:
    _nlp = spacy.load("en_core_web_sm")
except OSError:
    _nlp = None
    print(
        "[rule_detector] spaCy model 'en_core_web_sm' not found. "
        "Run: python -m spacy download en_core_web_sm"
    )

WEAK_WORDS = {
    # Performance — unmeasurable quantification (NASA ARM 8.1.5, INCOSE R34)
    "fast": "performance",
    "rapid": "performance",
    "quick": "performance",
    "prompt": "performance",
    "timely": "performance",
    "efficient": "performance",
    "minimize": "performance",
    "maximize": "performance",
    "optimum": "performance",

    # Security — commonly flagged unmeasurable quality term in RE literature
    "secure": "security",
    "safe": "security",

    # UX — fuzzy/subjective words (NASA ARM 8.1.6, Hooks 1993)
    "easy": "UX",
    "user-friendly": "UX",
    "simple": "UX",
    "intuitive": "UX",
    "adequate": "UX",
    "effective": "UX",
    "sufficient": "UX",
    "normal": "UX",

    # Scope — vague quantifiers and escape clauses (INCOSE R7, NASA ARM weak
    # phrases, NASA ARM "options" category)
    "several": "scope",
    "many": "scope",
    "a lot of": "scope",
    "a few": "scope",
    "some": "scope",
    "any": "scope",
    "allowable": "scope",
    "close to": "scope",
    "about": "scope",
    "approximately": "scope",
    "nearly": "scope",
    "almost always": "scope",
    "as appropriate": "scope",
    "as applicable": "scope",
    "as a minimum": "scope",
    "be able to": "scope",
    "be capable": "scope",
    "capability of": "scope",
    "capability to": "scope",
    "but not limited to": "scope",
    "robust": "scope",
    "flexible": "scope",
    "scalable": "scope",
    "usually": "scope",
    "typically": "scope",
    "correctly": "scope",
}

QUESTION_TEMPLATES = {
    "performance": "The requirement says '{term}' — what is the measurable target (e.g. response time, throughput)?",
    "security": "The requirement says '{term}' — which specific security controls are required (e.g. authentication, encryption)?",
    "UX": "The requirement says '{term}' — what standard should this be measured against (e.g. click count, training needed)?",
    "scope": "The requirement says '{term}' — what exactly should the system be able to do here?",
}

# Adjectives that are concrete/unambiguous, not vague — excluded from the
# POS-based detector to keep false positives manageable. Not exhaustive;
# expand as you observe over-flagging during testing.
SAFE_ADJECTIVES = {
    "online", "offline", "digital", "physical", "registered", "external",
    "internal", "primary", "secondary", "additional", "optional",
    "following", "above", "below", "current", "previous", "specific",
    "particular", "related", "associated", "given", "required", "selected",
    "available", "public", "private", "virtual", "mobile", "desktop",
    "annual", "monthly", "daily", "weekly", "static", "dynamic", "binary",
    "unique", "identical", "empty", "null", "valid", "invalid", "active",
    "inactive", "visible", "hidden", "open", "closed", "new", "old",
    "last", "first", "next", "same", "different", "separate", "single",
    "multiple", "numeric", "alphabetic", "mandatory",
}


def detect_lexicon(text: str) -> list[dict]:
    """Scan requirement text for known weak/ambiguous words (exact match)."""
    lowered = text.lower()
    found = []
    for word, category in WEAK_WORDS.items():
        if word in lowered:
            found.append({
                "term": word,
                "category": category,
                "detector": "rule-lexicon",
                "confidence": 1.0,  # rule matches are certain by construction
                "question": QUESTION_TEMPLATES[category].format(term=word),
            })
    return found


def detect_pos(text: str) -> list[dict]:
    """
    POS-tagging based detector (spaCy): flags adjectives that aren't paired
    with a measurable quantity anywhere in the sentence, and aren't on the
    SAFE_ADJECTIVES allowlist. Generalizes beyond the fixed lexicon.
    """
    if _nlp is None:
        return []

    doc = _nlp(text)
    has_number = any(
        tok.like_num or tok.ent_type_ in ("CARDINAL", "PERCENT", "QUANTITY", "TIME")
        for tok in doc
    )
    if has_number:
        return []  # a measurable quantity is already present in this sentence

    found = []
    seen = set()
    for tok in doc:
        if tok.pos_ != "ADJ":
            continue
        lemma = tok.lemma_.lower()
        if lemma in SAFE_ADJECTIVES or lemma in seen:
            continue
        seen.add(lemma)
        found.append({
            "term": tok.text.lower(),
            "category": "scope",  # generic; lexicon owns precise categories
            "detector": "rule-pos",
            "confidence": 1.0,
            "question": f"The requirement says '{tok.text}' — what is the measurable standard for this?",
        })
    return found


def detect(text: str) -> list[dict]:
    """Combined rule-based detection: lexicon + POS, deduplicated by term."""
    lexicon_results = detect_lexicon(text)
    pos_results = detect_pos(text)
    by_term = {r["term"].lower(): r for r in lexicon_results}
    for r in pos_results:
        key = r["term"].lower()
        if key not in by_term:
            by_term[key] = r
    return list(by_term.values())