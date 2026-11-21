
import sys
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app import ai_provider

OUTPUT = ROOT / "eval"
OUTPUT.mkdir(exist_ok=True)

CASES = [
    {
        "id": 1,
        "text": "Users should be able to reset their passwords easily.",
        "clarifications": [
            {"question": "How should users reset passwords?",
             "answer": "Through a registered email address."},
            {"question": "Should the reset link expire?",
             "answer": "Yes, after 15 minutes."}
        ],
        "context": ["The system is a web-based application."],
        "discovery": [
            {"question": "Who can use this feature?",
             "answer": "Registered users"}
        ]
    },
    {
        "id": 2,
        "text": "The system should respond quickly.",
        "clarifications": [
            {"question": "What is the response time?",
             "answer": "Within 2 seconds."}
        ],
        "context": ["Online shopping platform."],
        "discovery": []
    },
    {
        "id": 3,
        "text": "Customers can track their orders.",
        "clarifications": [
            {"question": "What information is displayed?",
             "answer": "Order status and estimated delivery date."}
        ],
        "context": ["E-commerce application."],
        "discovery": [
            {"question": "Who can track orders?",
             "answer": "Logged-in customers"}
        ]
    },
    {
        "id": 4,
        "text": "The application should be secure.",
        "clarifications": [
            {"question": "What security measures are required?",
             "answer": "Password hashing and two-factor authentication."}
        ],
        "context": ["Banking application."],
        "discovery": []
    },
    {
        "id": 5,
        "text": "Admins can manage user accounts.",
        "clarifications": [
            {"question": "What management operations are allowed?",
             "answer": "Create, update, deactivate and view accounts."}
        ],
        "context": ["University management system."],
        "discovery": [
            {"question": "Who has admin privileges?",
             "answer": "Authorized university administrators"}
        ]
    },
    {
        "id": 6,
        "text": "Users should receive notifications.",
        "clarifications": [
            {"question": "Which notification channels?",
             "answer": "Email and in-app notifications."},
            {"question": "When are notifications sent?",
             "answer": "When an order is placed or its status changes."}
        ],
        "context": ["E-commerce application."],
        "discovery": []
    },
    {
        "id": 7,
        "text": "The system should support many users.",
        "clarifications": [
            {"question": "How many concurrent users?",
             "answer": "Up to 500 concurrent users."}
        ],
        "context": ["Cloud-hosted web application."],
        "discovery": []
    },
    {
        "id": 8,
        "text": "Students can register for courses.",
        "clarifications": [
            {"question": "When can students register?",
             "answer": "During the announced registration period."},
            {"question": "Can students register for full courses?",
             "answer": "No, only courses with available seats."}
        ],
        "context": ["University portal."],
        "discovery": []
    },
    {
        "id": 9,
        "text": "Users can upload documents.",
        "clarifications": [
            {"question": "Which file formats are supported?",
             "answer": "PDF, DOCX and JPG."},
            {"question": "What is the maximum size?",
             "answer": "10 MB per file."}
        ],
        "context": ["Document management system."],
        "discovery": []
    },
    {
        "id": 10,
        "text": "The system should be available all the time.",
        "clarifications": [
            {"question": "What availability is required?",
             "answer": "99.9% monthly uptime."}
        ],
        "context": ["Healthcare appointment platform."],
        "discovery": []
    },
    {
        "id": 11,
        "text": "Users can search for available products.",
        "clarifications": [
            {"question": "Which search filters are needed?",
             "answer": "Product name, category and price range."}
        ],
        "context": ["Online marketplace."],
        "discovery": []
    },
    {
        "id": 12,
        "text": "The application should generate reports.",
        "clarifications": [
            {"question": "Which report format is required?",
             "answer": "PDF and Excel."},
            {"question": "Who can generate reports?",
             "answer": "Administrators only."}
        ],
        "context": ["Management information system."],
        "discovery": []
    }
]


def evaluate():
    output_file = OUTPUT / "translation_evaluation_results.csv"

    columns = [
        "ID", "Original Requirement", "Clarifications",
        "Context", "Discovery Answers",
        "Translated Requirement", "Confidence",
        "Meaning Preservation", "Clarity",
        "Completeness", "Development Readiness",
        "Average Quality"
    ]

    results = []

    print("\nClearReq AI - Translation Evaluation")
    print("=" * 55)

    for case in CASES:
        print(f"\nEvaluating case {case['id']}/{len(CASES)}")

        try:
            result = ai_provider.translate(
                text=case["text"],
                clarifications=case["clarifications"],
                context=case["context"],
                discovery=case["discovery"]
            )

            translated = result.get("translated_text", "")
            confidence = result.get("confidence", 0.0)

            if not isinstance(translated, str):
                translated = str(translated)

            if not translated.strip():
                translated = "[EMPTY OUTPUT]"

        except Exception as error:
            translated = f"[ERROR: {error}]"
            confidence = 0.0

        print("Original:", case["text"])
        print("Translated:", translated)
        print("Confidence:", confidence)

        clarification_text = "; ".join(
            f"{c['question']} -> {c['answer']}"
            for c in case["clarifications"]
        )

        discovery_text = "; ".join(
            f"{d['question']} -> {d['answer']}"
            for d in case["discovery"]
        )

        results.append({
            "ID": case["id"],
            "Original Requirement": case["text"],
            "Clarifications": clarification_text,
            "Context": "; ".join(case["context"]),
            "Discovery Answers": discovery_text,
            "Translated Requirement": translated,
            "Confidence": confidence,
            "Meaning Preservation": "",
            "Clarity": "",
            "Completeness": "",
            "Development Readiness": "",
            "Average Quality": ""
        })

    with open(output_file, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        writer.writerows(results)

    print("\n" + "=" * 55)
    print("Evaluation generation completed.")
    print(f"Test cases: {len(results)}")
    print(f"Results saved: {output_file}")
    print("\nNext: Fill the four quality scores from 1 to 5.")
    print("Then run the scoring function below.")


def calculate_quality():
    path = OUTPUT / "translation_evaluation_results.csv"

    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    metrics = [
        "Meaning Preservation",
        "Clarity",
        "Completeness",
        "Development Readiness"
    ]

    scores = []

    for row in rows:
        values = [float(row[m]) for m in metrics]
        average = sum(values) / len(values)
        row["Average Quality"] = round(average, 2)
        scores.extend(values)

    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    print("\nTRANSLATION QUALITY RESULTS")
    print("=" * 40)

    for metric in metrics:
        values = [float(row[metric]) for row in rows]
        print(f"{metric}: {sum(values)/len(values):.2f}/5")

    overall = sum(scores) / len(scores)
    print(f"\nOverall Quality: {overall:.2f}/5")
    print(f"Percentage: {overall / 5 * 100:.2f}%")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--score":
        calculate_quality()
    else:
        evaluate()
