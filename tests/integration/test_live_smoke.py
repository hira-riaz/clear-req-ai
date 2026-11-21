import os

import pytest

from app import auth, main


@pytest.mark.skipif(
    os.getenv("CLEARREQ_LIVE_SUPABASE") != "1",
    reason="Set CLEARREQ_LIVE_SUPABASE=1 to contact the configured Supabase Auth service.",
)
def test_live_supabase_auth_rejects_invalid_test_token(client):
    if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_ANON_KEY"):
        pytest.skip("Supabase URL or anon key is not configured.")

    auth_override = main.app.dependency_overrides.pop(auth.get_current_user)
    try:
        response = client.get(
            "/sessions",
            headers={"Authorization": "Bearer clearreq-integration-invalid-token"},
        )
    finally:
        main.app.dependency_overrides[auth.get_current_user] = auth_override

    assert response.status_code == 401


@pytest.mark.skipif(
    os.getenv("CLEARREQ_LIVE_AI") != "1",
    reason="Set CLEARREQ_LIVE_AI=1 to make one small request to the configured AI provider.",
)
def test_live_ai_provider_smoke():
    if not os.getenv("GEMINI_API_KEY") and not os.getenv("GROQ_API_KEY"):
        pytest.skip("No Gemini or Groq API key is configured.")

    response = main.ai_provider._call_with_fallback(
        "Reply with exactly the word OK."
    )
    assert "OK" in response
