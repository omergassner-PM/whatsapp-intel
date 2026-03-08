"""
Tag listing route.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from src.api.auth import get_current_user
from src.api.database import get_db
from src.api.schemas import TagCount, TagsResponse
from src.database.models import ProcessedItem, User

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=TagsResponse)
def list_tags(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
) -> TagsResponse:
    # Unnest the tags array and count occurrences
    tag_col = func.unnest(ProcessedItem.tags).label("tag")
    rows = (
        db.query(tag_col, func.count().label("cnt"))
        .group_by("tag")
        .order_by(func.count().desc())
        .all()
    )

    return TagsResponse(
        tags=[TagCount(name=row.tag, count=row.cnt) for row in rows]
    )
