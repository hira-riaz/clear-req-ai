import os
import sys
import time
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
)

# --------------------------------------------------
# Allow imports from project root
# --------------------------------------------------

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from backend.app import rule_detector
from backend.app.ai_provider import detect_ambiguity


# --------------------------------------------------
# SETTINGS
# --------------------------------------------------

DATASET = os.path.join(
    os.path.dirname(__file__),
    "Cornelius_research_subsets.xlsx"
)

SHEET_NAME = "Balanced_Classification"

# Start small because AI detection makes API calls.
SAMPLE_PER_CLASS = 5

RUN_AI = True


# --------------------------------------------------
# LOAD DATASET
# --------------------------------------------------

df = pd.read_excel(
    DATASET,
    sheet_name=SHEET_NAME
)

print(f"\nFull dataset: {len(df)} requirements")

print("\nClass distribution:")
print(df["HasAmbiguity"].value_counts())


# --------------------------------------------------
# CREATE BALANCED SAMPLE
# --------------------------------------------------

ambiguous = df[df["HasAmbiguity"] == True].sample(
    n=SAMPLE_PER_CLASS,
    random_state=42
)

non_ambiguous = df[df["HasAmbiguity"] == False].sample(
    n=SAMPLE_PER_CLASS,
    random_state=42
)

test_df = pd.concat(
    [ambiguous, non_ambiguous]
).sample(
    frac=1,
    random_state=42
).reset_index(drop=True)

print(
    f"\nTesting {len(test_df)} requirements "
    f"({SAMPLE_PER_CLASS} ambiguous + "
    f"{SAMPLE_PER_CLASS} non-ambiguous)\n"
)


# --------------------------------------------------
# STORAGE
# --------------------------------------------------

lexicon_predictions = []
pos_predictions = []
combined_predictions = []
ai_predictions = []


# --------------------------------------------------
# RUN CLEARREQ DETECTORS
# --------------------------------------------------

for number, row in test_df.iterrows():

    text = str(row["StoryText"])
    expected = bool(row["HasAmbiguity"])

    print("=" * 70)
    print(f"Requirement {number + 1}/{len(test_df)}")
    print(f"ID: {row['StoryID']}")
    print(f"Expected: {expected}")
    print(f"Text: {text[:150]}")

    # -----------------------------
    # 1. Lexicon detector
    # -----------------------------

    lexicon_result = rule_detector.detect_lexicon(text)
    lexicon_prediction = len(lexicon_result) > 0

    lexicon_predictions.append(lexicon_prediction)

    print(
        f"Lexicon  : {lexicon_prediction} "
        f"{'✓' if lexicon_prediction == expected else '✗'}"
    )

    # -----------------------------
    # 2. POS detector
    # -----------------------------

    pos_result = rule_detector.detect_pos(text)
    pos_prediction = len(pos_result) > 0

    pos_predictions.append(pos_prediction)

    print(
        f"POS      : {pos_prediction} "
        f"{'✓' if pos_prediction == expected else '✗'}"
    )

    # -----------------------------
    # 3. Combined rule detector
    # -----------------------------

    combined_result = rule_detector.detect(text)
    combined_prediction = len(combined_result) > 0

    combined_predictions.append(combined_prediction)

    print(
        f"Combined : {combined_prediction} "
        f"{'✓' if combined_prediction == expected else '✗'}"
    )

    # -----------------------------
    # 4. AI detector
    # -----------------------------

    if RUN_AI:

        try:
            ai_result = detect_ambiguity(text)

            ai_prediction = len(ai_result) > 0

        except Exception as e:

            print(f"AI ERROR: {e}")

            # Use None rather than False.
            # API failure must NOT be counted
            # as a wrong ambiguity prediction.
            ai_prediction = None

        ai_predictions.append(ai_prediction)

        if ai_prediction is not None:

            print(
                f"AI       : {ai_prediction} "
                f"{'✓' if ai_prediction == expected else '✗'}"
            )

        else:

            print("AI       : ERROR")

        # Small pause to reduce API pressure
        time.sleep(1)


# --------------------------------------------------
# ADD RESULTS TO DATAFRAME
# --------------------------------------------------

test_df["LexiconPrediction"] = lexicon_predictions
test_df["POSPrediction"] = pos_predictions
test_df["CombinedPrediction"] = combined_predictions

if RUN_AI:
    test_df["AIPrediction"] = ai_predictions


# --------------------------------------------------
# METRIC FUNCTION
# --------------------------------------------------

def calculate_metrics(name, y_true, y_pred):

    accuracy = accuracy_score(y_true, y_pred)

    precision = precision_score(
        y_true,
        y_pred,
        zero_division=0
    )

    recall = recall_score(
        y_true,
        y_pred,
        zero_division=0
    )

    f1 = f1_score(
        y_true,
        y_pred,
        zero_division=0
    )

    tn, fp, fn, tp = confusion_matrix(
        y_true,
        y_pred,
        labels=[False, True]
    ).ravel()

    print("\n" + "=" * 55)
    print(name)
    print("=" * 55)

    print(f"Accuracy  : {accuracy:.2%}")
    print(f"Precision : {precision:.2%}")
    print(f"Recall    : {recall:.2%}")
    print(f"F1 Score  : {f1:.2%}")

    print("\nConfusion Matrix:")
    print(f"TP: {tp}")
    print(f"TN: {tn}")
    print(f"FP: {fp}")
    print(f"FN: {fn}")

    return {
        "Method": name,
        "Accuracy": accuracy,
        "Precision": precision,
        "Recall": recall,
        "F1": f1,
        "TP": tp,
        "TN": tn,
        "FP": fp,
        "FN": fn,
    }


# --------------------------------------------------
# CALCULATE RESULTS
# --------------------------------------------------

y_true = test_df["HasAmbiguity"].astype(bool)

summary = []

summary.append(
    calculate_metrics(
        "Lexicon",
        y_true,
        test_df["LexiconPrediction"]
    )
)

summary.append(
    calculate_metrics(
        "POS",
        y_true,
        test_df["POSPrediction"]
    )
)

summary.append(
    calculate_metrics(
        "Combined Rules",
        y_true,
        test_df["CombinedPrediction"]
    )
)


# --------------------------------------------------
# AI METRICS
# --------------------------------------------------

if RUN_AI:

    valid_ai = test_df[
        test_df["AIPrediction"].notna()
    ].copy()

    if len(valid_ai) > 0:

        summary.append(
            calculate_metrics(
                "AI / LLM",
                valid_ai["HasAmbiguity"].astype(bool),
                valid_ai["AIPrediction"].astype(bool)
            )
        )

        print(
            f"\nAI successfully evaluated "
            f"{len(valid_ai)}/{len(test_df)} requirements."
        )


# --------------------------------------------------
# FINAL COMPARISON TABLE
# --------------------------------------------------

summary_df = pd.DataFrame(summary)

print("\n\n")
print("=" * 70)
print("CLEARREQ AI — FINAL COMPARISON")
print("=" * 70)

print(
    summary_df[
        [
            "Method",
            "Accuracy",
            "Precision",
            "Recall",
            "F1"
        ]
    ].to_string(index=False)
)


# --------------------------------------------------
# SAVE FILES
# --------------------------------------------------

results_path = os.path.join(
    os.path.dirname(__file__),
    "clearreq_mendeley_results.csv"
)

summary_path = os.path.join(
    os.path.dirname(__file__),
    "clearreq_mendeley_summary.csv"
)

test_df.to_csv(
    results_path,
    index=False
)

summary_df.to_csv(
    summary_path,
    index=False
)

print("\nSaved:")
print(results_path)
print(summary_path)