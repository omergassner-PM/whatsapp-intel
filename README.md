# WhatsApp Group Intelligence Platform

Internal tool for ingesting WhatsApp group chat exports, extracting articles and key knowledge, and serving a searchable library via a local webapp.

## Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   WhatsApp   │     │  Ingestion   │     │  Processing  │     │   Database   │
│  Chat Export │────▶│   Parser     │────▶│  (LLM + NLP) │────▶│  PostgreSQL  │
│  (.txt + media)    │              │     │              │     │  + pgvector  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘
                                                                      │
                                                                      ▼
                                                               ┌──────────────┐
                                                               │   Local Web  │
                                                               │   App (React)│
                                                               │  VPN-only    │
                                                               └──────────────┘
```

## How It Works

1. **Export** — CEO exports the WhatsApp group chat weekly (Settings → Chat → Export Chat → Include Media)
2. **Upload** — Drop the export `.zip` into the upload interface (or a watched folder on the server)
3. **Ingest** — Parser extracts messages, links, and media from the WhatsApp export format
4. **Scrape** — Any URLs found in messages are fetched and article content is extracted (public web scraping)
5. **Process** — LLM generates TLDRs, extracts key items, tags categories, and scores relevance
6. **Store** — Everything goes into PostgreSQL with full-text search and optional vector search
7. **Browse** — Authorized users access the webapp via VPN to search, read, and explore the knowledge base

## Tech Stack

| Layer        | Technology                        |
|-------------|-----------------------------------|
| Ingestion   | Python 3.12+                      |
| Scraping    | `newspaper3k` / `trafilatura`     |
| Processing  | Claude API (Anthropic)            |
| Database    | PostgreSQL 16 + pgvector          |
| API         | FastAPI (Python)                  |
| Frontend    | React + TypeScript + Tailwind CSS |
| Auth        | JWT-based, role-based access      |
| Deployment  | Docker Compose (local server)     |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Anthropic API key (for Claude processing)
- Node.js 20+ (for frontend development)
- Python 3.12+ (for backend development)

### 1. Clone & Configure

```bash
git clone <repo-url>
cd whatsapp-intel
cp .env.example .env
# Edit .env with your Anthropic API key and database credentials
```

### 2. Start Services

```bash
docker compose up -d
```

This starts PostgreSQL, the API server, and the React frontend.

### 3. Upload First Export

Either use the web UI upload page, or drop the `.zip` file into the `exports/` directory and run:

```bash
python scripts/ingest.py --input exports/WhatsApp_Chat_Export.zip
```

### 4. Access the Webapp

Navigate to `http://<server-ip>:3000` (VPN required)

## Project Structure

```
whatsapp-intel/
├── README.md
├── docker-compose.yml
├── .env.example
├── .gitignore
│
├── docs/
│   ├── ARCHITECTURE.md          # Detailed system design
│   ├── WHATSAPP_EXPORT_GUIDE.md # How-to for the CEO
│   └── API.md                   # API endpoint reference
│
├── src/
│   ├── ingestion/               # WhatsApp export parser
│   │   ├── __init__.py
│   │   ├── parser.py            # Parse .txt export format
│   │   ├── media_handler.py     # Handle images, PDFs, docs
│   │   └── link_extractor.py    # Extract and classify URLs
│   │
│   ├── processing/              # LLM + content processing
│   │   ├── __init__.py
│   │   ├── scraper.py           # Fetch and extract article content
│   │   ├── llm_processor.py     # Claude API integration
│   │   ├── prompts.py           # All LLM prompt templates
│   │   └── deduplicator.py      # Detect already-processed content
│   │
│   ├── database/                # Database models and migrations
│   │   ├── __init__.py
│   │   ├── models.py            # SQLAlchemy models
│   │   ├── migrations/          # Alembic migrations
│   │   └── seed.py              # Initial data / test fixtures
│   │
│   ├── api/                     # FastAPI backend
│   │   ├── __init__.py
│   │   ├── main.py              # App entry point
│   │   ├── routes/
│   │   │   ├── articles.py      # Article CRUD + search
│   │   │   ├── weekly.py        # Weekly digest endpoints
│   │   │   ├── upload.py        # Export file upload
│   │   │   └── auth.py          # Authentication
│   │   ├── middleware/
│   │   │   └── auth.py          # JWT verification
│   │   └── schemas.py           # Pydantic request/response models
│   │
│   └── webapp/                  # React frontend
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── src/
│           ├── App.tsx
│           ├── main.tsx
│           ├── pages/
│           │   ├── Dashboard.tsx     # Weekly overview
│           │   ├── ArticleList.tsx   # Browse all articles
│           │   ├── ArticleView.tsx   # Full article + TLDR
│           │   ├── Search.tsx        # Full-text search
│           │   ├── Upload.tsx        # Export upload page
│           │   └── Login.tsx         # Auth page
│           ├── components/
│           │   ├── ArticleCard.tsx
│           │   ├── WeeklyDigest.tsx
│           │   ├── TagFilter.tsx
│           │   └── KeyItemsList.tsx
│           └── lib/
│               ├── api.ts            # API client
│               └── auth.ts           # Auth utilities
│
├── scripts/
│   ├── ingest.py                # CLI ingestion script
│   ├── reprocess.py             # Re-run LLM on existing articles
│   └── setup_db.py              # Initialize database
│
└── exports/                     # Drop WhatsApp exports here
    └── .gitkeep
```

## Environment Variables

| Variable              | Description                          | Required |
|----------------------|--------------------------------------|----------|
| `ANTHROPIC_API_KEY`  | Claude API key for processing        | Yes      |
| `DATABASE_URL`       | PostgreSQL connection string         | Yes      |
| `JWT_SECRET`         | Secret for signing auth tokens       | Yes      |
| `ALLOWED_ORIGINS`    | CORS origins (default: localhost)    | No       |
| `SCRAPE_TIMEOUT`     | Article fetch timeout in seconds     | No       |
| `LLM_MODEL`         | Claude model to use (default: claude-sonnet-4-20250514) | No |

## Security Notes

- The webapp is designed to run on an internal server behind a company VPN
- No data leaves the local network except for:
  - Outbound web scraping of article URLs (public internet)
  - Claude API calls for processing (encrypted, sent to Anthropic's API)
- All scraped and processed data is stored locally
- JWT-based auth restricts access to authorized users only
- Export files should be deleted from the server after ingestion

## Development

```bash
# Backend
cd src/api
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd src/webapp
npm install
npm run dev

# Run ingestion manually
python scripts/ingest.py --input path/to/export.zip
```

## License

Internal use only — AeroDan Ltd.
