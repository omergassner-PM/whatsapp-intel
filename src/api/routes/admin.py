"""
Admin routes — user management and ingestion logs.
"""

import math
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.api.auth import hash_password, require_admin
from src.api.database import get_db
from src.api.schemas import (
    AdminUserOut,
    CreateUserRequest,
    IngestionLogOut,
    UpdateUserRequest,
)
from src.database.models import IngestionLog, User

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> list[AdminUserOut]:
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [AdminUserOut.model_validate(u) for u in users]


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: CreateUserRequest,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> AdminUserOut:
    existing = db.query(User).filter(User.username == body.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        display_name=body.display_name or body.username,
        role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return AdminUserOut.model_validate(user)


@router.put("/users/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: UUID,
    body: UpdateUserRequest,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> AdminUserOut:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if body.display_name is not None:
        user.display_name = body.display_name
    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.password is not None:
        user.password_hash = hash_password(body.password)

    db.commit()
    db.refresh(user)
    return AdminUserOut.model_validate(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(
    user_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> None:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = False
    db.commit()


@router.get("/logs", response_model=list[IngestionLogOut])
def list_logs(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> list[IngestionLogOut]:
    logs = (
        db.query(IngestionLog)
        .order_by(IngestionLog.started_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return [IngestionLogOut.model_validate(log) for log in logs]
