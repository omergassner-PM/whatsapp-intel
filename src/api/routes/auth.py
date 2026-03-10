"""
Authentication routes — login, viewer registration, dev login.
"""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.api.auth import create_access_token, hash_password, verify_password
from src.api.database import get_db
from src.api.schemas import LoginRequest, LoginResponse, UserOut, ViewerRegisterRequest
from src.database.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

DEV_USERNAME = "admin"
DEV_DISPLAY = "Admin"


def _ensure_dev_user(db: Session) -> User:
    """Create or fetch the dev admin user (admin/admin)."""
    user = db.query(User).filter(User.username == DEV_USERNAME).first()
    if not user:
        user = User(
            username=DEV_USERNAME,
            password_hash=hash_password("admin"),
            display_name=DEV_DISPLAY,
            role="admin",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info("Created dev admin user '%s'", DEV_USERNAME)
    return user


@router.post("/dev-login", response_model=LoginResponse)
def dev_login(db: Annotated[Session, Depends(get_db)]) -> LoginResponse:
    """Auto-login as admin — for development/testing only."""
    user = _ensure_dev_user(db)
    token = create_access_token(user.id, user.role)
    return LoginResponse(
        access_token=token,
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Annotated[Session, Depends(get_db)]) -> LoginResponse:
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    token = create_access_token(user.id, user.role)
    return LoginResponse(
        access_token=token,
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=LoginResponse)
def register_viewer(
    body: ViewerRegisterRequest,
    db: Annotated[Session, Depends(get_db)],
) -> LoginResponse:
    """Viewer self-registration with name + email only (no password)."""
    # Check if email already registered
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        # Auto-login returning viewers
        token = create_access_token(existing.id, existing.role)
        return LoginResponse(
            access_token=token,
            user=UserOut.model_validate(existing),
        )

    # Create new viewer
    username = body.email.split("@")[0] + "_" + uuid.uuid4().hex[:6]
    user = User(
        username=username,
        email=body.email,
        password_hash=None,
        display_name=body.name,
        role="viewer",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("New viewer registered: %s (%s)", body.name, body.email)

    token = create_access_token(user.id, user.role)
    return LoginResponse(
        access_token=token,
        user=UserOut.model_validate(user),
    )
