"""
LLM Processor

Sends articles to Claude API for analysis and knowledge extraction.
Handles rate limiting, retries, and response parsing.
"""

import json
import logging
from typing import Any, Optional

import anthropic

from .prompts import (
    ARTICLE_ANALYSIS_PROMPT,
    ARTICLE_ANALYSIS_SYSTEM,
    MESSAGE_ONLY_PROMPT,
    WEEKLY_DIGEST_PROMPT,
    WEEKLY_DIGEST_SYSTEM,
)

logger = logging.getLogger(__name__)


class LLMProcessor:
    """Processes articles through Claude API for intelligence extraction."""

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-20250514"):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model

    def analyze_article(
        self,
        title: str,
        url: str,
        content: str,
        published_date: str = "Unknown",
    ) -> Optional[dict[str, Any]]:
        """
        Analyze a single article and extract structured intelligence.

        Returns parsed JSON dict or None on failure.
        """
        # Truncate very long articles to stay within token limits
        max_chars = 15000
        if len(content) > max_chars:
            content = content[:max_chars] + "\n\n[Content truncated for processing]"

        prompt = ARTICLE_ANALYSIS_PROMPT.format(
            title=title or "Untitled",
            url=url,
            published_date=published_date or "Unknown",
            content=content,
        )

        return self._call_llm(ARTICLE_ANALYSIS_SYSTEM, prompt)

    def analyze_message(
        self,
        sender: str,
        timestamp: str,
        content: str,
    ) -> Optional[dict[str, Any]]:
        """
        Analyze a standalone WhatsApp message (no article link).

        Returns parsed JSON dict or None if not substantive.
        """
        prompt = MESSAGE_ONLY_PROMPT.format(
            sender=sender,
            timestamp=timestamp,
            content=content,
        )

        result = self._call_llm(ARTICLE_ANALYSIS_SYSTEM, prompt)
        if result and not result.get("is_substantive", False):
            return None
        return result

    def generate_weekly_digest(
        self,
        week_start: str,
        week_end: str,
        articles: list[dict],
    ) -> Optional[dict[str, Any]]:
        """
        Generate a weekly intelligence digest from processed articles.
        """
        # Build articles summary for the prompt
        articles_summary = ""
        for i, article in enumerate(articles, 1):
            articles_summary += (
                f"\n--- Article {i} ---\n"
                f"Title: {article.get('title', 'Untitled')}\n"
                f"TLDR: {article.get('tldr', 'N/A')}\n"
                f"Tags: {', '.join(article.get('tags', []))}\n"
                f"Relevance: {article.get('relevance_score', 'N/A')}/5\n"
                f"Key Facts: {json.dumps(article.get('key_facts', []))}\n"
            )

        prompt = WEEKLY_DIGEST_PROMPT.format(
            week_start=week_start,
            week_end=week_end,
            article_count=len(articles),
            articles_summary=articles_summary,
        )

        return self._call_llm(WEEKLY_DIGEST_SYSTEM, prompt)

    def _call_llm(self, system: str, prompt: str) -> Optional[dict[str, Any]]:
        """
        Make a Claude API call and parse JSON response.
        Includes retry logic for transient failures.
        """
        max_retries = 3

        for attempt in range(max_retries):
            try:
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=4096,
                    system=system,
                    messages=[{"role": "user", "content": prompt}],
                )

                # Extract text from response
                text = response.content[0].text.strip()

                # Clean up potential markdown fencing
                if text.startswith("```"):
                    text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()

                return json.loads(text)

            except json.JSONDecodeError as e:
                logger.warning(
                    f"JSON parse error (attempt {attempt + 1}/{max_retries}): {e}"
                )
                if attempt == max_retries - 1:
                    logger.error(f"Failed to parse LLM response after {max_retries} attempts")
                    logger.debug(f"Raw response: {text[:500]}")
                    return None

            except anthropic.RateLimitError:
                import time
                wait = 2 ** (attempt + 1)
                logger.warning(f"Rate limited, waiting {wait}s...")
                time.sleep(wait)

            except Exception as e:
                logger.error(f"LLM call failed (attempt {attempt + 1}): {e}")
                if attempt == max_retries - 1:
                    return None

        return None
