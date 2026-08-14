"""
Database connection setup.

SQLite is used deliberately for this project scope — see
docs/enhanced_blueprint.md for the reasoning and the migration path to
Postgres + pgvector if the project grows beyond FYP scope.

The database file path is pinned to this module's directory rather than
left relative to the process's current working directory — otherwise
running `uvicorn` from a different folder silently creates a second,
empty database instead of erroring or connecting to the real one.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_URL = f"sqlite:///{os.path.join(_BACKEND_DIR, 'clearreq.db')}"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        