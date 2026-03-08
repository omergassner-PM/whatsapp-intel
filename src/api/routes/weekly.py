"""
Weekly digest routes.
"""

import math
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.api.auth import get_current_user
from src.api.database import get_db
from src.api.schemas import (
    ArticleListItem,
    PaginatedDigests,
    WeeklyDigestDetail,
    WeeklyDigestItem,
)
from src.database.models import (
    Article,
    ProcessedItem,
    RawMessage,
    User,
    WeeklyDigest,
)

router = APIRouter(prefix="/weekly", tags=["weekly"])


@router.get("", response_model=PaginatedDigests)
def list_digests(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
) -> PaginatedDigests:
    total = db.query(WeeklyDigest).count()
    pages = max(1, math.ceil(total / limit))

    digests = (
        db.query(WeeklyDigest)
        .order_by(WeeklyDigest.week_start.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    items = [
        WeeklyDigestItem(
            id=d.id,
            week_start=d.week_start,
            week_end=d.week_end,
            summary=d.executive_summary,
            article_count=d.article_count,
            top_items=d.top_stories or [],
        )
        for d in digests
    ]

    return PaginatedDigests(items=items, total=total, page=page)


@router.get("/{digest_id}", response_model=WeeklyDigestDetail)
def get_digest(
    digest_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
) -> WeeklyDigestDetail:
    digest = db.query(WeeklyDigest).filter(WeeklyDigest.id == digest_id).first()
    if not digest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Digest not found")

    # Get articles from that week
    rows = (
        db.query(Article, ProcessedItem, RawMessage)
        .outerjoin(ProcessedItem, ProcessedItem.article_id == Article.id)
        .outerjoin(RawMessage, RawMessage.id == Article.message_id)
        .filter(
            Article.scrape_status == "success",
            Article.created_at >= digest.week_start,
            Article.created_at <= digest.week_end,
        )
        .order_by(ProcessedItem.relevance_score.desc().nullslast())
        .all()
    )

    articles = [
        ArticleListItem(
            id=a.id,
            title=a.title,
            source_url=a.source_url,
            published_date=a.published_date,
            tldr=p.tldr if p else None,
            tags=p.tags if p else [],
            relevance_score=p.relevance_score if p else None,
            shared_by=m.sender if m else None,
            shared_at=m.timestamp if m else None,
        )
        for a, p, m in rows
    ]

    return WeeklyDigestDetail(
        id=digest.id,
        week_start=digest.week_start,
        week_end=digest.week_end,
        summary=digest.executive_summary,
        article_count=digest.article_count,
        top_items=digest.top_stories or [],
        key_trends=digest.key_trends or [],
        watch_list=digest.watch_list or [],
        articles=articles,
        created_at=digest.created_at,
    )
