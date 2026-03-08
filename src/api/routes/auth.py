"""
Authentication routes.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.api.auth import create_access_token, verify_password
from src.api.database import get_db
from src.api.schemas import LoginRequest, LoginResponse, UserOut
from src.database.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Annotated[Session, Depends(get_db)]) -> LoginResponse:
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
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
