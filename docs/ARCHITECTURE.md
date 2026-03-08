# Architecture Document

## System Design

### Data Flow

```
WhatsApp Export (.zip)
    │
    ▼
┌─────────────────────────────────────────┐
│           INGESTION LAYER               │
│                                         │
│  1. Unzip export                        │
│  2. Parse WhatsApp .txt format          │
│  3. Extract: messages, timestamps,      │
│     senders, URLs, media references     │
│  4. Deduplicate against existing DB     │
│     (only process NEW messages)         │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│          SCRAPING LAYER                 │
│                                         │
│  For each URL found:                    │
│  1. Fetch the page (public internet)    │
│  2. Extract article content             │
│     (title, body, author, date)         │
│  3. Handle paywalled / failed fetches   │
│  4. Store raw HTML + clean text         │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│         PROCESSING LAYER (LLM)          │
│                                         │
│  For each article/message:              │
│  1. Generate TLDR (2-3 sentences)       │
│  2. Extract key items:                  │
│     - Key facts / data points           │
│     - People / organizations mentioned  │
│     - Technologies / products           │
│     - Dates / deadlines                 │
│     - Action items / recommendations    │
│  3. Auto-categorize (tags)              │
│  4. Score relevance (1-5)               │
│  5. Generate weekly digest summary      │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│           DATABASE LAYER                │
│                                         │
│  PostgreSQL 16 + pgvector               │
│                                         │
│  Tables:                                │
│  - raw_messages      (original data)    │
│  - articles          (scraped content)  │
│  - processed_items   (TLDRs, key items) │
│  - weekly_digests    (weekly summaries)  │
│  - tags              (categories)       │
│  - users             (auth)             │
│  - ingestion_logs    (audit trail)      │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│            API LAYER (FastAPI)           │
│                                         │
│  Endpoints:                             │
│  POST /upload         Upload export     │
│  GET  /articles       List + filter     │
│  GET  /articles/:id   Full article      │
│  GET  /weekly         Weekly digests    │
│  GET  /search         Full-text search  │
│  POST /auth/login     Get JWT token     │
│  GET  /tags           All categories    │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│          WEBAPP (React + TS)            │
│                                         │
│  Pages:                                 │
│  - Dashboard: This week's digest        │
│  - Library: All articles, filterable    │
│  - Article View: TLDR + full + keys     │
│  - Search: Full-text + semantic         │
│  - Upload: Drag-and-drop export         │
│  - Admin: User management               │
└─────────────────────────────────────────┘
```

## Database Schema

### raw_messages

| Column       | Type        | Description                     |
|-------------|-------------|---------------------------------|
| id          | UUID (PK)   | Unique message ID               |
| timestamp   | TIMESTAMPTZ | When the message was sent       |
| sender      | VARCHAR     | Who sent the message            |
| content     | TEXT        | Raw message text                |
| has_media   | BOOLEAN     | Whether media was attached      |
| media_path  | VARCHAR     | Path to stored media file       |
| urls        | TEXT[]      | Array of URLs found in message  |
| export_file | VARCHAR     | Which export file this came from|
| created_at  | TIMESTAMPTZ | When we ingested this           |

### articles

| Column          | Type        | Description                      |
|----------------|-------------|----------------------------------|
| id             | UUID (PK)   | Unique article ID                |
| source_url     | VARCHAR     | Original URL                     |
| title          | VARCHAR     | Article title                    |
| author         | VARCHAR     | Article author (if found)        |
| published_date | DATE        | When article was published       |
| raw_html       | TEXT        | Original HTML                    |
| clean_text     | TEXT        | Extracted article body           |
| word_count     | INTEGER     | Length of clean text              |
| scrape_status  | VARCHAR     | success / failed / paywalled     |
| message_id     | UUID (FK)   | Which message shared this        |
| created_at     | TIMESTAMPTZ | When we scraped this             |

### processed_items

| Column         | Type        | Description                       |
|---------------|-------------|-----------------------------------|
| id            | UUID (PK)   | Unique ID                         |
| article_id    | UUID (FK)   | Reference to articles table       |
| tldr          | TEXT        | 2-3 sentence summary              |
| key_facts     | JSONB       | Array of extracted facts          |
| people        | JSONB       | People/orgs mentioned             |
| technologies  | JSONB       | Tech/products mentioned           |
| dates         | JSONB       | Important dates found             |
| action_items  | JSONB       | Recommendations/actions           |
| relevance     | INTEGER     | 1-5 relevance score               |
| tags          | TEXT[]      | Auto-assigned category tags       |
| embedding     | vector(1536)| For semantic search (pgvector)    |
| processed_at  | TIMESTAMPTZ | When LLM processed this           |

### weekly_digests

| Column         | Type        | Description                       |
|---------------|-------------|-----------------------------------|
| id            | UUID (PK)   | Unique ID                         |
| week_start    | DATE        | Monday of the week                |
| week_end      | DATE        | Sunday of the week                |
| summary       | TEXT        | LLM-generated weekly overview     |
| article_count | INTEGER     | How many articles that week       |
| top_items     | JSONB       | Most important items of the week  |
| created_at    | TIMESTAMPTZ | When digest was generated         |

### users

| Column         | Type        | Description                       |
|---------------|-------------|-----------------------------------|
| id            | UUID (PK)   | Unique ID                         |
| username      | VARCHAR     | Login username                    |
| password_hash | VARCHAR     | bcrypt hashed password            |
| display_name  | VARCHAR     | Shown in UI                       |
| role          | VARCHAR     | admin / viewer                    |
| is_active     | BOOLEAN     | Account enabled                   |
| created_at    | TIMESTAMPTZ | Account creation date             |

## WhatsApp Export Format

WhatsApp exports follow this pattern:

```
[DD/MM/YYYY, HH:MM:SS] Sender Name: Message content here
[DD/MM/YYYY, HH:MM:SS] Sender Name: Check this article https://example.com/article
[DD/MM/YYYY, HH:MM:SS] Sender Name: <Media omitted>
[DD/MM/YYYY, HH:MM:SS] Sender Name: (file attached)
```

The parser handles:
- Multi-line messages (continuation lines without timestamp prefix)
- Various date formats (WhatsApp varies by phone locale)
- Media references (`<Media omitted>`, attached files)
- URL extraction from within message bodies
- System messages (group name changes, member additions — these are skipped)

## Deduplication Strategy

Each weekly export contains the FULL chat history, not just new messages. The deduplication logic:

1. On first import: everything is new, process all
2. On subsequent imports: hash each message (timestamp + sender + content)
3. Compare hashes against existing `raw_messages` table
4. Only process messages with new hashes
5. Log the import with count of new vs. skipped messages

This means the CEO can export the full chat every week without worrying about duplicates.

## LLM Processing Strategy

Each article is processed with a structured prompt that returns JSON:

```json
{
  "tldr": "Short summary of the article...",
  "key_facts": [
    "Fact 1 extracted from the article",
    "Fact 2 with specific numbers or data"
  ],
  "people": [
    {"name": "Person Name", "role": "Their role", "context": "Why mentioned"}
  ],
  "technologies": ["Tech 1", "Tech 2"],
  "dates": [
    {"date": "2025-03-15", "context": "Deadline for X"}
  ],
  "action_items": ["Recommendation 1"],
  "tags": ["defense", "technology", "policy"],
  "relevance_score": 4
}
```

Cost estimate: Processing ~20 articles/week with Claude Sonnet costs roughly $0.10-0.30/week depending on article length.

## Security Model

```
┌──────────────────────────────────────────┐
│              PUBLIC INTERNET              │
│                                          │
│   Only outbound:                         │
│   - Scrape article URLs                  │
│   - Claude API calls                     │
└──────────────────────┬───────────────────┘
                       │ (outbound only)
                       ▼
┌──────────────────────────────────────────┐
│           COMPANY VPN NETWORK            │
│                                          │
│   ┌────────────┐    ┌────────────┐       │
│   │  Local     │    │ PostgreSQL │       │
│   │  Server    │────│  Database  │       │
│   │  (Docker)  │    │            │       │
│   └─────┬──────┘    └────────────┘       │
│         │                                │
│   ┌─────▼──────┐                         │
│   │  React     │                         │
│   │  Webapp    │◄── VPN users only       │
│   └────────────┘                         │
└──────────────────────────────────────────┘
```

- No inbound connections from the internet
- Database is never exposed externally
- Webapp only accessible within VPN
- JWT tokens expire after 24 hours
- Admin role required for uploads and user management
