import os
import sys
from pathlib import Path

# The application creates its engine at import time. Keep test imports away
# from the application's configured database.
os.environ["DATABASE_URL"] = "sqlite://"
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import auth, database, main, models


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    models.Base.metadata.create_all(bind=engine)
    test_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
    try:
        yield test_session
    finally:
        test_session.close()
        models.Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def test_user(db):
    user = models.User(
        name="Integration Tester",
        email="integration-tester@example.test",
        supabase_user_id="test-supabase-user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def client(db, test_user):
    def override_get_db():
        yield db

    main.app.dependency_overrides[database.get_db] = override_get_db
    main.app.dependency_overrides[auth.get_current_user] = lambda: test_user
    try:
        with TestClient(main.app) as test_client:
            yield test_client
    finally:
        main.app.dependency_overrides.clear()


@pytest.fixture
def create_session(db, test_user):
    def create(project_name="Integration Test Project", session_name="Integration Session"):
        project = models.Project(name=project_name, user_id=test_user.id)
        db.add(project)
        db.flush()
        session = models.Session(project_id=project.id, name=session_name)
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    return create
