"""
Upload route — accepts WhatsApp export .zip files and runs ingestion pipeline.
"""

import asyncio
import logging
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from src.api.auth import get_current_user, require_admin
from src.api.database import SessionLocal, get_db
from src.api.schemas import UploadResponse
from src.database.models import Article, IngestionLog, ProcessedItem, RawMessage, User
from src.ingestion.parser import extract_export_from_zip, parse_chat_file
from src.processing.deduplicator import Deduplicator

logger = logging.getLogger(__name__)

router = APIRouter(tags=["upload"])


def _run_ingestion(export_path: Path, log_id: uuid.UUID) -> None:
    """Background task: run the full ingestion pipeline."""
    import os

    from src.processing.llm_processor import LLMProcessor
    from src.processing.scraper import scrape_urls

    db = SessionLocal()
    log_entry = db.query(IngestionLog).filter(IngestionLog.id == log_id).first()

    try:
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        model = os.environ.get("LLM_MODEL", "claude-sonnet-4-20250514")
        scrape_timeout = int(os.environ.get("SCRAPE_TIMEOUT", "30"))

        with tempfile.TemporaryDirectory() as tmpdir:
            chat_file, _ = extract_export_from_zip(export_path, tmpdir)
            messages = parse_chat_file(chat_file)

        log_entry.total_messages = len(messages)

        dedup = Deduplicator(db)
        new_messages, skipped = dedup.filter_new_messages(messages)
        log_entry.new_messages = len(new_messages)
        log_entry.skipped_duplicates = skipped

        if not new_messages:
            log_entry.status = "completed"
            log_entry.completed_at = datetime.now(timezone.utc)
            db.commit()
            return

        # Store raw messages
        all_urls: list[tuple[str, uuid.UUID]] = []
        for msg in new_messages:
            raw = RawMessage(
                timestamp=msg.timestamp,
                sender=msg.sender,
                content=msg.content,
                has_media=msg.has_media,
                urls=msg.urls,
                content_hash=msg.content_hash,
                export_file=export_path.name,
            )
            db.add(raw)
            db.flush()
            for url in msg.urls:
                if not dedup.is_url_scraped(url):
                    all_urls.append((url, raw.id))
        db.commit()
        log_entry.urls_found = len(all_urls)

        # Scrape
        if all_urls:
            urls_only = [u[0] for u in all_urls]
            url_to_msg_id = {u[0]: u[1] for u in all_urls}
            scraped = asyncio.run(scrape_urls(urls_only, timeout=scrape_timeout))

            scraped_count = 0
            for result in scraped:
                article = Article(
                    source_url=result.url,
                    title=result.title,
                    author=result.author,
                    published_date=result.published_date,
                    raw_html=result.raw_html,
                    clean_text=result.clean_text,
                    word_count=result.word_count,
                    scrape_status=result.status,
                    message_id=url_to_msg_id.get(result.url),
                )
                db.add(article)
                if result.status == "success":
                    scraped_count += 1
            db.commit()
            log_entry.articles_scraped = scraped_count

        # LLM processing
        if api_key:
            llm = LLMProcessor(api_key=api_key, model=model)
            unprocessed = (
                db.query(Article)
                .filter(
                    Article.scrape_status == "success",
                    ~Article.id.in_(
                        db.query(ProcessedItem.article_id).filter(
                            ProcessedItem.article_id.isnot(None)
                        )
                    ),
                )
                .all()
            )
            processed_count = 0
            for article in unprocessed:
                result = llm.analyze_article(
                    title=article.title or "Untitled",
                    url=article.source_url,
                    content=article.clean_text,
                    published_date=str(article.published_date) if article.published_date else "Unknown",
                )
                if result:
                    item = ProcessedItem(
                        article_id=article.id,
                        source_type="article",
                        tldr=result.get("tldr"),
                        key_facts=result.get("key_facts", []),
                        people=result.get("people", []),
                        organizations=result.get("organizations", []),
                        technologies=result.get("technologies", []),
                        dates=result.get("dates", []),
                        action_items=result.get("action_items", []),
                        tags=result.get("tags", []),
                        relevance_score=result.get("relevance_score", 3),
                        language=result.get("language", "en"),
                    )
                    db.add(item)
                    processed_count += 1
            db.commit()
            log_entry.articles_processed = processed_count

        log_entry.status = "completed"
        log_entry.completed_at = datetime.now(timezone.utc)
        db.commit()
        logger.info(f"Ingestion {log_id} completed: {log_entry.new_messages} new messages")

    except Exception as e:
        logger.error(f"Ingestion {log_id} failed: {e}", exc_info=True)
        log_entry.status = "failed"
        log_entry.error_message = str(e)
        log_entry.completed_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()


@router.post("/upload", response_model=UploadResponse)
async def upload_export(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    admin: Annotated[User, Depends(require_admin)],
) -> UploadResponse:
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .zip files are accepted",
        )

    # Save uploaded file
    exports_dir = Path("exports")
    exports_dir.mkdir(exist_ok=True)
    export_path = exports_dir / f"{uuid.uuid4().hex}_{file.filename}"
    content = await file.read()
    export_path.write_bytes(content)

    # Quick parse for immediate feedback
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            chat_file, _ = extract_export_from_zip(export_path, tmpdir)
            logger.info("Parsing chat file: %s (size: %d bytes)", chat_file.name, chat_file.stat().st_size)
            messages = parse_chat_file(chat_file)
            logger.info("Parsed %d messages from export", len(messages))

        db = SessionLocal()
        try:
            dedup = Deduplicator(db)
            new_messages, skipped = dedup.filter_new_messages(messages)
            urls_found = sum(len(m.urls) for m in new_messages)

            log_entry = IngestionLog(
                export_filename=file.filename,
                total_messages=len(messages),
                new_messages=len(new_messages),
                skipped_duplicates=skipped,
                urls_found=urls_found,
            )
            db.add(log_entry)
            db.commit()
            job_id = log_entry.id
        finally:
            db.close()

    except Exception as e:
        export_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse export: {e}",
        )

    # Run full pipeline in background
    background_tasks.add_task(_run_ingestion, export_path, job_id)

    return UploadResponse(
        status="processing",
        job_id=job_id,
        messages_found=len(messages),
        new_messages=len(new_messages),
        skipped_duplicates=skipped,
        urls_found=urls_found,
    )


@router.get("/upload/status/{job_id}")
def get_job_status(
    job_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_admin)],
) -> dict:
    """Check the processing status of an upload job."""
    log = db.query(IngestionLog).filter(IngestionLog.id == job_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "id": str(log.id),
        "status": log.status,
        "export_filename": log.export_filename,
        "total_messages": log.total_messages,
        "new_messages": log.new_messages,
        "articles_scraped": log.articles_scraped,
        "articles_processed": log.articles_processed,
        "error_message": log.error_message,
        "started_at": log.started_at.isoformat() if log.started_at else None,
        "completed_at": log.completed_at.isoformat() if log.completed_at else None,
    }
