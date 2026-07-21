from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv
from pydantic import BaseModel, Field


load_dotenv()


class Settings(BaseModel):
    database_url: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/law_maker"
    )
    embedding_model_name: str = Field(default="BAAI/bge-m3")
    embedding_dimension: int = Field(default=1024)
    gemini_api_key: str | None = Field(default=None)
    gemini_model: str = Field(default="gemini-2.0-flash")
    max_upload_mb: int = Field(default=25)
    default_subject: str = Field(default="general")
    default_top_k: int = Field(default=6)
    pdf_storage_dir: str = Field(default="data/uploads")
    source_url_ttl_seconds: int = Field(default=900)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        database_url=os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg://postgres:postgres@localhost:5432/law_maker",
        ),
        embedding_model_name=os.getenv("EMBEDDING_MODEL_NAME", "BAAI/bge-m3"),
        embedding_dimension=int(os.getenv("EMBEDDING_DIMENSION", "1024")),
        gemini_api_key=os.getenv("GEMINI_API_KEY"),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
        max_upload_mb=int(os.getenv("MAX_UPLOAD_MB", "25")),
        default_subject=os.getenv("DEFAULT_SUBJECT", "general"),
        default_top_k=int(os.getenv("DEFAULT_TOP_K", "6")),
        pdf_storage_dir=os.getenv("PDF_STORAGE_DIR", "data/uploads"),
        source_url_ttl_seconds=int(os.getenv("SOURCE_URL_TTL_SECONDS", "900")),
    )
