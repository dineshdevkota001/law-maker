"""File storage: Supabase Storage on Render, local disk only for development."""

import logging
import os
from pathlib import Path

from config import get_settings

logger = logging.getLogger(__name__)

# Try to import supabase, but make it optional
try:
    from supabase import create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

_supabase_client = None


def get_supabase_client():
    """Get or create Supabase client."""
    global _supabase_client
    if not SUPABASE_AVAILABLE:
        return None
    
    if _supabase_client is None:
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_key:
            logger.warning("Supabase credentials not configured, using local storage fallback")
            return None
        
        try:
            _supabase_client = create_client(settings.supabase_url, settings.supabase_key)
            logger.info("✓ Supabase client initialized successfully")
        except Exception as e:
            logger.error(f"✗ Failed to initialize Supabase client: {e}")
            return None
    
    return _supabase_client


def _storage_root() -> Path:
    """Get local storage root directory."""
    settings = get_settings()
    base_dir = Path(__file__).resolve().parent
    path = Path(settings.pdf_storage_dir)
    if not path.is_absolute():
        path = base_dir / path
    path.mkdir(parents=True, exist_ok=True)
    return path


def _safe_filename(filename: str) -> str:
    """Sanitize filename."""
    import re
    name = re.sub(r"[^a-zA-Z0-9_.-]", "_", filename).strip("._")
    return name or "document.pdf"


def _on_render() -> bool:
    return bool(os.getenv("RENDER"))


def save_pdf_file(document_id: str, filename: str, content: bytes) -> str:
    """
    Save the PDF to Supabase Storage.

    Local disk is only used when Supabase is not configured (local development).
    Render has no persistent disk, so Storage credentials are required there.
    """
    settings = get_settings()
    safe_name = _safe_filename(filename)
    file_key = f"{document_id}_{safe_name}"

    supabase = get_supabase_client()
    if not supabase:
        if _on_render():
            raise RuntimeError(
                "Supabase Storage is required on Render. "
                "Set SUPABASE_URL and SUPABASE_SECRET_KEY."
            )
        storage_dir = _storage_root()
        file_path = storage_dir / file_key
        with open(file_path, "wb") as fh:
            fh.write(content)
        logger.info("File saved locally: %s", file_path)
        return str(file_path)

    logger.info("Uploading to Supabase Storage: %s (%s bytes)", file_key, len(content))
    supabase.storage.from_(settings.supabase_bucket).upload(
        file_key,
        content,
        {
            "content-type": "application/pdf",
            "upsert": "true",
            "x-upsert": "true",
        },
    )
    url = (
        f"{settings.supabase_url}/storage/v1/object/public/"
        f"{settings.supabase_bucket}/{file_key}"
    )
    logger.info("File saved to Supabase Storage: %s", file_key)
    return url


def get_pdf_file(file_identifier: str) -> bytes:
    """
    Retrieve PDF file from Supabase or local storage.
    
    Args:
        file_identifier: Remote URL or local path
        
    Returns:
        bytes: File content
    """
    settings = get_settings()
    supabase = get_supabase_client()
    
    # Check if it's a Supabase URL
    if file_identifier.startswith(settings.supabase_url or ""):
        if supabase and settings.supabase_bucket:
            try:
                # Extract file key from URL
                file_key = file_identifier.split(f"{settings.supabase_bucket}/")[-1]
                response = supabase.storage.from_(settings.supabase_bucket).download(file_key)
                logger.info(f"File retrieved from Supabase: {file_key}")
                return response
            except Exception as e:
                logger.error(f"Failed to retrieve from Supabase: {e}")
                raise
    
    # Treat as local path
    file_path = Path(file_identifier)
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_identifier}")
    
    with open(file_path, "rb") as fh:
        return fh.read()


def file_exists(file_identifier: str) -> bool:
    """Check if file exists."""
    settings = get_settings()
    supabase = get_supabase_client()
    
    # Check if it's a Supabase URL
    if file_identifier.startswith(settings.supabase_url or ""):
        if supabase and settings.supabase_bucket:
            try:
                file_key = file_identifier.split(f"{settings.supabase_bucket}/")[-1]
                supabase.storage.from_(settings.supabase_bucket).list(file_key)
                return True
            except Exception:
                return False
    
    # Check local path
    return Path(file_identifier).exists()


def delete_pdf_file(file_identifier: str) -> bool:
    """
    Delete PDF file from Supabase or local storage.
    
    Returns:
        bool: Success status
    """
    settings = get_settings()
    supabase = get_supabase_client()
    
    # Check if it's a Supabase URL
    if file_identifier.startswith(settings.supabase_url or ""):
        if supabase and settings.supabase_bucket:
            try:
                file_key = file_identifier.split(f"{settings.supabase_bucket}/")[-1]
                supabase.storage.from_(settings.supabase_bucket).remove([file_key])
                logger.info(f"File deleted from Supabase: {file_key}")
                return True
            except Exception as e:
                logger.error(f"Failed to delete from Supabase: {e}")
                return False
    
    # Delete local file
    try:
        Path(file_identifier).unlink()
        logger.info(f"File deleted locally: {file_identifier}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete local file: {e}")
        return False
