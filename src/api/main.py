"""
FastAPI application entry point for the AeroData Intelligence Platform.
"""

import logging
import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    version="1.0.0",
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


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
