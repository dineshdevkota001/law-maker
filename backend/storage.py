"""File storage module with Supabase and local fallback support."""

import logging
from pathlib import Path
import io

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


def save_pdf_file(document_id: str, filename: str, content: bytes) -> str:
    """
    Save PDF file to Supabase storage with fallback to local storage.
    
    Returns:
        str: File identifier (remote URL or local path)
    """
    settings = get_settings()
    safe_name = _safe_filename(filename)
    file_key = f"{document_id}_{safe_name}"
    
    # Try Supabase first
    supabase = get_supabase_client()
    if supabase and settings.supabase_bucket:
        try:
            logger.info(f"Uploading to Supabase: {file_key} ({len(content)} bytes)")
            # Upload to Supabase Storage - pass raw bytes directly
            supabase.storage.from_(settings.supabase_bucket).upload(
                file_key,
                content,
                {
                    "content-type": "application/pdf",
                    "x-upsert": "true"  # Overwrite if exists
                }
            )
            # Return public URL
            url = f"{settings.supabase_url}/storage/v1/object/public/{settings.supabase_bucket}/{file_key}"
            logger.info(f"✓ File saved to Supabase: {file_key}")
            return url
        except Exception as e:
            logger.warning(f"✗ Failed to save to Supabase: {type(e).__name__}: {e}")
            logger.warning(f"  Falling back to local storage")
    
    # Fallback to local storage
    storage_dir = _storage_root()
    file_path = storage_dir / file_key
    with open(file_path, "wb") as fh:
        fh.write(content)
    logger.info(f"✓ File saved locally: {file_path}")
    return str(file_path)


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
