"""
Security validation test — a functional pass/fail check for the input
validation added at the API boundary (backend/app/schemas.py), not a
precision/recall evaluation. Confirms two things:

1. Malicious/script-like payloads are rejected before they ever reach an
   AI prompt or the database (defense against the prompt-injection /
   stored-XSS behavior observed during manual testing — see
   context/progress-tracker.md section 7).
2. Legitimate requirement text containing "<" or ">" as ordinary
   punctuation (comparisons, thresholds) is NOT falsely rejected, since a
   validator that's too aggressive is a real usability problem, not just
   a security win.

Usage:
    cd eval
    python security_test.py
"""
import sys
from pathlib import Path
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from app.schemas import RequirementIn  # noqa: E402

# Payloads drawn from actual manual testing during development (see the
# "<script>console.log('Test')</script>" case documented in the progress
# tracker), plus standard XSS/injection patterns.
MALICIOUS_PAYLOADS = [
    "<script>alert(1)</script>",
    "<script>console.log('Test')</script>",
    "<img src=x onerror=alert(1)>",
    "<b>bold text</b>",
    "<iframe src='evil.com'></iframe>",
    "Normal requirement text <script>fetch('http://evil.com')</script> more text",
]

# Legitimate requirements that happen to contain "<" or ">" as ordinary
# comparison punctuation, not markup — these must NOT be rejected.
LEGITIMATE_EDGE_CASES = [
    "The system shall respond in under 5 seconds.",
    "The system should support < 100 concurrent users.",
    "The cost should be < $50 per license.",
    "Users & admins can both log in.",
    'The system shall display "Welcome" on login.',
    "It's the user's own data, only they can see it.",
    "The system shall support values less than 10 and greater than 1.",
    "the avg cal = sum. of N/no. of N * 100 % ",
]


def run():
    print(f"Loaded {len(MALICIOUS_PAYLOADS)} malicious payloads, "
          f"{len(LEGITIMATE_EDGE_CASES)} legitimate edge cases\n")

    print("=== Malicious payloads (expected: REJECTED) ===")
    mal_correct = 0
    for p in MALICIOUS_PAYLOADS:
        try:
            RequirementIn(session_id=1, text=p)
            print(f"  FAIL — accepted (should have rejected): {p!r}")
        except ValidationError:
            print(f"  PASS — rejected: {p!r}")
            mal_correct += 1
    print(f"\n{mal_correct}/{len(MALICIOUS_PAYLOADS)} malicious payloads correctly rejected\n")

    print("=== Legitimate edge cases (expected: ACCEPTED) ===")
    legit_correct = 0
    for p in LEGITIMATE_EDGE_CASES:
        try:
            RequirementIn(session_id=1, text=p)
            print(f"  PASS — accepted: {p!r}")
            legit_correct += 1
        except ValidationError as e:
            print(f"  FAIL — rejected (should have accepted): {p!r}")
            print(f"         reason: {e}")
    print(f"\n{legit_correct}/{len(LEGITIMATE_EDGE_CASES)} legitimate edge cases correctly accepted\n")

    total_correct = mal_correct + legit_correct
    total = len(MALICIOUS_PAYLOADS) + len(LEGITIMATE_EDGE_CASES)
    print(f"Overall: {total_correct}/{total} correct ({total_correct / total:.0%})")


if __name__ == "__main__":
    run()
    