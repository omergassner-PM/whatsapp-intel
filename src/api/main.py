"""
FastAPI application entry point for the AeroData Intelligence Platform.
"""

import logging
import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.api.routes import admin, articles, auth, notes, search, tags, upload, weekly
from src.database.models import Base
from src.api.database import engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(
    title="AeroData",
    description="AeroDan Ltd — Intelligence Platform",
    version="0.1.0",
)

# CORS
allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routes under /api/v1
prefix = "/api/v1"
app.include_router(auth.router, prefix=prefix)
app.include_router(articles.router, prefix=prefix)
app.include_router(weekly.router, prefix=prefix)
app.include_router(search.router, prefix=prefix)
app.include_router(tags.router, prefix=prefix)
app.include_router(upload.router, prefix=prefix)
app.include_router(notes.router, prefix=prefix)
app.include_router(admin.router, prefix=prefix)


logger = logging.getLogger(__name__)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled error: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


def _apply_schema_migrations() -> None:
    """Apply any pending schema changes that create_all won't handle."""
    from sqlalchemy import inspect, text

    with engine.connect() as conn:
        inspector = inspect(engine)

        # Check if users table exists and needs updates
        if "users" in inspector.get_table_names():
            columns = {col["name"] for col in inspector.get_columns("users")}

            if "email" not in columns:
                logger.info("Adding 'email' column to users table")
                conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR(255)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_email ON users (email)"))

            # Make password_hash nullable (for viewer self-registration)
            conn.execute(text("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL"))

        # Check if processed_items table needs language column
        if "processed_items" in inspector.get_table_names():
            pi_columns = {col["name"] for col in inspector.get_columns("processed_items")}
            if "language" not in pi_columns:
                logger.info("Adding 'language' column to processed_items table")
                conn.execute(text("ALTER TABLE processed_items ADD COLUMN language VARCHAR(10)"))

        conn.commit()


@app.on_event("startup")
def on_startup() -> None:
    try:
        Base.metadata.create_all(bind=engine)
        _apply_schema_migrations()
    except Exception as e:
        logger.warning("Could not create/migrate tables on startup: %s", e)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
