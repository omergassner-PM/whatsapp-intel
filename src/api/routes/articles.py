"""
Article list and detail routes.
"""

import math
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from src.api.auth import get_current_user
from src.api.database import get_db
from src.api.schemas import ArticleDetail, ArticleListItem, PaginatedArticles
from src.database.models import Article, ProcessedItem, RawMessage, User

router = APIRouter(prefix="/articles", tags=["articles"])


@router.get("", response_model=PaginatedArticles)
def list_articles(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    tag: str | None = None,
    week: str | None = None,
    min_score: int | None = Query(None, ge=1, le=5),
    search: str | None = None,
    sort: str = Query("date", pattern="^(date|relevance|title)$"),
) -> PaginatedArticles:
    query = (
        db.query(Article, ProcessedItem, RawMessage)
        .outerjoin(ProcessedItem, ProcessedItem.article_id == Article.id)
        .outerjoin(RawMessage, RawMessage.id == Article.message_id)
        .filter(Article.scrape_status == "success")
    )

    if tag:
        query = query.filter(ProcessedItem.tags.any(tag))
    if min_score:
        query = query.filter(ProcessedItem.relevance_score >= min_score)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                Article.title.ilike(pattern),
                ProcessedItem.tldr.ilike(pattern),
            )
        )
    if week:
        # Format: YYYY-Wnn
        try:
            from datetime import datetime
            year, wk = week.split("-W")
            # Monday of that ISO week
            week_start = datetime.strptime(f"{year}-W{wk}-1", "%Y-W%W-%w").date()
            week_end = week_start + __import__("datetime").timedelta(days=6)
            query = query.filter(
                RawMessage.timestamp >= week_start,
                RawMessage.timestamp <= week_end,
            )
        except (ValueError, AttributeError):
            pass

    # Sorting
    if sort == "relevance":
        query = query.order_by(ProcessedItem.relevance_score.desc().nullslast())
    elif sort == "title":
        query = query.order_by(Article.title.asc().nullslast())
    else:
        query = query.order_by(Article.created_at.desc())

    total = query.count()
    pages = max(1, math.ceil(total / limit))
    rows = query.offset((page - 1) * limit).limit(limit).all()

    items = []
    for article, processed, message in rows:
        items.append(
            ArticleListItem(
                id=article.id,
                title=article.title,
                source_url=article.source_url,
                published_date=article.published_date,
                tldr=processed.tldr if processed else None,
                tags=processed.tags if processed else [],
                relevance_score=processed.relevance_score if processed else None,
                shared_by=message.sender if message else None,
                shared_at=message.timestamp if message else None,
                language=processed.language if processed else None,
            )
        )

    return PaginatedArticles(items=items, total=total, page=page, pages=pages)


@router.get("/{article_id}", response_model=ArticleDetail)
def get_article(
    article_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
) -> ArticleDetail:
    row = (
        db.query(Article, ProcessedItem, RawMessage)
        .outerjoin(ProcessedItem, ProcessedItem.article_id == Article.id)
        .outerjoin(RawMessage, RawMessage.id == Article.message_id)
        .filter(Article.id == article_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    article, processed, message = row
    return ArticleDetail(
        id=article.id,
        title=article.title,
        source_url=article.source_url,
        published_date=article.published_date,
        clean_text=article.clean_text,
        word_count=article.word_count or 0,
        tldr=processed.tldr if processed else None,
        key_facts=processed.key_facts if processed else [],
        people=processed.people if processed else [],
        technologies=processed.technologies if processed else [],
        dates=processed.dates if processed else [],
        action_items=processed.action_items if processed else [],
        tags=processed.tags if processed else [],
        relevance_score=processed.relevance_score if processed else None,
        shared_by=message.sender if message else None,
        shared_at=message.timestamp if message else None,
        processed_at=processed.processed_at if processed else None,
        language=processed.language if processed else None,
    )
