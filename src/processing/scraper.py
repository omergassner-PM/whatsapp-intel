"""
Article Scraper

Fetches URLs found in WhatsApp messages and extracts clean article content.
Uses trafilatura for robust article extraction.
"""

import logging
from dataclasses import dataclass
from typing import Optional

import httpx
import trafilatura

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 30
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


@dataclass
class ScrapedArticle:
    """Result of scraping a URL."""
    url: str
    title: Optional[str] = None
    author: Optional[str] = None
    published_date: Optional[str] = None
    clean_text: Optional[str] = None
    raw_html: Optional[str] = None
    word_count: int = 0
    status: str = "pending"  # success | failed | paywalled | timeout


async def scrape_url(url: str, timeout: int = DEFAULT_TIMEOUT) -> ScrapedArticle:
    """
    Fetch a URL and extract article content.

    Returns a ScrapedArticle with status indicating success or failure type.
    """
    result = ScrapedArticle(url=url)

    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers={"User-Agent": USER_AGENT},
        ) as client:
            response = await client.get(url)

            if response.status_code == 403:
                result.status = "paywalled"
                logger.warning(f"Paywalled (403): {url}")
                return result

            if response.status_code != 200:
                result.status = "failed"
                logger.warning(f"HTTP {response.status_code}: {url}")
                return result

            result.raw_html = response.text

    except httpx.TimeoutException:
        result.status = "timeout"
        logger.warning(f"Timeout: {url}")
        return result
    except Exception as e:
        result.status = "failed"
        logger.error(f"Fetch error for {url}: {e}")
        return result

    # Extract article content using trafilatura
    try:
        extracted = trafilatura.extract(
            result.raw_html,
            include_comments=False,
            include_tables=True,
            output_format="txt",
            favor_recall=True,
        )

        if extracted:
            result.clean_text = extracted
            result.word_count = len(extracted.split())
            result.status = "success"
        else:
            result.status = "failed"
            logger.warning(f"No content extracted from: {url}")
            return result

        # Extract metadata
        metadata = trafilatura.extract_metadata(result.raw_html)
        if metadata:
            result.title = metadata.title
            result.author = metadata.author
            result.published_date = metadata.date

    except Exception as e:
        result.status = "failed"
        logger.error(f"Extraction error for {url}: {e}")

    return result


async def scrape_urls(urls: list[str], timeout: int = DEFAULT_TIMEOUT) -> list[ScrapedArticle]:
    """Scrape multiple URLs concurrently."""
    import asyncio

    tasks = [scrape_url(url, timeout) for url in urls]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    scraped = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(f"Scrape task failed for {urls[i]}: {result}")
            scraped.append(ScrapedArticle(url=urls[i], status="failed"))
        else:
            scraped.append(result)

    return scraped
