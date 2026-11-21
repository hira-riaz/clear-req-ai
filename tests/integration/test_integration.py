from app import auth, main, models


def test_it_01_frontend_served_and_api_creates_project_session(client):
    home = client.get("/")
    assert home.status_code == 200
    assert 'id="app"' in home.text

    project_response = client.post(
        "/projects",
        json={"project_name": "Integration Project", "client_name": "Test Client"},
    )
    assert project_response.status_code == 200
    project_id = project_response.json()["project_id"]

    session_response = client.post(
        f"/projects/{project_id}/sessions",
        json={"session_name": "Requirements Session"},
    )
    assert session_response.status_code == 200
    session_data = session_response.json()
    assert session_data["discovery_required"] is True

    listed_sessions = client.get("/sessions")
    assert listed_sessions.status_code == 200
    assert any(item["session_id"] == session_data["session_id"] for item in listed_sessions.json())


def test_it_02_auth_identity_mapping_persists_and_missing_token_is_rejected(
    client, db, test_user, monkeypatch
):
    from types import SimpleNamespace

    from fastapi.security import HTTPAuthorizationCredentials

    supabase_user = SimpleNamespace(
        id="supabase-mapped-user",
        email="mapped-user@example.test",
        email_confirmed_at="2026-01-01T00:00:00Z",
        user_metadata={"name": "Mapped User"},
    )
    fake_supabase = SimpleNamespace(
        auth=SimpleNamespace(
            get_user=lambda token: SimpleNamespace(user=supabase_user)
        )
    )
    monkeypatch.setattr(auth, "get_supabase_client", lambda: fake_supabase)

    mapped_user = auth.get_current_user(
        HTTPAuthorizationCredentials(scheme="Bearer", credentials="test-token"),
        db,
    )
    assert mapped_user.supabase_user_id == "supabase-mapped-user"
    assert db.query(models.User).filter_by(
        supabase_user_id="supabase-mapped-user"
    ).one().email == "mapped-user@example.test"

    auth_override = main.app.dependency_overrides.pop(auth.get_current_user)
    try:
        response = client.get("/sessions")
    finally:
        main.app.dependency_overrides[auth.get_current_user] = auth_override
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_it_03_analysis_clarification_translation_and_database_persistence(
    client, db, create_session, monkeypatch
):
    session = create_session()
    monkeypatch.setattr(
        main.ai_provider,
        "detect_ambiguity",
        lambda text: [{
            "term": "fast",
            "category": "performance",
            "detector": "ai",
            "confidence": 0.9,
            "question": "What response time is required?",
        }],
    )
    monkeypatch.setattr(main.ai_provider, "check_conflicts", lambda text, existing: [])
    monkeypatch.setattr(
        main.ai_provider,
        "generate_answer_options",
        lambda text, ambiguities: {
            "fast": ["Within 2 seconds", "Within 5 seconds"]
        },
    )
    translation_inputs = {}

    def translate(text, clarifications, context, discovery):
        translation_inputs["clarifications"] = clarifications
        return {
            "translated_text": "The system shall respond within 2 seconds.",
            "confidence": 0.95,
        }

    monkeypatch.setattr(main.ai_provider, "translate_and_verify", translate)

    analysis = client.post(
        "/requirements/analyze",
        json={
            "session_id": session.id,
            "text": "The system should be fast.",
        },
    )
    assert analysis.status_code == 200
    result = analysis.json()
    assert len(result["ambiguities"]) == 1
    ambiguity_id = result["ambiguities"][0]["ambiguity_id"]

    translated = client.post(
        "/requirements/translate",
        json={
            "requirement_id": result["requirement_id"],
            "answers": [{
                "ambiguity_id": ambiguity_id,
                "answer": "Within 2 seconds",
            }],
        },
    )
    assert translated.status_code == 200
    assert translated.json()["version_number"] == 1
    assert translated.json()["translated_text"] == "The system shall respond within 2 seconds."
    assert translation_inputs["clarifications"][0]["answer"] == "Within 2 seconds"

    requirement = db.get(models.Requirement, result["requirement_id"])
    assert requirement.status == "translated"
    version = db.query(models.RequirementVersion).filter_by(
        requirement_id=requirement.id
    ).one()
    assert version.translated_text == translated.json()["translated_text"]
    clarification = db.query(models.Clarification).filter_by(
        ambiguity_id=ambiguity_id
    ).one()
    assert clarification.answer == "Within 2 seconds"
    assert clarification.answered_at is not None


def test_it_04_conflict_analysis_saves_conflict_and_clarification(
    client, db, create_session, monkeypatch
):
    session = create_session()
    existing = models.Requirement(
        session_id=session.id,
        original_text="The application requires authenticated access.",
        status="translated",
    )
    db.add(existing)
    db.flush()
    db.add(models.RequirementVersion(
        requirement_id=existing.id,
        version_number=1,
        translated_text="The application requires authenticated access.",
        confidence_score=0.9,
    ))
    db.commit()

    monkeypatch.setattr(main.ai_provider, "detect_ambiguity", lambda text: [])
    monkeypatch.setattr(
        main.ai_provider,
        "check_conflicts",
        lambda text, existing_texts: [{
            "conflicts_with": existing_texts[0],
            "question": "Should access require authentication?",
        }],
    )
    monkeypatch.setattr(main.ai_provider, "generate_answer_options", lambda text, findings: {})

    response = client.post(
        "/requirements/analyze",
        json={
            "session_id": session.id,
            "text": "The application allows unauthenticated access.",
        },
    )
    assert response.status_code == 200
    conflict = next(
        item for item in response.json()["ambiguities"]
        if item["category"] == "conflict"
    )
    assert conflict["category"] == "conflict"
    assert conflict["question"] == "Should access require authentication?"

    saved_ambiguity = db.get(models.Ambiguity, conflict["ambiguity_id"])
    assert saved_ambiguity.category == "conflict"
    saved_clarification = db.query(models.Clarification).filter_by(
        ambiguity_id=saved_ambiguity.id
    ).one()
    assert saved_clarification.question == conflict["question"]


def test_it_05_report_retrieval_and_docx_generation(
    client, db, create_session
):
    session = create_session()
    db.add(models.DiscoveryAnswer(
        session_id=session.id,
        question="What platform should this system run on?",
        answer="Web",
    ))
    requirement = models.Requirement(
        session_id=session.id,
        original_text="The system shall respond within 2 seconds.",
        status="approved",
    )
    db.add(requirement)
    db.flush()
    db.add(models.RequirementVersion(
        requirement_id=requirement.id,
        version_number=1,
        translated_text="The system shall respond within 2 seconds.",
        confidence_score=0.95,
    ))
    db.commit()

    report = client.get(f"/sessions/{session.id}/report")
    assert report.status_code == 200
    report_data = report.json()
    assert report_data["discovery"][0]["answer"] == "Web"
    assert report_data["requirements"][0]["translated_text"] == (
        "The system shall respond within 2 seconds."
    )

    docx_response = client.get(f"/sessions/{session.id}/report/docx")
    assert docx_response.status_code == 200
    assert docx_response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert len(docx_response.content) > 0

    from docx import Document
    from io import BytesIO

    document = Document(BytesIO(docx_response.content))
    paragraphs = "\n".join(paragraph.text for paragraph in document.paragraphs)
    assert "Integration Test Project" in paragraphs
    assert "The system shall respond within 2 seconds." in paragraphs
