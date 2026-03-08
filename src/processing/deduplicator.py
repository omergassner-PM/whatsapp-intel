"""
Deduplicator

Checks incoming messages against existing database records
to avoid re-processing content from overlapping exports.
"""

import logging
from sqlalchemy.orm import Session
from ..database.models import RawMessage

logger = logging.getLogger(__name__)


class Deduplicator:
    """Filters out messages that have already been ingested."""

    def __init__(self, db_session: Session):
        self.session = db_session
        self._existing_hashes: set[str] | None = None

    def load_existing_hashes(self) -> set[str]:
        """Load all existing content hashes from the database."""
        if self._existing_hashes is None:
            results = self.session.query(RawMessage.content_hash).all()
            self._existing_hashes = {r[0] for r in results}
            logger.info(f"Loaded {len(self._existing_hashes)} existing message hashes")
        return self._existing_hashes

    def filter_new_messages(self, messages: list) -> tuple[list, int]:
        """
        Filter a list of ParsedMessage objects, returning only new ones.

        Returns:
            Tuple of (new_messages, skipped_count)
        """
        existing = self.load_existing_hashes()
        new_messages = []
        skipped = 0

        for msg in messages:
            if msg.content_hash in existing:
                skipped += 1
            else:
                new_messages.append(msg)
                # Add to cache so duplicates within same export are caught
                existing.add(msg.content_hash)

        logger.info(f"Dedup result: {len(new_messages)} new, {skipped} skipped")
        return new_messages, skipped

    def is_url_scraped(self, url: str) -> bool:
        """Check if a URL has already been scraped."""
        from ..database.models import Article
        return (
            self.session.query(Article)
            .filter(Article.source_url == url, Article.scrape_status == "success")
            .first()
            is not None
        )
