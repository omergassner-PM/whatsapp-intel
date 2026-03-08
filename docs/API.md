# API Reference

Base URL: `http://<server-ip>:8000/api/v1`

All endpoints except `/auth/login` require a valid JWT token in the `Authorization: Bearer <token>` header.

## Authentication

### POST /auth/login

Login and receive a JWT token.

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "access_token": "string",
  "token_type": "bearer",
  "expires_in": 86400,
  "user": {
    "id": "uuid",
    "username": "string",
    "display_name": "string",
    "role": "admin | viewer"
  }
}
```

## Upload

### POST /upload

Upload a WhatsApp export `.zip` file for processing. Requires `admin` role.

**Request:** `multipart/form-data` with field `file` (`.zip`)

**Response:**
```json
{
  "status": "processing",
  "job_id": "uuid",
  "messages_found": 342,
  "new_messages": 47,
  "skipped_duplicates": 295,
  "urls_found": 12
}
```

## Articles

### GET /articles

List articles with optional filters.

**Query Parameters:**
| Param       | Type   | Description                          |
|------------|--------|--------------------------------------|
| page       | int    | Page number (default: 1)             |
| limit      | int    | Items per page (default: 20)         |
| tag        | string | Filter by tag                        |
| week       | string | Filter by week (YYYY-Wnn format)     |
| min_score  | int    | Minimum relevance score (1-5)        |
| search     | string | Full-text search query               |
| sort       | string | Sort field (date, relevance, title)  |

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Article Title",
      "source_url": "https://...",
      "published_date": "2025-03-01",
      "tldr": "Short summary...",
      "tags": ["defense", "technology"],
      "relevance_score": 4,
      "shared_by": "Sender Name",
      "shared_at": "2025-03-02T14:30:00Z"
    }
  ],
  "total": 156,
  "page": 1,
  "pages": 8
}
```

### GET /articles/:id

Get full article details including extracted knowledge.

**Response:**
```json
{
  "id": "uuid",
  "title": "Article Title",
  "source_url": "https://...",
  "published_date": "2025-03-01",
  "clean_text": "Full article content...",
  "word_count": 1240,
  "tldr": "Short summary...",
  "key_facts": ["Fact 1", "Fact 2"],
  "people": [
    {"name": "Person", "role": "CEO", "context": "Quoted in article"}
  ],
  "technologies": ["Tech 1"],
  "dates": [
    {"date": "2025-04-01", "context": "Launch deadline"}
  ],
  "action_items": ["Consider X"],
  "tags": ["defense", "technology"],
  "relevance_score": 4,
  "shared_by": "Sender Name",
  "shared_at": "2025-03-02T14:30:00Z",
  "processed_at": "2025-03-02T15:00:00Z"
}
```

## Weekly Digests

### GET /weekly

List weekly digest summaries.

**Query Parameters:**
| Param | Type   | Description                     |
|-------|--------|---------------------------------|
| page  | int    | Page number (default: 1)        |
| limit | int    | Items per page (default: 10)    |

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "week_start": "2025-03-03",
      "week_end": "2025-03-09",
      "summary": "This week's key developments...",
      "article_count": 8,
      "top_items": [
        {"title": "Most Important Article", "tldr": "...", "score": 5}
      ]
    }
  ],
  "total": 12,
  "page": 1
}
```

### GET /weekly/:id

Get full weekly digest with all articles from that week.

## Search

### GET /search

Full-text and semantic search across all processed content.

**Query Parameters:**
| Param  | Type   | Description                          |
|--------|--------|--------------------------------------|
| q      | string | Search query (required)              |
| type   | string | text (default) or semantic           |
| limit  | int    | Max results (default: 20)            |

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "title": "Article Title",
      "tldr": "Summary...",
      "relevance_score": 4,
      "match_snippet": "...matching text highlighted...",
      "match_score": 0.89
    }
  ],
  "total": 5,
  "query": "original query"
}
```

## Tags

### GET /tags

List all tags with article counts.

**Response:**
```json
{
  "tags": [
    {"name": "defense", "count": 45},
    {"name": "technology", "count": 38},
    {"name": "policy", "count": 22}
  ]
}
```

## Admin

### GET /admin/users (admin only)

List all users.

### POST /admin/users (admin only)

Create a new user.

### PUT /admin/users/:id (admin only)

Update user details or role.

### DELETE /admin/users/:id (admin only)

Deactivate a user account.

### GET /admin/logs (admin only)

View ingestion history and processing logs.
