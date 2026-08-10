"""
Evaluates ambiguity detection methods against a labelled test set, reporting
precision/recall/F1. This script — not the app itself — produces the core
result for the thesis.

Compares four methods:
  - Lexicon-only (rule_detector.detect_lexicon)
  - POS-based    (rule_detector.detect_pos)
  - Combined rule-based (rule_detector.detect = lexicon + POS)
  - AI-assisted  (ai_provider.detect_ambiguity), averaged over multiple
    runs to account for non-determinism in the model's output.

Usage:
    cd eval
    python evaluate.py                       # rule-based methods only
    python evaluate.py --with-ai              # + AI, averaged over 3 runs
    python evaluate.py --with-ai --runs 5      # + AI, averaged over 5 runs
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


def score_ai_multi_run(rows: list[dict], runs: int) -> dict:
    """
    Runs the AI detector multiple times over the same test set to account
    for model non-determinism, reporting mean, min, and max for each metric
    rather than a single-run snapshot.
    """
    from app import ai_provider

    run_results = []
    for i in range(runs):
        print(f"  ...AI run {i + 1}/{runs}", file=sys.stderr)
        run_results.append(score(rows, ai_provider.detect_ambiguity))

    def stats(key: str) -> dict:
        values = [r[key] for r in run_results]
        return {"mean": sum(values) / len(values), "min": min(values), "max": max(values)}

    return {
        "precision": stats("precision"),
        "recall": stats("recall"),
        "f1": stats("f1"),
        "runs": run_results,
    }


def print_ai_report(name: str, result: dict, runs: int):
    print(f"\n{name} (averaged over {runs} runs)")
    for metric in ("precision", "recall", "f1"):
        s = result[metric]
        print(f"  {metric.capitalize():10} mean={s['mean']:.2f}  (min={s['min']:.2f}, max={s['max']:.2f})")
    print("  Per-run detail:")
    for i, r in enumerate(result["runs"], 1):
        print(f"    Run {i}: P={r['precision']:.2f} R={r['recall']:.2f} F1={r['f1']:.2f} "
              f"(TP={r['tp']}, FP={r['fp']}, FN={r['fn']})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--with-ai", action="store_true", help="also evaluate the AI detector (needs API keys in backend/.env)")
    parser.add_argument("--runs", type=int, default=3, help="number of AI runs to average over (default: 3)")
    parser.add_argument("--dataset", default="test_requirements.csv")
    args = parser.parse_args()

    rows = load_test_set(args.dataset)
    print(f"Loaded {len(rows)} labelled requirements from {args.dataset}")

    print_report("Rule-based: lexicon only", score(rows, rule_detector.detect_lexicon))
    print_report("Rule-based: POS-tagging only", score(rows, rule_detector.detect_pos))
    print_report("Rule-based: combined (lexicon + POS)", score(rows, rule_detector.detect))

    if args.with_ai:
        ai_result = score_ai_multi_run(rows, args.runs)
        print_ai_report("AI-assisted detector", ai_result, args.runs)