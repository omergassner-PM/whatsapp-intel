"""
Pydantic schemas for API request/response models.
"""

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


# --- Auth ---

class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: UUID
    username: str
    display_name: str | None
    role: str

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 86400
    user: UserOut


# --- Articles ---

class ArticleListItem(BaseModel):
    id: UUID
    title: str | None
    source_url: str
    published_date: date | None
    tldr: str | None = None
    tags: list[str] = []
    relevance_score: int | None = None
    shared_by: str | None = None
    shared_at: datetime | None = None


class PaginatedArticles(BaseModel):
    items: list[ArticleListItem]
    total: int
    page: int
    pages: int


class ArticleDetail(BaseModel):
    id: UUID
    title: str | None
    source_url: str
    published_date: date | None
    clean_text: str | None
    word_count: int
    tldr: str | None = None
    key_facts: list[Any] = []
    people: list[Any] = []
    technologies: list[Any] = []
    dates: list[Any] = []
    action_items: list[Any] = []
    tags: list[str] = []
    relevance_score: int | None = None
    shared_by: str | None = None
    shared_at: datetime | None = None
    processed_at: datetime | None = None


# --- Weekly Digests ---

class WeeklyDigestItem(BaseModel):
    id: UUID
    week_start: date
    week_end: date
    summary: str | None = None
    article_count: int
    top_items: list[Any] = []


class PaginatedDigests(BaseModel):
    items: list[WeeklyDigestItem]
    total: int
    page: int


class WeeklyDigestDetail(BaseModel):
    id: UUID
    week_start: date
    week_end: date
    summary: str | None = None
    article_count: int
    top_items: list[Any] = []
    key_trends: list[Any] = []
    watch_list: list[Any] = []
    articles: list[ArticleListItem] = []
    created_at: datetime | None = None


# --- Search ---

class SearchResult(BaseModel):
    id: UUID
    title: str | None
    tldr: str | None = None
    relevance_score: int | None = None
    match_snippet: str | None = None
    match_score: float = 0.0


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int
    query: str


# --- Tags ---

class TagCount(BaseModel):
    name: str
    count: int


class TagsResponse(BaseModel):
    tags: list[TagCount]


# --- Upload ---

class UploadResponse(BaseModel):
    status: str
    job_id: UUID
    messages_found: int = 0
    new_messages: int = 0
    skipped_duplicates: int = 0
    urls_found: int = 0


# --- Admin ---

class CreateUserRequest(BaseModel):
    username: str
    password: str
    display_name: str | None = None
    role: str = Field(default="viewer", pattern="^(admin|viewer)$")


class UpdateUserRequest(BaseModel):
    display_name: str | None = None
    role: str | None = Field(default=None, pattern="^(admin|viewer)$")
    is_active: bool | None = None
    password: str | None = None


class AdminUserOut(BaseModel):
    id: UUID
    username: str
    display_name: str | None
    role: str
    is_active: bool
    created_at: datetime | None

    model_config = {"from_attributes": True}


class IngestionLogOut(BaseModel):
    id: UUID
    export_filename: str
    total_messages: int
    new_messages: int
    skipped_duplicates: int
    urls_found: int
    articles_scraped: int
    articles_processed: int
    status: str
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}
