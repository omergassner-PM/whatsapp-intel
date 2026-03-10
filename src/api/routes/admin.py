"""
Admin routes — user management, ingestion logs, user activity, export management.
"""

import csv
import io
import math
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from src.api.auth import get_current_user, hash_password, require_admin
from src.api.database import get_db
from src.api.schemas import (
    AdminUserOut,
    CreateUserRequest,
    IngestionLogOut,
    PaginatedActivity,
    PaginatedLogs,
    UpdateUserRequest,
    UserActivityOut,
)
from src.database.models import (
    Article,
    IngestionLog,
    ProcessedItem,
    RawMessage,
    User,
    UserActivity,
)

router = APIRouter(prefix="/admin", tags=["admin"])


# --- Stats ---

@router.get("/stats")
def get_stats(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Dashboard stats — available to all logged-in users."""
    total_articles = db.query(func.count(Article.id)).filter(Article.scrape_status == "success").scalar() or 0
    total_messages = db.query(func.count(RawMessage.id)).scalar() or 0
    total_urls = db.query(func.count(Article.id)).scalar() or 0
    total_processed = db.query(func.count(ProcessedItem.id)).scalar() or 0
    pending_processing = total_articles - total_processed

    # Tag breakdown
    tag_col = func.unnest(ProcessedItem.tags).label("tag")
    tag_rows = (
        db.query(tag_col, func.count().label("cnt"))
        .group_by("tag")
        .order_by(func.count().desc())
        .limit(20)
        .all()
    )
    top_tags = [{"name": r.tag, "count": r.cnt} for r in tag_rows]

    # Recent activity count
    from datetime import timedelta
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    articles_this_week = db.query(func.count(Article.id)).filter(
        Article.created_at >= week_ago, Article.scrape_status == "success"
    ).scalar() or 0

    return {
        "total_articles": total_articles,
        "total_messages": total_messages,
        "total_urls": total_urls,
        "total_processed": total_processed,
        "pending_processing": pending_processing,
        "articles_this_week": articles_this_week,
        "top_tags": top_tags,
    }


# --- Users ---

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


# --- Ingestion Logs ---

@router.get("/logs", response_model=PaginatedLogs)
def list_logs(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> PaginatedLogs:
    total = db.query(func.count(IngestionLog.id)).scalar() or 0
    pages = max(1, math.ceil(total / limit))
    logs = (
        db.query(IngestionLog)
        .order_by(IngestionLog.started_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return PaginatedLogs(
        items=[IngestionLogOut.model_validate(log) for log in logs],
        total=total,
        page=page,
        pages=pages,
    )


@router.delete("/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ingestion_log(
    log_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
) -> None:
    """Delete an ingestion log and all associated data (messages, articles, processed items)."""
    log = db.query(IngestionLog).filter(IngestionLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log not found")

    # Find and delete all data from this export
    messages = db.query(RawMessage).filter(RawMessage.export_file.contains(log.export_filename)).all()
    msg_ids = [m.id for m in messages]

    if msg_ids:
        # Delete processed items for articles from these messages
        articles = db.query(Article).filter(Article.message_id.in_(msg_ids)).all()
        article_ids = [a.id for a in articles]
        if article_ids:
            db.query(ProcessedItem).filter(ProcessedItem.article_id.in_(article_ids)).delete(synchronize_session=False)
            db.query(Article).filter(Article.id.in_(article_ids)).delete(synchronize_session=False)
        db.query(RawMessage).filter(RawMessage.id.in_(msg_ids)).delete(synchronize_session=False)

    db.delete(log)
    db.commit()


# --- User Activity ---

@router.get("/activity", response_model=PaginatedActivity)
def list_activity(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    action: str | None = None,
) -> PaginatedActivity:
    query = db.query(UserActivity, User).join(User, User.id == UserActivity.user_id)
    if action:
        query = query.filter(UserActivity.action == action)
    total = query.count()
    pages = max(1, math.ceil(total / limit))
    rows = (
        query.order_by(UserActivity.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    items = []
    for activity, user in rows:
        items.append(
            UserActivityOut(
                id=activity.id,
                user_id=activity.user_id,
                username=user.display_name or user.username,
                action=activity.action,
                detail=activity.detail,
                created_at=activity.created_at,
            )
        )
    return PaginatedActivity(items=items, total=total, page=page, pages=pages)


# --- Download / Export ---

@router.get("/export/csv")
def export_articles_csv(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> StreamingResponse:
    """Export all articles as CSV. Available to all logged-in users. Logs the download."""
    # Log the download activity
    activity = UserActivity(
        user_id=current_user.id,
        action="download",
        detail="articles_export.csv",
    )
    db.add(activity)
    db.commit()

    rows = (
        db.query(Article, ProcessedItem, RawMessage)
        .outerjoin(ProcessedItem, ProcessedItem.article_id == Article.id)
        .outerjoin(RawMessage, RawMessage.id == Article.message_id)
        .filter(Article.scrape_status == "success")
        .order_by(Article.created_at.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Title", "URL", "Published Date", "TLDR", "Tags",
        "Relevance Score", "Shared By", "Key Facts", "Technologies",
    ])

    for article, processed, message in rows:
        writer.writerow([
            article.title or "",
            article.source_url,
            str(article.published_date) if article.published_date else "",
            processed.tldr if processed else "",
            ", ".join(processed.tags) if processed and processed.tags else "",
            processed.relevance_score if processed else "",
            message.sender if message else "",
            "; ".join(str(f) for f in (processed.key_facts or [])) if processed else "",
            ", ".join(str(t) for t in (processed.technologies or [])) if processed else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=aerodata_articles_export.csv"},
    )
