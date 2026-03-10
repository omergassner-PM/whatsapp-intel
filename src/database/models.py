"""
Database Models

SQLAlchemy ORM models for the WhatsApp Intelligence Platform.
Uses PostgreSQL with pgvector extension for semantic search.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, relationship, sessionmaker


class Base(DeclarativeBase):
    pass


class RawMessage(Base):
    """Original WhatsApp messages as parsed from exports."""

    __tablename__ = "raw_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    sender = Column(String(255), nullable=False, index=True)
    content = Column(Text, nullable=False)
    has_media = Column(Boolean, default=False)
    media_path = Column(String(500), nullable=True)
    urls = Column(ARRAY(String), default=[])
    content_hash = Column(String(64), nullable=False, unique=True, index=True)
    export_file = Column(String(255), nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    articles = relationship("Article", back_populates="source_message")


class Article(Base):
    """Scraped articles from URLs found in messages."""

    __tablename__ = "articles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_url = Column(String(2000), nullable=False, index=True)
    title = Column(String(500), nullable=True)
    author = Column(String(255), nullable=True)
    published_date = Column(Date, nullable=True)
    raw_html = Column(Text, nullable=True)
    clean_text = Column(Text, nullable=True)
    word_count = Column(Integer, default=0)
    scrape_status = Column(String(20), default="pending")  # success|failed|paywalled|timeout
    message_id = Column(UUID(as_uuid=True), ForeignKey("raw_messages.id"), nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    source_message = relationship("RawMessage", back_populates="articles")
    processed = relationship("ProcessedItem", back_populates="article", uselist=False)


class ProcessedItem(Base):
    """LLM-processed intelligence extracted from articles."""

    __tablename__ = "processed_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    article_id = Column(
        UUID(as_uuid=True), ForeignKey("articles.id"), nullable=True, unique=True
    )
    message_id = Column(
        UUID(as_uuid=True), ForeignKey("raw_messages.id"), nullable=True
    )
    source_type = Column(String(20), default="article")  # article | message
    tldr = Column(Text, nullable=True)
    key_facts = Column(JSONB, default=[])
    people = Column(JSONB, default=[])
    organizations = Column(JSONB, default=[])
    technologies = Column(JSONB, default=[])
    dates = Column(JSONB, default=[])
    action_items = Column(JSONB, default=[])
    tags = Column(ARRAY(String), default=[])
    relevance_score = Column(Integer, default=3)
    language = Column(String(10), nullable=True)  # en, he, ar, etc.
    # embedding = Column(Vector(1536), nullable=True)  # Uncomment when pgvector is set up
    processed_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    article = relationship("Article", back_populates="processed")


class WeeklyDigest(Base):
    """Weekly intelligence digest summaries."""

    __tablename__ = "weekly_digests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    week_start = Column(Date, nullable=False, index=True)
    week_end = Column(Date, nullable=False)
    executive_summary = Column(Text, nullable=True)
    top_stories = Column(JSONB, default=[])
    key_trends = Column(JSONB, default=[])
    watch_list = Column(JSONB, default=[])
    article_count = Column(Integer, default=0)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class User(Base):
    """Webapp users with role-based access."""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(100), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=True, index=True)
    password_hash = Column(String(255), nullable=True)  # nullable for viewers (name+email only)
    display_name = Column(String(255), nullable=True)
    role = Column(String(20), default="viewer")  # admin | viewer
    is_active = Column(Boolean, default=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class ArticleNote(Base):
    """User notes attached to articles."""

    __tablename__ = "article_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    article_id = Column(
        UUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    article = relationship("Article", backref="notes")
    user = relationship("User", backref="notes")


class IngestionLog(Base):
    """Audit trail for export ingestion runs."""

    __tablename__ = "ingestion_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    export_filename = Column(String(255), nullable=False)
    total_messages = Column(Integer, default=0)
    new_messages = Column(Integer, default=0)
    skipped_duplicates = Column(Integer, default=0)
    urls_found = Column(Integer, default=0)
    articles_scraped = Column(Integer, default=0)
    articles_processed = Column(Integer, default=0)
    status = Column(String(20), default="running")  # running|completed|failed
    error_message = Column(Text, nullable=True)
    started_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)


class UserActivity(Base):
    """Tracks user actions: searches, downloads, page views."""

    __tablename__ = "user_activities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    action = Column(String(50), nullable=False, index=True)  # search|download|view
    detail = Column(Text, nullable=True)  # search query, download filename, article title
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user = relationship("User", backref="activities")


# Database setup helper
def get_engine(database_url: str):
    return create_engine(database_url, echo=False)


def get_session(database_url: str):
    engine = get_engine(database_url)
    Session = sessionmaker(bind=engine)
    return Session()


def create_tables(database_url: str):
    engine = get_engine(database_url)
    Base.metadata.create_all(engine)
