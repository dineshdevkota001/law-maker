from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv
from pydantic import BaseModel, Field


load_dotenv()


def _normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return "postgresql+psycopg2://" + url[len("postgres://") :]
    if url.startswith("postgresql+psycopg://"):
        return "postgresql+psycopg2://" + url[len("postgresql+psycopg://") :]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg2://" + url[len("postgresql://") :]
    return url


class Settings(BaseModel):
    database_url: str = Field(
        default="postgresql+psycopg2://postgres:postgres@localhost:5432/law_maker"
    )
    supabase_url: str | None = Field(default=None)
    supabase_key: str | None = Field(default=None)  # Secret key for server-side operations
    supabase_bucket: str = Field(default="documents")
    gemini_embedding_model: str = Field(default="gemini-embedding-001")
    embedding_dimension: int = Field(default=768)
    gemini_api_key: str | None = Field(default=None)
    gemini_embedding_api_key: str | None = Field(default=None)
    gemini_model: str = Field(default="gemini-2.0-flash")
    max_upload_mb: int = Field(default=25)
    default_subject: str = Field(default="general")
    default_top_k: int = Field(default=6)
    pdf_storage_dir: str = Field(default="data/uploads")
    source_url_ttl_seconds: int = Field(default=900)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        database_url=_normalize_database_url(
            os.getenv(
                "DATABASE_URL",
                "postgresql+psycopg2://postgres:postgres@localhost:5432/law_maker",
            )
        ),
        supabase_url=os.getenv("SUPABASE_URL"),
        supabase_key=os.getenv("SUPABASE_SECRET_KEY"),  # Use secret key for server-side
        supabase_bucket=os.getenv("SUPABASE_BUCKET", "documents"),
        gemini_embedding_model=os.getenv(
            "GEMINI_EMBEDDING_MODEL", "gemini-embedding-001"
        ),
        embedding_dimension=int(os.getenv("EMBEDDING_DIMENSION", "768")),
        gemini_api_key=os.getenv("GEMINI_API_KEY"),
        gemini_embedding_api_key=os.getenv("GEMINI_EMBEDDING_API_KEY"),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
        max_upload_mb=int(os.getenv("MAX_UPLOAD_MB", "25")),
        default_subject=os.getenv("DEFAULT_SUBJECT", "general"),
        default_top_k=int(os.getenv("DEFAULT_TOP_K", "6")),
        pdf_storage_dir=os.getenv("PDF_STORAGE_DIR", "data/uploads"),
        source_url_ttl_seconds=int(os.getenv("SOURCE_URL_TTL_SECONDS", "900")),
    )
