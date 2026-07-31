from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    sessions = relationship("Session", back_populates="project")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="sessions")
    requirements = relationship("Requirement", back_populates="session")


class Requirement(Base):
    __tablename__ = "requirements"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    original_text = Column(Text, nullable=False)
    # pending -> needs_clarification -> ready_for_translation -> translated -> verified
    status = Column(String, default="pending")
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="requirements")
    clarifications = relationship(
        "Clarification", back_populates="requirement", cascade="all, delete-orphan"
    )
    translation = relationship(
        "TranslatedRequirement", back_populates="requirement", uselist=False
    )


class Clarification(Base):
    __tablename__ = "clarifications"

    id = Column(Integer, primary_key=True)
    requirement_id = Column(Integer, ForeignKey("requirements.id"))
    category = Column(String)
    question = Column(Text)
    answer = Column(Text, nullable=True)
    # how confident the rule-based detector was that this is a real ambiguity
    confidence = Column(Float, default=0.0)

    requirement = relationship("Requirement", back_populates="clarifications")


class TranslatedRequirement(Base):
    __tablename__ = "translated_requirements"

    id = Column(Integer, primary_key=True)
    requirement_id = Column(Integer, ForeignKey("requirements.id"))
    translated_text = Column(Text)
    # True if any part of this text was inferred beyond what clarification answers said
    is_ai_inferred = Column(Boolean, default=False)
    confidence_score = Column(Float, default=1.0)
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    requirement = relationship("Requirement", back_populates="translation")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True)
    entity_type = Column(String)
    entity_id = Column(Integer)
    action = Column(String)
    actor = Column(String, default="system")
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
