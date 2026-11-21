"""
Evaluates the conflict detector (ai_provider.check_conflicts) against a
labelled set of requirement pairs, reporting precision, recall, F1, and
accuracy. This is a secondary evaluation axis alongside the ambiguity
detection comparison in evaluate.py — conflict detection is a distinct
capability (pairwise contradiction detection) built on top of, not
instead of, ambiguity detection.

Row 8 in test_conflicts.csv is the real "written agreement" vs. "on
demand, no fixed deadlines" pair found during manual testing — included
because it's a genuine, empirically-motivated example, not a synthetic one.

Usage:
    cd eval
    python evaluate_conflicts.py
    python evaluate_conflicts.py --runs 3   # average over multiple runs
"""
import csv
import sys
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from app import ai_provider  # noqa: E402


def load_pairs(path: str) -> list[dict]:
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows.append({
                "id": row["id"],
                "existing": row["existing_requirement"],
                "new": row["new_requirement"],
                "expected": row["expected_conflict"].strip().lower() == "yes",
            })
    return rows


def score_once(rows: list[dict]) -> dict:
    tp = fp = fn = tn = 0
    details = []
    for row in rows:
        result = ai_provider.check_conflicts(row["new"], [row["existing"]])
        predicted = len(result) > 0

        if predicted and row["expected"]:
            tp += 1
        elif predicted and not row["expected"]:
            fp += 1
        elif not predicted and row["expected"]:
            fn += 1
        else:
            tn += 1

        details.append({"id": row["id"], "expected": row["expected"], "predicted": predicted})

    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    accuracy = (tp + tn) / len(rows) if rows else 0.0

    return {
        "precision": precision, "recall": recall, "f1": f1, "accuracy": accuracy,
        "tp": tp, "fp": fp, "fn": fn, "tn": tn, "details": details,
    }


def print_report(result: dict):
    print(f"\nConflict detector")
    print(f"  Precision: {result['precision']:.2f}")
    print(f"  Recall:    {result['recall']:.2f}")
    print(f"  F1:        {result['f1']:.2f}")
    print(f"  Accuracy:  {result['accuracy']:.2f}")
    print(f"  (TP={result['tp']}, FP={result['fp']}, FN={result['fn']}, TN={result['tn']})")
    print("\n  Per-pair detail:")
    for d in result["details"]:
        mark = "OK " if d["expected"] == d["predicted"] else "ERR"
        print(f"    [{mark}] pair {d['id']}: expected={d['expected']}, predicted={d['predicted']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="test_conflicts.csv")
    parser.add_argument("--runs", type=int, default=1, help="average over N runs to account for AI non-determinism")
    args = parser.parse_args()

    rows = load_pairs(args.dataset)
    print(f"Loaded {len(rows)} labelled requirement pairs from {args.dataset}")

    if args.runs == 1:
        result = score_once(rows)
        print_report(result)
    else:
        run_results = []
        for i in range(args.runs):
            print(f"  ...run {i + 1}/{args.runs}", file=sys.stderr)
            run_results.append(score_once(rows))

        def stats(key):
            values = [r[key] for r in run_results]
            return sum(values) / len(values), min(values), max(values)

        print(f"\nConflict detector (averaged over {args.runs} runs)")
        for metric in ("precision", "recall", "f1", "accuracy"):
            mean, mn, mx = stats(metric)
            print(f"  {metric.capitalize():10} mean={mean:.2f}  (min={mn:.2f}, max={mx:.2f})")
    