"""
Ingestion CLI Script

Main entry point for processing WhatsApp exports.
Run manually or via cron job.

Usage:
    python scripts/ingest.py --input exports/WhatsApp_Chat_Export.zip
    python scripts/ingest.py --input exports/WhatsApp_Chat_Export.zip --skip-llm
"""

import argparse
import asyncio
import logging
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.ingestion.parser import extract_export_from_zip, parse_chat_file
from src.processing.scraper import scrape_urls
from src.processing.llm_processor import LLMProcessor
from src.processing.deduplicator import Deduplicator
from src.database.models import (
    Article,
    IngestionLog,
    ProcessedItem,
    RawMessage,
    create_tables,
    get_session,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ingest")


def main():
    parser = argparse.ArgumentParser(description="Ingest WhatsApp chat export")
    parser.add_argument("--input", required=True, help="Path to .zip export file")
    parser.add_argument("--skip-llm", action="store_true", help="Skip LLM processing (scrape only)")
    parser.add_argument("--skip-scrape", action="store_true", help="Skip URL scraping")
    args = parser.parse_args()

    # Config from environment
    database_url = os.environ.get(
        "DATABASE_URL", "postgresql://intel:password@localhost:5432/whatsapp_intel"
    )
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    model = os.environ.get("LLM_MODEL", "claude-sonnet-4-20250514")
    scrape_timeout = int(os.environ.get("SCRAPE_TIMEOUT", "30"))

    if not api_key and not args.skip_llm:
        logger.error("ANTHROPIC_API_KEY not set. Use --skip-llm or set the env var.")
        sys.exit(1)

    input_path = Path(args.input)
    if not input_path.exists():
        logger.error(f"Input file not found: {input_path}")
        sys.exit(1)

    # Initialize database
    create_tables(database_url)
    session = get_session(database_url)

    # Start ingestion log
    log_entry = IngestionLog(export_filename=input_path.name)
    session.add(log_entry)
    session.commit()

    try:
        # === STEP 1: Extract and parse ===
        logger.info(f"Extracting {input_path}...")
        with tempfile.TemporaryDirectory() as tmpdir:
            chat_file, media_files = extract_export_from_zip(input_path, tmpdir)
            logger.info(f"Found chat file: {chat_file.name}, {len(media_files)} media files")

            messages = parse_chat_file(chat_file)
            logger.info(f"Parsed {len(messages)} messages")
            log_entry.total_messages = len(messages)

        # === STEP 2: Deduplicate ===
        dedup = Deduplicator(session)
        new_messages, skipped = dedup.filter_new_messages(messages)
        logger.info(f"New: {len(new_messages)}, Skipped (duplicates): {skipped}")
        log_entry.new_messages = len(new_messages)
        log_entry.skipped_duplicates = skipped

        if not new_messages:
            logger.info("No new messages to process. Done.")
            log_entry.status = "completed"
            log_entry.completed_at = datetime.now(timezone.utc)
            session.commit()
            return

        # === STEP 3: Store raw messages ===
        all_urls = []
        for msg in new_messages:
            raw = RawMessage(
                timestamp=msg.timestamp,
                sender=msg.sender,
                content=msg.content,
                has_media=msg.has_media,
                urls=msg.urls,
                content_hash=msg.content_hash,
                export_file=input_path.name,
            )
            session.add(raw)
            session.flush()  # Get the ID

            for url in msg.urls:
                if not dedup.is_url_scraped(url):
                    all_urls.append((url, raw.id))

        session.commit()
        logger.info(f"Stored {len(new_messages)} new messages")
        log_entry.urls_found = len(all_urls)

        # === STEP 4: Scrape URLs ===
        if not args.skip_scrape and all_urls:
            logger.info(f"Scraping {len(all_urls)} URLs...")
            urls_only = [u[0] for u in all_urls]
            url_to_msg_id = {u[0]: u[1] for u in all_urls}

            scraped = asyncio.run(scrape_urls(urls_only, timeout=scrape_timeout))

            articles_scraped = 0
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
                session.add(article)
                if result.status == "success":
                    articles_scraped += 1

            session.commit()
            log_entry.articles_scraped = articles_scraped
            logger.info(f"Scraped {articles_scraped}/{len(all_urls)} articles successfully")

        # === STEP 5: LLM Processing ===
        if not args.skip_llm and api_key:
            llm = LLMProcessor(api_key=api_key, model=model)

            # Process articles
            unprocessed = (
                session.query(Article)
                .filter(
                    Article.scrape_status == "success",
                    ~Article.id.in_(
                        session.query(ProcessedItem.article_id).filter(
                            ProcessedItem.article_id.isnot(None)
                        )
                    ),
                )
                .all()
            )

            logger.info(f"Processing {len(unprocessed)} articles through LLM...")
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
                    )
                    session.add(item)
                    processed_count += 1
                    logger.info(f"  Processed: {article.title} (score: {result.get('relevance_score', '?')})")

            session.commit()
            log_entry.articles_processed = processed_count
            logger.info(f"LLM processed {processed_count} articles")

        # === DONE ===
        log_entry.status = "completed"
        log_entry.completed_at = datetime.now(timezone.utc)
        session.commit()

        logger.info("=" * 50)
        logger.info("INGESTION COMPLETE")
        logger.info(f"  Total messages:    {log_entry.total_messages}")
        logger.info(f"  New messages:      {log_entry.new_messages}")
        logger.info(f"  Skipped (dupes):   {log_entry.skipped_duplicates}")
        logger.info(f"  URLs found:        {log_entry.urls_found}")
        logger.info(f"  Articles scraped:  {log_entry.articles_scraped}")
        logger.info(f"  Articles processed:{log_entry.articles_processed}")
        logger.info("=" * 50)

    except Exception as e:
        logger.error(f"Ingestion failed: {e}", exc_info=True)
        log_entry.status = "failed"
        log_entry.error_message = str(e)
        log_entry.completed_at = datetime.now(timezone.utc)
        session.commit()
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
