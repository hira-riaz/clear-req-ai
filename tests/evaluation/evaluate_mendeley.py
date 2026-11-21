
import os
import sys
import json
import time
import random
import pandas as pd

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")

sys.path.insert(0, BACKEND_DIR)

from app import ai_provider
from app import rule_detector

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    fbeta_score,
    confusion_matrix,
)

# ============================================================
# SETTINGS
# ============================================================

DATA_LIMIT = 25

DATASET_PATH = "Cornelius_research_subsets.xlsx"
SHEET_NAME = "Balanced_Classification"

RANDOM_STATE = 42
API_DELAY = 1

AI_CACHE_FILE = "eval/mendeley_ai_cache.json"
AI_CACHE_VERSION = "v1"


# ============================================================
# LOAD DATASET
# ============================================================

def load_dataset():
    print("\nLoading dataset...")

    df = pd.read_excel(
        DATASET_PATH,
        sheet_name=SHEET_NAME
    )

    required_columns = [
        "StoryID",
        "StoryText",
        "HasAmbiguity"
    ]

    for col in required_columns:
        if col not in df.columns:
            raise ValueError(
                f"Missing required column: {col}"
            )

    df = df[required_columns].copy()

    # Convert labels to boolean
    df["HasAmbiguity"] = (
        df["HasAmbiguity"]
        .astype(str)
        .str.lower()
        .map({
            "true": True,
            "1": True,
            "yes": True,
            "false": False,
            "0": False,
            "no": False,
        })
    )

    # Remove rows with invalid labels
    df = df.dropna(
        subset=["StoryText", "HasAmbiguity"]
    )

    return df


# ============================================================
# BALANCED RANDOM SAMPLE
# ============================================================

def get_sample(df):
    random.seed(RANDOM_STATE)

    if DATA_LIMIT is None:
        return df.sample(
            frac=1,
            random_state=RANDOM_STATE
        ).reset_index(drop=True)

    ambiguous = df[
        df["HasAmbiguity"] == True
    ]

    clear = df[
        df["HasAmbiguity"] == False
    ]

    target_ambiguous = DATA_LIMIT // 2
    target_clear = DATA_LIMIT - target_ambiguous

    # If enough records exist in both classes,
    # create a balanced sample.
    if (
        len(ambiguous) >= target_ambiguous
        and len(clear) >= target_clear
    ):
        ambiguous_sample = ambiguous.sample(
            n=target_ambiguous,
            random_state=RANDOM_STATE
        )

        clear_sample = clear.sample(
            n=target_clear,
            random_state=RANDOM_STATE
        )

        sample = pd.concat(
            [
                ambiguous_sample,
                clear_sample
            ]
        )

    else:
        print(
            "\nWarning: Not enough records for a balanced sample."
        )

        sample = df.sample(
            n=min(DATA_LIMIT, len(df)),
            random_state=RANDOM_STATE
        )

    return sample.sample(
        frac=1,
        random_state=RANDOM_STATE
    ).reset_index(drop=True)


# ============================================================
# AI CACHE
# ============================================================

def load_ai_cache():
    if not os.path.exists(AI_CACHE_FILE):
        return {}

    try:
        with open(
            AI_CACHE_FILE,
            "r",
            encoding="utf-8"
        ) as f:
            return json.load(f)

    except Exception:
        print(
            "Warning: Could not read AI cache. Starting fresh."
        )
        return {}


def save_ai_cache(cache):
    os.makedirs(
        os.path.dirname(AI_CACHE_FILE),
        exist_ok=True
    )

    with open(
        AI_CACHE_FILE,
        "w",
        encoding="utf-8"
    ) as f:
        json.dump(
            cache,
            f,
            indent=2,
            ensure_ascii=False
        )


# ============================================================
# AI DETECTION
# ============================================================

def run_ai_detector(
    story_id,
    text,
    cache
):
    cache_key = (
        f"{AI_CACHE_VERSION}:{story_id}"
    )

    # Use cached result
    if cache_key in cache:
        return cache[cache_key]

    print(
        f"  AI call -> StoryID: {story_id}"
    )

    try:
        result = ai_provider.detect_ambiguity(text)

        # Save immediately
        cache[cache_key] = result
        save_ai_cache(cache)

        time.sleep(API_DELAY)

        return result

    except Exception as e:
        print(
            f"  AI ERROR -> {story_id}: {e}"
        )

        return []


# ============================================================
# METRICS
# ============================================================

def calculate_metrics(
    y_true,
    y_pred
):

    tn, fp, fn, tp = confusion_matrix(
        y_true,
        y_pred,
        labels=[0, 1]
    ).ravel()

    accuracy = accuracy_score(
        y_true,
        y_pred
    )

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

    f2 = fbeta_score(
        y_true,
        y_pred,
        beta=2,
        zero_division=0
    )

    return {
        "TP": tp,
        "TN": tn,
        "FP": fp,
        "FN": fn,
        "Accuracy": accuracy,
        "Precision": precision,
        "Recall": recall,
        "F1": f1,
        "F2": f2,
    }


# ============================================================
# MAIN EVALUATION
# ============================================================

def main():

    print("=" * 70)
    print("ClearReq AI - Mendeley Evaluation")
    print("=" * 70)

    # --------------------------------------------------------
    # Load
    # --------------------------------------------------------

    df = load_dataset()

    print(
        f"\nTotal dataset records: {len(df)}"
    )

    # --------------------------------------------------------
    # Sample
    # --------------------------------------------------------

    sample = get_sample(df)

    print(
        f"Records selected for evaluation: {len(sample)}"
    )

    print(
        "\nClass distribution:"
    )

    print(
        sample["HasAmbiguity"]
        .value_counts()
        .rename({
            True: "Ambiguous",
            False: "Clear"
        })
    )

    # --------------------------------------------------------
    # AI cache
    # --------------------------------------------------------

    ai_cache = load_ai_cache()

    print(
        f"\nCached AI results: {len(ai_cache)}"
    )

    # --------------------------------------------------------
    # Results
    # --------------------------------------------------------

    results = []

    print("\n" + "=" * 70)
    print("Running evaluation...")
    print("=" * 70)

    for index, row in sample.iterrows():

        story_id = str(row["StoryID"])
        text = str(row["StoryText"])

        actual = bool(
            row["HasAmbiguity"]
        )

        print(
            f"\n[{index + 1}/{len(sample)}] "
            f"StoryID: {story_id}"
        )

        print(
            f"Actual: "
            f"{'Ambiguous' if actual else 'Clear'}"
        )

        # ====================================================
        # LEXICON
        # ====================================================

        lexicon_result = (
            rule_detector.detect_lexicon(text)
        )

        lexicon_prediction = (
            len(lexicon_result) > 0
        )

        # ====================================================
        # POS
        # ====================================================

        pos_result = (
            rule_detector.detect_pos(text)
        )

        pos_prediction = (
            len(pos_result) > 0
        )

        # ====================================================
        # COMBINED
        # ====================================================

        combined_result = (
            rule_detector.detect(text)
        )

        combined_prediction = (
            len(combined_result) > 0
        )

        # ====================================================
        # AI
        # ====================================================

        ai_result = run_ai_detector(
            story_id,
            text,
            ai_cache
        )

        ai_prediction = (
            len(ai_result) > 0
        )

        # ====================================================
        # SAVE RECORD
        # ====================================================

        results.append({
            "StoryID": story_id,
            "StoryText": text,
            "Actual": int(actual),

            "LexiconPrediction":
                int(lexicon_prediction),

            "POSPrediction":
                int(pos_prediction),

            "CombinedPrediction":
                int(combined_prediction),

            "AIPrediction":
                int(ai_prediction),

            "LexiconTerms":
                json.dumps(
                    lexicon_result,
                    ensure_ascii=False
                ),

            "POSTerms":
                json.dumps(
                    pos_result,
                    ensure_ascii=False
                ),

            "CombinedTerms":
                json.dumps(
                    combined_result,
                    ensure_ascii=False
                ),

            "AITerms":
                json.dumps(
                    ai_result,
                    ensure_ascii=False
                ),
        })

        print(
            f"  Lexicon : "
            f"{'Ambiguous' if lexicon_prediction else 'Clear'}"
        )

        print(
            f"  POS     : "
            f"{'Ambiguous' if pos_prediction else 'Clear'}"
        )

        print(
            f"  Combined: "
            f"{'Ambiguous' if combined_prediction else 'Clear'}"
        )

        print(
            f"  AI      : "
            f"{'Ambiguous' if ai_prediction else 'Clear'}"
        )

    # ========================================================
    # DATAFRAME
    # ========================================================

    detailed_df = pd.DataFrame(
        results
    )

    # ========================================================
    # EVALUATE METHODS
    # ========================================================

    methods = {
        "Lexicon":
            "LexiconPrediction",

        "POS":
            "POSPrediction",

        "Combined Rules":
            "CombinedPrediction",

        "AI":
            "AIPrediction",
    }

    summary = []

    y_true = detailed_df[
        "Actual"
    ].astype(int).tolist()

    for method, prediction_column in methods.items():

        y_pred = detailed_df[
            prediction_column
        ].astype(int).tolist()

        metrics = calculate_metrics(
            y_true,
            y_pred
        )

        summary.append({
            "Method": method,
            "TestedRecords":
                len(detailed_df),

            **metrics
        })

    summary_df = pd.DataFrame(
        summary
    )

    # ========================================================
    # ERROR ANALYSIS
    # ========================================================

    error_rows = []

    for _, row in detailed_df.iterrows():

        actual = row["Actual"]

        for method, prediction_column in methods.items():

            prediction = row[
                prediction_column
            ]

            if (
                actual == 0
                and prediction == 1
            ):
                error_type = "False Positive"

            elif (
                actual == 1
                and prediction == 0
            ):
                error_type = "False Negative"

            else:
                continue

            error_rows.append({
                "StoryID":
                    row["StoryID"],

                "StoryText":
                    row["StoryText"],

                "Actual":
                    actual,

                "Method":
                    method,

                "Prediction":
                    prediction,

                "ErrorType":
                    error_type,
            })

    error_df = pd.DataFrame(
        error_rows
    )

    # ========================================================
    # SAVE FILES
    # ========================================================

    os.makedirs(
        "eval",
        exist_ok=True
    )

    detailed_file = (
        "eval/"
        "clearreq_mendeley_detailed_results.csv"
    )

    summary_file = (
        "eval/"
        "clearreq_mendeley_comparison.csv"
    )

    error_file = (
        "eval/"
        "clearreq_mendeley_error_analysis.csv"
    )

    detailed_df.to_csv(
        detailed_file,
        index=False,
        encoding="utf-8-sig"
    )

    summary_df.to_csv(
        summary_file,
        index=False,
        encoding="utf-8-sig"
    )

    error_df.to_csv(
        error_file,
        index=False,
        encoding="utf-8-sig"
    )

    # ========================================================
    # PRINT FINAL TABLE
    # ========================================================

    print("\n")
    print("=" * 70)
    print("FINAL RESULTS")
    print("=" * 70)

    display_df = summary_df.copy()

    for column in [
        "Accuracy",
        "Precision",
        "Recall",
        "F1",
        "F2"
    ]:
        display_df[column] = (
            display_df[column] * 100
        ).round(2).astype(str) + "%"

    print(
        display_df.to_string(
            index=False
        )
    )

    

# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    main()
