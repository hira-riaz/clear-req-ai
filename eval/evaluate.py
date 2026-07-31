"""
Evaluates the rule-based detector (and, once you wire in API keys, the AI
detector) against a labelled test set, reporting precision/recall/F1.

This script — not the app itself — produces the core result for the thesis.
Expand test_requirements.csv to 30-50+ rows (see the FYP execution plan,
section 4) before reporting final numbers; 10 rows is a smoke-test size only.

Usage:
    cd eval
    python evaluate.py                 # rule-based only, no API keys needed
    python evaluate.py --with-ai       # also evaluates the AI detector
"""
import csv
import sys
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from app import rule_detector  # noqa: E402


def load_test_set(path: str) -> list[dict]:
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            expected = set(
                t.strip().lower() for t in row["expected_ambiguous_terms"].split(",") if t.strip()
            )
            rows.append({"id": row["id"], "text": row["text"], "expected": expected})
    return rows


def score(rows: list[dict], predict_fn) -> dict:
    tp = fp = fn = 0
    for row in rows:
        predicted = set(item["term"].lower() for item in predict_fn(row["text"]))
        tp += len(predicted & row["expected"])
        fp += len(predicted - row["expected"])
        fn += len(row["expected"] - predicted)

    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return {"precision": precision, "recall": recall, "f1": f1, "tp": tp, "fp": fp, "fn": fn}


def print_report(name: str, result: dict):
    print(f"\n{name}")
    print(f"  Precision: {result['precision']:.2f}")
    print(f"  Recall:    {result['recall']:.2f}")
    print(f"  F1:        {result['f1']:.2f}")
    print(f"  (TP={result['tp']}, FP={result['fp']}, FN={result['fn']})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--with-ai", action="store_true", help="also evaluate the AI detector (needs API keys in backend/.env)")
    parser.add_argument("--dataset", default="test_requirements.csv")
    args = parser.parse_args()

    rows = load_test_set(args.dataset)
    print(f"Loaded {len(rows)} labelled requirements from {args.dataset}")

    rule_result = score(rows, rule_detector.detect)
    print_report("Rule-based detector", rule_result)

    if args.with_ai:
        from app import ai_provider
        ai_result = score(rows, ai_provider.detect_ambiguity)
        print_report("AI-assisted detector", ai_result)
