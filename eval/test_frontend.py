"""Playwright E2E coverage for the authenticated ClearReq frontend.

The test uses a real Supabase login and deterministic mocked application API
responses. Set CLEARREQ_TEST_PASSWORD to the password for CLEARREQ_TEST_EMAIL.

Run headless from the repository root:
    pytest eval/test_frontend.py

Run with a visible browser:
    pytest --headed -s eval/test_frontend.py
"""

import json
import os
from urllib.parse import urlparse

import pytest
from playwright.sync_api import Page, Route, expect


BASE_URL = os.getenv("CLEARREQ_BASE_URL", "http://localhost:5173")
TEST_EMAIL = os.getenv("CLEARREQ_TEST_EMAIL", "hiriawz@gmail.com")
TEST_PASSWORD = os.getenv("CLEARREQ_TEST_PASSWORD")
REQUIREMENT_TEXT = (
    "Allow girls to take picture, and then app will detect the theme "
    "and generate the playlist with available songs."
)
PROJECT_NAME = "Playwright E2E project"
SESSION_ID = 9999
REQUIREMENT_ID = 5001


def test_clearreq_complete_frontend_flow(page: Page, tmp_path):
    if not TEST_PASSWORD:
        pytest.fail(
            "Set CLEARREQ_TEST_PASSWORD to the Supabase test account password "
            "before running this E2E test."
        )

    # Keep the real Supabase authentication flow, but make application API
    # responses deterministic so the UI test does not depend on AI output.
    discovery_answers = []
    session_created = {"value": False}
    api_sessions = [
        {
            "session_id": session_id,
            "project_name": f"History project {session_id}",
            "requirement_count": 0,
            "translated_count": 0,
        }
        for session_id in range(1, 21)
    ]

    def mock_application_api(route: Route) -> None:
        request = route.request
        path = urlparse(request.url).path

        if request.method == "GET" and path == "/sessions":
            sessions = list(api_sessions)
            if session_created["value"]:
                sessions.insert(
                    0,
                    {
                        "session_id": SESSION_ID,
                        "project_name": PROJECT_NAME,
                        "requirement_count": 1,
                        "translated_count": 1,
                    },
                )
            route.fulfill(json=sessions)
        elif request.method == "POST" and path == "/sessions":
            session_created["value"] = True
            route.fulfill(
                json={
                    "session_id": SESSION_ID,
                    "project_id": SESSION_ID,
                    "project_name": PROJECT_NAME,
                }
            )
        elif request.method == "POST" and path == f"/sessions/{SESSION_ID}/discovery":
            payload = json.loads(request.post_data or "{}")
            discovery_answers.extend(payload.get("answers", []))
            route.fulfill(json={"status": "saved", "count": len(discovery_answers)})
        elif request.method == "POST" and path == "/requirements/analyze":
            route.fulfill(
                json={
                    "requirement_id": REQUIREMENT_ID,
                    "ambiguities": [
                        {
                            "ambiguity_id": 7001,
                            "term": "song library",
                            "category": "scope",
                            "question": "Which songs should the playlist use?",
                            "suggested_answer": None,
                            "options": [
                                "Only the user's personal downloaded library.",
                                "Songs available in the shared catalog.",
                            ],
                        },
                        {
                            "ambiguity_id": 7002,
                            "term": "theme",
                            "category": "scope",
                            "question": "How should the app choose a theme?",
                            "suggested_answer": None,
                            "options": ["Use the user's selected theme."],
                        },
                    ],
                }
            )
        elif request.method == "POST" and path == "/requirements/translate":
            route.fulfill(
                json={
                    "requirement_id": REQUIREMENT_ID,
                    "version_number": 1,
                    "translated_text": (
                        "The app shall detect a theme from the user's picture "
                        "and generate a playlist using the selected song library."
                    ),
                }
            )
        elif request.method == "GET" and path == f"/sessions/{SESSION_ID}/report":
            route.fulfill(
                json={
                    "session_id": SESSION_ID,
                    "project_name": PROJECT_NAME,
                    "discovery": discovery_answers,
                    "requirements": [
                        {
                            "requirement_id": REQUIREMENT_ID,
                            "original_text": REQUIREMENT_TEXT,
                            "status": "translated",
                            "translated_text": (
                                "The app shall detect a theme from the user's "
                                "picture and generate a playlist using the "
                                "selected song library."
                            ),
                            "confidence_score": 0.95,
                            "category": "general",
                            "req_type": "Functional",
                            "ambiguities": [
                                {
                                    "term": "song library",
                                    "question": "Which songs should the playlist use?",
                                    "answer": "Only the user's personal downloaded library.",
                                },
                                {
                                    "term": "theme",
                                    "question": "How should the app choose a theme?",
                                    "answer": None,
                                },
                            ],
                        }
                    ],
                }
            )
        elif request.method == "GET" and path == f"/sessions/{SESSION_ID}/report/docx":
            route.fulfill(
                status=200,
                content_type=(
                    "application/vnd.openxmlformats-officedocument."
                    "wordprocessingml.document"
                ),
                headers={
                    "Content-Disposition": 'attachment; filename="e2e_report.docx"'
                },
                body=b"mock-docx-download",
            )
        else:
            route.continue_()

    page.route("**/sessions**", mock_application_api)
    page.route("**/requirements**", mock_application_api)

    # Leave analysis pending long enough to verify its disabled loading action.
    page.add_init_script(
        """
        (() => {
          const originalFetch = window.fetch.bind(window);
          window.fetch = (input, init) => {
            const url = typeof input === "string" ? input : input.url;
            if (new URL(url, window.location.href).pathname === "/requirements/analyze") {
              return new Promise((resolve, reject) => {
                window.setTimeout(() => originalFetch(input, init).then(resolve, reject), 800);
              });
            }
            return originalFetch(input, init);
          };
        })();
        """
    )

    page.set_viewport_size({"width": 1280, "height": 720})
    page.goto(BASE_URL)
    page.get_by_role("link", name="Get started").first.click()

    # The auth page defaults to Sign up, so switch to the existing-account form.
    page.get_by_role("button", name="Log in", exact=True).click()
    page.get_by_label("Email").fill(TEST_EMAIL)
    page.get_by_label("Password").fill(TEST_PASSWORD)
    page.locator("form").get_by_role("button", name="Log in", exact=True).click()

    sidebar = page.locator("aside")
    expect(sidebar).to_be_visible()
    expect(sidebar.get_by_role("button", name="+ New session")).to_be_visible()
    expect(sidebar.get_by_text("Hira", exact=True)).to_be_visible()

    # Only session history scrolls; the profile and logout remain in the viewport.
    expect(sidebar).to_have_css("overflow-y", "hidden")
    history = sidebar.locator("div.flex-1.overflow-y-auto")
    expect(history).to_have_css("overflow-y", "auto")
    logout_button = sidebar.get_by_role("button", name="Log out")
    expect(logout_button).to_be_in_viewport()
    profile_before = sidebar.get_by_text("Hira", exact=True).bounding_box()
    logout_before = logout_button.bounding_box()
    scroll_metrics = history.evaluate(
        """element => {
          element.scrollTop = element.scrollHeight;
          return {
            scrollTop: element.scrollTop,
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight
          };
        }"""
    )
    if scroll_metrics["scrollTop"] <= 0:
        pytest.fail("The session history did not scroll independently.")
    if scroll_metrics["scrollHeight"] <= scroll_metrics["clientHeight"]:
        pytest.fail("The mocked session history did not overflow its scroll area.")
    expect(sidebar.get_by_text("Hira", exact=True)).to_be_in_viewport()
    expect(logout_button).to_be_in_viewport()
    profile_after = sidebar.get_by_text("Hira", exact=True).bounding_box()
    logout_after = logout_button.bounding_box()
    if abs(profile_after["y"] - profile_before["y"]) >= 1:
        pytest.fail("The user profile moved when the session history was scrolled.")
    if abs(logout_after["y"] - logout_before["y"]) >= 1:
        pytest.fail("The logout action moved when the session history was scrolled.")

    # Start a new session and complete all six discovery questions in order.
    page.get_by_role("button", name="+ New session").click()
    page.get_by_label("Project name").fill(PROJECT_NAME)
    page.get_by_role("button", name="Start session").click()
    expect(page.get_by_text("Question 1 of 6")).to_be_visible()

    for question_index in range(6):
        if question_index == 0:
            page.get_by_role("button", name="Web", exact=True).click()
        elif question_index % 2:
            page.get_by_role("button", name="Skip this question").click()
        else:
            page.get_by_role("button", name="Not sure yet", exact=True).click()

        if question_index < 5:
            expect(page.get_by_text(f"Question {question_index + 2} of 6")).to_be_visible()

    requirement_input = page.get_by_label("Requirement")
    expect(requirement_input).to_be_visible()
    expect(requirement_input).to_be_empty()
    expect(page.get_by_text("Question 6 of 6")).not_to_be_visible()

    # Analyze and verify a disabled action is shown while the API is pending.
    requirement_input.fill(REQUIREMENT_TEXT)
    page.get_by_role("button", name="Analyze requirement", exact=True).click()
    pending_button = page.get_by_role("button", name="Analyzing...", exact=True)
    expect(pending_button).to_be_visible()
    expect(pending_button).to_be_disabled()

    # Choose the requested MCQ option, then skip the next clarification.
    page.get_by_role(
        "button",
        name="Only the user's personal downloaded library.",
        exact=True,
    ).click()
    expect(page.get_by_text("Question 2 of 2")).to_be_visible()
    page.get_by_role("button", name="Skip question", exact=True).click()

    # Translation returns to a fresh, empty requirement input.
    requirement_input = page.get_by_label("Requirement")
    expect(requirement_input).to_be_visible()
    expect(requirement_input).to_be_empty()
    expect(page.get_by_role("button", name="Finish & generate report")).to_be_visible()

    # Open the report, go through review, then compile the final report view.
    page.get_by_role("button", name="Finish & generate report").click()
    expect(page.get_by_role("heading", name="Project Discovery")).to_be_visible()
    expect(page.get_by_text("Web", exact=True)).to_be_visible()
    expect(page.get_by_text("Skipped", exact=True).first).to_be_visible()

    page.get_by_role("button", name="Review & approve").click()
    expect(page.get_by_role("button", name="Generate report")).to_be_visible()
    page.get_by_role("button", name="Generate report").click()
    expect(page.get_by_role("heading", name="Functional Requirements")).to_be_visible()

    with page.expect_download() as download_info:
        page.get_by_role("button", name="Export Word document").click()
    download = download_info.value
    if not download.suggested_filename.endswith(".docx"):
        pytest.fail(f"Expected a Word document, received {download.suggested_filename!r}.")
    downloaded_file = tmp_path / download.suggested_filename
    download.save_as(downloaded_file)
    if downloaded_file.stat().st_size == 0:
        pytest.fail("The downloaded Word document is empty.")
