"""
WhatsApp Chat Export Parser

Handles the .txt file format exported by WhatsApp.
Supports multiple date formats (varies by phone locale).
Supports RTL/Hebrew locale exports with Unicode direction markers.
Detects and skips already-processed messages via content hashing.
"""

import re
import hashlib
import logging
from datetime import datetime
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
from zipfile import ZipFile

logger = logging.getLogger(__name__)


@dataclass
class ParsedMessage:
    """A single parsed WhatsApp message."""
    timestamp: datetime
    sender: str
    content: str
    has_media: bool = False
    media_filename: Optional[str] = None
    urls: list[str] = field(default_factory=list)
    is_system_message: bool = False
    content_hash: str = ""

    def __post_init__(self):
        """Generate content hash for deduplication."""
        raw = f"{self.timestamp.isoformat()}|{self.sender}|{self.content}"
        self.content_hash = hashlib.sha256(raw.encode()).hexdigest()


# Unicode characters to strip (direction markers common in Hebrew/Arabic exports)
UNICODE_JUNK = re.compile(r"[\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069\u200b\u200c\u200d\ufeff]")


def _clean_line(line: str) -> str:
    """Strip invisible Unicode direction markers and BOM from a line."""
    return UNICODE_JUNK.sub("", line).strip()


# WhatsApp date formats vary by phone locale
# Common patterns: DD/MM/YYYY, MM/DD/YYYY, DD.MM.YYYY, YYYY-MM-DD
# Time can be 12h or 24h
MESSAGE_PATTERNS = [
    # [DD/MM/YYYY, HH:MM:SS] Sender: Message  (with brackets)
    re.compile(
        r"\[(\d{1,2}[/\.]\d{1,2}[/\.]\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)\]\s*(.+?):\s*(.*)"
    ),
    # DD/MM/YYYY, HH:MM - Sender: Message  (no brackets, dash separator)
    re.compile(
        r"(\d{1,2}[/\.]\d{1,2}[/\.]\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)\s*-\s*(.+?):\s*(.*)"
    ),
    # YYYY-MM-DD, HH:MM - Sender: Message  (ISO-ish format)
    re.compile(
        r"(\d{4}-\d{1,2}-\d{1,2}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)\s*-\s*(.+?):\s*(.*)"
    ),
    # [YYYY-MM-DD, HH:MM:SS] Sender: Message
    re.compile(
        r"\[(\d{4}-\d{1,2}-\d{1,2}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)\]\s*(.+?):\s*(.*)"
    ),
]

# System message indicators (skip these)
SYSTEM_INDICATORS = [
    "Messages and calls are end-to-end encrypted",
    "created group",
    "added you",
    "changed the group",
    "changed this group",
    "left",
    "removed",
    "changed the subject",
    "changed the description",
    "pinned a message",
    "security code changed",
    "joined using this group",
    "was added",
    "הוצפן",  # Hebrew: encrypted
    "יצר/ה את",  # Hebrew: created
    "הוסיף/ה",  # Hebrew: added
    "עזב/ה",  # Hebrew: left
    "הוסר/ה",  # Hebrew: removed
    "הצמיד/ה",  # Hebrew: pinned
]

# URL extraction pattern
URL_PATTERN = re.compile(
    r"https?://[^\s<>\"'\]\)]+",
    re.IGNORECASE,
)

# Media indicators (multiple languages)
MEDIA_INDICATORS = [
    "<Media omitted>",
    "<media omitted>",
    "(file attached)",
    "<מדיה לא נכללה>",  # Hebrew: media omitted
    "הושמט",  # Hebrew: omitted
    "<image omitted>",
    "<video omitted>",
    "<audio omitted>",
    "<sticker omitted>",
    "<document omitted>",
    "<GIF omitted>",
    "<Contact card omitted>",
]


def extract_export_from_zip(zip_path: str | Path, extract_to: str | Path) -> tuple[Path, list[Path]]:
    """
    Extract a WhatsApp export .zip file.

    Returns:
        Tuple of (chat_txt_path, list_of_media_files)
    """
    zip_path = Path(zip_path)
    extract_to = Path(extract_to)
    extract_to.mkdir(parents=True, exist_ok=True)

    chat_file = None
    media_files = []

    with ZipFile(zip_path, "r") as zf:
        zf.extractall(extract_to)
        for name in zf.namelist():
            full_path = extract_to / name
            logger.info("Found in zip: %s", name)
            if name.endswith(".txt"):
                lower_name = name.lower()
                # Match common chat file names across languages
                if any(keyword in lower_name for keyword in ["chat", "_chat", "צ'אט", "whatsapp"]):
                    chat_file = full_path
                elif chat_file is None:
                    # First .txt file as fallback candidate
                    chat_file = full_path
            elif not name.endswith("/"):
                media_files.append(full_path)

    if chat_file is None:
        # Fallback: find any .txt file recursively
        txt_files = list(extract_to.rglob("*.txt"))
        if txt_files:
            chat_file = txt_files[0]
            logger.info("Fallback: using %s", chat_file.name)
        else:
            raise FileNotFoundError(f"No chat .txt file found in {zip_path}")

    logger.info("Using chat file: %s", chat_file.name)
    return chat_file, media_files


def parse_chat_file(file_path: str | Path) -> list[ParsedMessage]:
    """
    Parse a WhatsApp exported chat .txt file into structured messages.

    Handles multi-line messages by detecting continuation lines
    (lines that don't match the timestamp pattern).
    """
    file_path = Path(file_path)

    # Try multiple encodings
    content = None
    for encoding in ["utf-8", "utf-8-sig", "utf-16", "latin-1"]:
        try:
            content = file_path.read_text(encoding=encoding, errors="replace")
            break
        except (UnicodeDecodeError, UnicodeError):
            continue

    if content is None:
        content = file_path.read_text(encoding="utf-8", errors="replace")

    lines = content.split("\n")
    logger.info("Read %d lines from chat file", len(lines))

    # Log first few lines for debugging
    for i, line in enumerate(lines[:5]):
        cleaned = _clean_line(line)
        logger.info("Line %d (raw repr): %r", i, line[:200])
        logger.info("Line %d (cleaned): %s", i, cleaned[:200])

    messages: list[ParsedMessage] = []
    current_message: Optional[ParsedMessage] = None

    for line in lines:
        # Strip Unicode direction markers before matching
        cleaned = _clean_line(line)
        if not cleaned:
            continue

        # Try to match as a new message
        matched = False
        for pattern in MESSAGE_PATTERNS:
            match = pattern.match(cleaned)
            if match:
                # Save previous message if exists
                if current_message and not current_message.is_system_message:
                    _finalize_message(current_message)
                    messages.append(current_message)

                date_str, time_str, sender, content_text = match.groups()

                # Normalize dots to slashes in date
                date_str = date_str.replace(".", "/")

                # Check for system messages
                is_system = _is_system_message(sender, content_text)

                # Parse timestamp
                timestamp = _parse_timestamp(date_str, time_str)

                # Check for media
                has_media = any(ind in content_text for ind in MEDIA_INDICATORS)

                current_message = ParsedMessage(
                    timestamp=timestamp,
                    sender=sender.strip(),
                    content=content_text.strip(),
                    has_media=has_media,
                    is_system_message=is_system,
                )
                matched = True
                break

        # If no match, this is a continuation of the previous message
        if not matched and current_message:
            current_message.content += f"\n{cleaned}"

    # Don't forget the last message
    if current_message and not current_message.is_system_message:
        _finalize_message(current_message)
        messages.append(current_message)

    logger.info("Parsed %d messages (from %d lines)", len(messages), len(lines))
    return messages


def _finalize_message(msg: ParsedMessage) -> None:
    """Extract URLs and finalize message before appending."""
    msg.urls = URL_PATTERN.findall(msg.content)
    # Regenerate hash after content is complete (multi-line)
    raw = f"{msg.timestamp.isoformat()}|{msg.sender}|{msg.content}"
    msg.content_hash = hashlib.sha256(raw.encode()).hexdigest()


def _is_system_message(sender: str, content: str) -> bool:
    """Check if a message is a WhatsApp system message."""
    full_text = f"{sender}: {content}".lower()
    return any(ind.lower() in full_text for ind in SYSTEM_INDICATORS)


def _parse_timestamp(date_str: str, time_str: str) -> datetime:
    """
    Parse date + time strings into a datetime object.
    Tries multiple formats to handle different phone locales.
    """
    combined = f"{date_str} {time_str}".strip()

    formats = [
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%d/%m/%y %H:%M:%S",
        "%d/%m/%y %H:%M",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%m/%d/%y %H:%M:%S",
        "%m/%d/%y %H:%M",
        "%d/%m/%Y %I:%M:%S %p",
        "%d/%m/%Y %I:%M %p",
        "%m/%d/%Y %I:%M:%S %p",
        "%m/%d/%Y %I:%M %p",
        "%d/%m/%y %I:%M %p",
        "%m/%d/%y %I:%M %p",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(combined, fmt)
        except ValueError:
            continue

    # Last resort: return a placeholder and log warning
    logger.warning("Could not parse timestamp: '%s', using epoch", combined)
    return datetime(1970, 1, 1)
