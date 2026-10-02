"""ORM models. Versioned by design: a Requirement can have many RequirementVersions."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    name = Column(String, nullable=False)
    client_name = Column(String)
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
    session_id = Column(Integer, ForeignKey("sessions.id"), index=True)
    original_text = Column(Text, nullable=False)
    status = Column(String, default="draft")  # clarifying / translated / approved
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="requirements")
    ambiguities = relationship("Ambiguity", back_populates="requirement")
    versions = relationship("RequirementVersion", back_populates="requirement")


class Ambiguity(Base):
    __tablename__ = "ambiguities"
    id = Column(Integer, primary_key=True)
    requirement_id = Column(Integer, ForeignKey("requirements.id"), index=True)
    term = Column(String, nullable=False)
    category = Column(String)
    detector = Column(String)
    confidence = Column(Float, default=1.0)

    requirement = relationship("Requirement", back_populates="ambiguities")
    clarification = relationship("Clarification", back_populates="ambiguity", uselist=False)


class Clarification(Base):
    __tablename__ = "clarifications"
    id = Column(Integer, primary_key=True)
    ambiguity_id = Column(Integer, ForeignKey("ambiguities.id"), index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=True)
    answered_at = Column(DateTime, nullable=True)

    ambiguity = relationship("Ambiguity", back_populates="clarification")


class RequirementVersion(Base):
    __tablename__ = "requirement_versions"
    id = Column(Integer, primary_key=True)
    requirement_id = Column(Integer, ForeignKey("requirements.id"), index=True)
    version_number = Column(Integer, default=1)
    translated_text = Column(Text, nullable=False)
    confidence_score = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

    requirement = relationship("Requirement", back_populates="versions")


class Approval(Base):
    __tablename__ = "approvals"
    id = Column(Integer, primary_key=True)
    requirement_version_id = Column(Integer, ForeignKey("requirement_versions.id"), index=True)
    approved_by = Column(String)
    approved_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)


class DiscoveryAnswer(Base):
    __tablename__ = "discovery_answers"
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=True)
    answered_at = Column(DateTime, default=datetime.utcnow)
