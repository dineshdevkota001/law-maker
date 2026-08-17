from __future__ import annotations

from urllib.parse import urlparse

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from config import get_settings
from models import Base


def _engine_kwargs(database_url: str) -> dict:
    parsed = urlparse(database_url)
    host = (parsed.hostname or "").lower()
    kwargs: dict = {"pool_pre_ping": True}
    # Transaction-mode PgBouncer (port 6543) cannot share SQLAlchemy's pool.
    if "pooler.supabase.com" in host and parsed.port == 6543:
        kwargs["poolclass"] = NullPool
    elif "pooler.supabase.com" in host:
        kwargs["pool_size"] = 5
        kwargs["max_overflow"] = 5
    return kwargs


settings = get_settings()
engine = create_engine(settings.database_url, **_engine_kwargs(settings.database_url))
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(bind=engine)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
