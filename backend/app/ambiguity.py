import re

# Each entry: category, the clarification question to ask, and a base
# confidence (0-1) that this word actually signals unresolved ambiguity.
AMBIGUOUS_ADJECTIVES = {
    "fast": {
        "category": "performance",
        "question": "What is the acceptable response time or throughput?",
        "confidence": 0.9,
    },
    "quick": {
        "category": "performance",
        "question": "What is the acceptable response time or throughput?",
        "confidence": 0.85,
    },
    "secure": {
        "category": "security",
        "question": "What security features are required? (authentication, authorization, encryption)",
        "confidence": 0.9,
    },
    "easy": {
        "category": "usability",
        "question": "What specific usability standard or user group defines 'easy'?",
        "confidence": 0.8,
    },
    "user-friendly": {
        "category": "usability",
        "question": "What specific usability standard or user group defines 'user-friendly'?",
        "confidence": 0.8,
    },
    "flexible": {
        "category": "extensibility",
        "question": "What specific configuration or extension points are needed?",
        "confidence": 0.75,
    },
    "modern": {
        "category": "design",
        "question": "What specific design reference or standard defines 'modern' here?",
        "confidence": 0.6,
    },
    "scalable": {
        "category": "performance",
        "question": "What load (concurrent users/requests) must the system scale to?",
        "confidence": 0.85,
    },
    "reliable": {
        "category": "reliability",
        "question": "What uptime or failure tolerance is required?",
        "confidence": 0.85,
    },
    "robust": {
        "category": "reliability",
        "question": "What failure conditions must the system handle gracefully?",
        "confidence": 0.8,
    },
}

BROAD_VERBS = {
    "manage": {
        "category": "scope",
        "question": "Which specific actions does 'manage' include (create, edit, delete, view)?",
        "confidence": 0.7,
    },
    "handle": {
        "category": "scope",
        "question": "What specific actions or error conditions does 'handle' cover?",
        "confidence": 0.7,
    },
    "support": {
        "category": "scope",
        "question": "What specific capability must be 'supported'? List concrete features.",
        "confidence": 0.65,
    },
    "process": {
        "category": "scope",
        "question": "What specific processing steps are performed on the data?",
        "confidence": 0.6,
    },
}

ALL_TERMS = {**AMBIGUOUS_ADJECTIVES, **BROAD_VERBS}

# If a number + unit already sits near the ambiguous word, the requirement
# is probably already partly qualified, so we lower (not remove) confidence
# rather than silently dropping the flag.
NUMBER_PATTERN = re.compile(
    r"\d+\s*(ms|s|sec|second|seconds|minute|minutes|user|users|mb|gb|%|percent)",
    re.IGNORECASE,
)


def analyze_requirement(text: str):
    """Return a list of ambiguity findings for a requirement's text.

    Each finding: {term, category, confidence, question}
    """
    lowered = text.lower()
    findings = []

    already_qualified = bool(NUMBER_PATTERN.search(lowered))

    for term, meta in ALL_TERMS.items():
        pattern = r"\b" + re.escape(term) + r"\b"
        if re.search(pattern, lowered):
            confidence = meta["confidence"]
            if already_qualified:
                confidence = max(0.1, round(confidence - 0.5, 2))
            findings.append(
                {
                    "term": term,
                    "category": meta["category"],
                    "confidence": confidence,
                    "question": meta["question"],
                }
            )

    return findings
