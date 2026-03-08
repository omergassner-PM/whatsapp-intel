"""
Search routes — full-text search across processed content.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, func, or_
from sqlalchemy.orm import Session

from src.api.auth import get_current_user
from src.api.database import get_db
from src.api.schemas import SearchResponse, SearchResult
from src.database.models import Article, ProcessedItem, User

router = APIRouter(prefix="/search", tags=["search"])


def _snippet(text: str | None, query: str, window: int = 120) -> str | None:
    if not text:
        return None
    lower = text.lower()
    idx = lower.find(query.lower())
    if idx == -1:
        return text[:window] + "..." if len(text) > window else text
    start = max(0, idx - window // 2)
    end = min(len(text), idx + len(query) + window // 2)
    snippet = text[start:end]
    if start > 0:
        snippet = "..." + snippet
    if end < len(text):
        snippet = snippet + "..."
    return snippet


@router.get("", response_model=SearchResponse)
def search(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
    q: str = Query(..., min_length=1),
    type: str = Query("text", pattern="^(text|semantic)$"),
    limit: int = Query(20, ge=1, le=100),
) -> SearchResponse:
    if not q.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Query cannot be empty")

    pattern = f"%{q}%"

    query = (
        db.query(Article, ProcessedItem)
        .join(ProcessedItem, ProcessedItem.article_id == Article.id)
        .filter(
            Article.scrape_status == "success",
            or_(
                Article.title.ilike(pattern),
                Article.clean_text.ilike(pattern),
                ProcessedItem.tldr.ilike(pattern),
                func.cast(ProcessedItem.key_facts, String).ilike(pattern),
            ),
        )
        .order_by(ProcessedItem.relevance_score.desc().nullslast())
        .limit(limit)
        .all()
    )

    results = []
    for article, processed in query:
        # Build match snippet from whichever field matched
        snippet = None
        for text in [processed.tldr, article.clean_text, article.title]:
            if text and q.lower() in text.lower():
                snippet = _snippet(text, q)
                break
        if not snippet and processed.tldr:
            snippet = processed.tldr

        results.append(
            SearchResult(
                id=article.id,
                title=article.title,
                tldr=processed.tldr,
                relevance_score=processed.relevance_score,
                match_snippet=snippet,
                match_score=processed.relevance_score / 5.0 if processed.relevance_score else 0.0,
            )
        )

    return SearchResponse(results=results, total=len(results), query=q)
