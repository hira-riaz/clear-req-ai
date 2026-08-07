"""
Rule-based ambiguity detector — the fast, deterministic, explainable baseline
that gets compared against the AI-assisted detector in eval/evaluate.py.

Word list sourced from NASA's ARM "weak phrases" concept and the INCOSE
Guide for Writing Requirements — see docs/ for citations. Extend this list
as you build out your evaluation dataset rather than guessing.
"""
'''
WEAK_WORDS = {
    "fast": "performance",
    "slow": "performance",
    "efficient": "performance",
    "secure": "security",
    "safe": "security",
    "easy": "UX",
    "simple": "UX",
    "intuitive": "UX",
    "user-friendly": "UX",
    "flexible": "scope",
    "robust": "scope",
    "scalable": "scope",
    "reliable": "scope",
    "appropriate": "scope",
    "sufficient": "scope",
    "manage": "scope",
    "handle": "scope",
    "support": "scope",
    "process": "scope",
}'''
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


def detect(text: str) -> list[dict]:
    """
    Scan requirement text for known weak/ambiguous words.
    Returns a list of {term, category, question} dicts.
    """
    lowered = text.lower()
    found = []
    for word, category in WEAK_WORDS.items():
        if word in lowered:
            found.append({
                "term": word,
                "category": category,
                "detector": "rule",
                "confidence": 1.0,  # rule matches are certain by construction
                "question": QUESTION_TEMPLATES[category].format(term=word),
            })
    return found
