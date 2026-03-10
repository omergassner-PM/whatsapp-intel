"""
Authentication routes — login and viewer registration.
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

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "Admin1812"
ADMIN_DISPLAY = "Admin"


def _ensure_admin_user(db: Session) -> None:
    """Create the admin user on first run if it doesn't exist."""
    user = db.query(User).filter(User.username == ADMIN_USERNAME).first()
    if not user:
        user = User(
            username=ADMIN_USERNAME,
            password_hash=hash_password(ADMIN_PASSWORD),
            display_name=ADMIN_DISPLAY,
            role="admin",
            is_active=True,
        )
        db.add(user)
        db.commit()
        logger.info("Created admin user '%s'", ADMIN_USERNAME)


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Annotated[Session, Depends(get_db)]) -> LoginResponse:
    # Ensure admin exists on first login attempt
    _ensure_admin_user(db)

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
