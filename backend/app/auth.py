"""Supabase JWT verification and local ownership identity mapping."""
import os
from functools import lru_cache

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession
from supabase import AuthApiError, AuthRetryableError, Client, create_client

from . import models
from .database import get_db

bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL", "").strip()
    anon_key = os.getenv("SUPABASE_ANON_KEY", "").strip()
    if not url or not anon_key:
        raise HTTPException(
            status_code=503,
            detail="Supabase authentication is not configured on the server.",
        )
    return create_client(url, anon_key)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: DBSession = Depends(get_db),
) -> models.User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        result = get_supabase_client().auth.get_user(credentials.credentials)
    except AuthApiError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired Supabase token") from exc
    except (AuthRetryableError, httpx.HTTPError) as exc:
        raise HTTPException(status_code=503, detail="Supabase authentication is temporarily unavailable") from exc

    supabase_user = result.user
    if supabase_user is None or not supabase_user.id:
        raise HTTPException(status_code=401, detail="Invalid Supabase user")

    user = db.query(models.User).filter(
        models.User.supabase_user_id == supabase_user.id
    ).first()
    email = (supabase_user.email or "").strip().lower()
    email_verified = bool(getattr(supabase_user, "email_confirmed_at", None))

    if user is None and email and email_verified:
        user = db.query(models.User).filter(
            models.User.email == email,
            models.User.supabase_user_id.is_(None),
        ).first()
        if user is not None:
            user.supabase_user_id = supabase_user.id
    elif user is not None and email and email_verified:
        legacy_user = db.query(models.User).filter(
            models.User.email == email,
            models.User.supabase_user_id.is_(None),
            models.User.id != user.id,
        ).first()
        if legacy_user is not None:
            db.query(models.Project).filter(
                models.Project.user_id == legacy_user.id
            ).update({"user_id": user.id}, synchronize_session=False)
            db.delete(legacy_user)

    metadata = supabase_user.user_metadata or {}
    name = metadata.get("name") or metadata.get("full_name") or email or "Supabase user"
    if user is None:
        stored_email = email if email and db.query(models.User).filter(
            models.User.email == email
        ).first() is None else f"supabase-{supabase_user.id}@users.clearreq.local"
        user = models.User(
            name=str(name)[:255],
            email=stored_email,
            supabase_user_id=supabase_user.id,
        )
        db.add(user)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        user = db.query(models.User).filter(
            models.User.supabase_user_id == supabase_user.id
        ).first()
        if user is None:
            raise HTTPException(status_code=409, detail="Unable to create the local Supabase identity")
    db.refresh(user)
    return user
