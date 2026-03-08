# CLAUDE.md — WhatsApp Group Intelligence Platform

## Project Overview
Internal tool for AeroDan Ltd that ingests WhatsApp group chat exports, scrapes shared article links, processes them through Claude API for TLDRs and knowledge extraction, stores everything in PostgreSQL, and serves it via a React webapp accessible only through VPN.

## Architecture
See `docs/ARCHITECTURE.md` for the full system design, database schema, and data flow.

## Tech Stack
- **Backend**: Python 3.12+, FastAPI, SQLAlchemy 2.0, PostgreSQL 16 + pgvector
- **Frontend**: React 18+, TypeScript, Tailwind CSS, Vite
- **LLM**: Anthropic Claude API (claude-sonnet-4-20250514)
- **Scraping**: trafilatura, httpx
- **Auth**: JWT tokens (python-jose), bcrypt passwords
- **Deploy**: Docker Compose on local server

## Key Files Already Written
- `src/ingestion/parser.py` — WhatsApp export parser (complete, tested logic)
- `src/processing/scraper.py` — Article URL scraper using trafilatura (complete)
- `src/processing/llm_processor.py` — Claude API integration (complete)
- `src/processing/prompts.py` — All LLM prompt templates (complete)
- `src/processing/deduplicator.py` — Message deduplication (complete)
- `src/database/models.py` — All SQLAlchemy models (complete)
- `scripts/ingest.py` — Main CLI ingestion pipeline (complete)

## What Needs to Be Built
1. **FastAPI backend** (`src/api/`) — REST API with all endpoints from `docs/API.md`
2. **React frontend** (`src/webapp/`) — Dashboard, article browser, search, upload, login
3. **Dockerfiles** — For API and webapp services
4. **Alembic migrations** — Database migration setup
5. **Admin CLI** — Script to create initial admin user
6. **Tests** — Unit tests for parser, deduplicator, and API routes

## Development Commands
```bash
# Start database only
docker compose up db -d

# Run backend locally
cd src/api && uvicorn main:app --reload --port 8000

# Run frontend locally
cd src/webapp && npm run dev

# Run ingestion
python scripts/ingest.py --input exports/export.zip

# Run ingestion without LLM (scrape only)
python scripts/ingest.py --input exports/export.zip --skip-llm
```

## Important Notes
- The WhatsApp parser handles multiple date formats (phone locale dependent)
- Full chat export is done each time; deduplication handles overlapping content via SHA256 hashes
- Article scraping happens over public internet; everything else stays local
- The `raw_html` column stores original page HTML; `clean_text` stores extracted article body
- LLM responses are structured JSON parsed directly into the `processed_items` table
- Weekly digests are generated from all processed articles within a date range
- VPN access is assumed at the network level; the app adds JWT auth on top

## Coding Conventions
- Python: type hints everywhere, async where beneficial, logging over print
- TypeScript: strict mode, functional components, hooks only
- API: RESTful, consistent error responses, pagination on all list endpoints
- Database: UUIDs for all primary keys, timestamps with timezone
