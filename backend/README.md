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
  - hosted Gemini embeddings (`gemini-embedding-001` by default)
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

DATABASE_URL=postgresql+psycopg2://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=your_supabase_secret_key
SUPABASE_BUCKET=documents
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash
GEMINI_EMBEDDING_API_KEY=your_embedding_key_here
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSION=768
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

If you previously indexed documents with BGE-M3 (`vector(1024)`), change the column to `vector(768)` and re-upload PDFs.

## Deploy on Render

See [docs/render.md](../docs/render.md) and the repo-root `render.yaml` Blueprint.

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
