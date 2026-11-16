"""
Database connection. Uses DATABASE_URL (Postgres in production) and falls
back to a local SQLite file for development. The SQLite path is pinned to
the backend folder so it never depends on the working directory.
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_url = os.getenv("DATABASE_URL", "").strip()
if _url.startswith("postgres://"):
    _url = _url.replace("postgres://", "postgresql://", 1)
if _url.startswith("postgresql://"):
    _url = _url.replace("postgresql://", "postgresql+psycopg2://", 1)

DATABASE_URL = _url or f"sqlite:///{os.path.join(_BACKEND_DIR, 'clearreq.db')}"
_is_sqlite = DATABASE_URL.startswith("sqlite")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate_legacy_user_auth():
    """Replace legacy password credentials with a nullable Supabase identity link."""
    columns = {column["name"] for column in inspect(engine).get_columns("users")}
    with engine.begin() as connection:
        if "supabase_user_id" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN supabase_user_id VARCHAR"))
        if "password_hash" in columns:
            connection.execute(text("ALTER TABLE users DROP COLUMN password_hash"))
        connection.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_supabase_user_id "
            "ON users (supabase_user_id)"
        ))


def migrate_session_name():
    """Add an optional name to existing and new sessions."""
    columns = {column["name"] for column in inspect(engine).get_columns("sessions")}
    if "name" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE sessions ADD COLUMN name VARCHAR(120)"))


def migrate_session_discovery():
    """Keep discovery on the first project session and inherit it in later sessions."""
    columns = {column["name"] for column in inspect(engine).get_columns("sessions")}
    if "discovery_required" in columns:
        return

    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE sessions ADD COLUMN discovery_required BOOLEAN NOT NULL DEFAULT TRUE"
        ))
        rows = connection.execute(text(
            "SELECT id, project_id FROM sessions ORDER BY project_id, id"
        )).mappings().all()
        sessions_by_project = {}
        for row in rows:
            sessions_by_project.setdefault(row["project_id"], []).append(row["id"])

        for session_ids in sessions_by_project.values():
            if len(session_ids) < 2:
                continue
            first_answers = connection.execute(
                text(
                    "SELECT question, answer, answered_at FROM discovery_answers "
                    "WHERE session_id = :session_id ORDER BY id"
                ),
                {"session_id": session_ids[0]},
            ).mappings().all()
            for session_id in session_ids[1:]:
                connection.execute(
                    text("UPDATE sessions SET discovery_required = FALSE WHERE id = :session_id"),
                    {"session_id": session_id},
                )
                connection.execute(
                    text("DELETE FROM discovery_answers WHERE session_id = :session_id"),
                    {"session_id": session_id},
                )
                for answer in first_answers:
                    connection.execute(
                        text(
                            "INSERT INTO discovery_answers "
                            "(session_id, question, answer, answered_at) "
                            "VALUES (:session_id, :question, :answer, :answered_at)"
                        ),
                        {
                            "session_id": session_id,
                            "question": answer["question"],
                            "answer": answer["answer"],
                            "answered_at": answer["answered_at"],
                        },
                    )
