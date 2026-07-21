# Law Maker Backend

FastAPI backend for multilingual (Nepali/English) legal RAG with dynamic PDF ingestion.

## What is implemented

- Dynamic PDF upload endpoint: PDF -> text extraction -> chunking -> embeddings -> PostgreSQL/pgvector storage
- Metadata-aware storage and retrieval with three levels:
  - global
  - per_subject
  - personal (scoped by x-user-id header)
- Multilingual retrieval pipeline:
  - language detection
  - query variants in Nepali and English (Gemini + fallback translator)
  - multilingual embeddings using BAAI/bge-m3
- Gemini answer synthesis with chunk citations

## Requirements

- Python 3.11+
- PostgreSQL 14+
- pgvector extension enabled in Postgres

## Environment variables

Start with:

```bash
cp .env.example .env
```

Then update values as needed:

DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/law_maker
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash
EMBEDDING_MODEL_NAME=BAAI/bge-m3
EMBEDDING_DIMENSION=1024
MAX_UPLOAD_MB=25
DEFAULT_SUBJECT=general
DEFAULT_TOP_K=6
PDF_STORAGE_DIR=data/uploads
SOURCE_URL_TTL_SECONDS=900

## Install and run

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

On startup, the app creates the vector extension (if available) and required tables.

## API summary

- POST /api/upload_pdf
- GET /api/documents
- GET /api/documents/{id}
- GET /api/documents/{id}/file
- GET /api/documents/{id}/source-link
- DELETE /api/documents/{id}
- GET /api/chat
- GET /api/search

For complete frontend contract details, see ../docs/frontend-backend-contract.md.
