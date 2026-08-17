# Deploy Law Maker to Render

Gemini embeddings replace the local BGE-M3 model so the API can run on Render without a GPU or a large PyTorch image.

## What gets created

`render.yaml` defines:

- PostgreSQL 16 (`law-maker-db`) with pgvector available
- FastAPI backend (`law-maker-api`)
- Next.js frontend (`law-maker-web`)

## 1. Create the Blueprint

1. Push this repo to GitHub.
2. In Render, open **Blueprints** and connect the repo.
3. Render will read `render.yaml` and ask for the secret env vars marked `sync: false`.

Set these backend secrets:

| Variable                   | Purpose                                         |
| -------------------------- | ----------------------------------------------- |
| `GEMINI_API_KEY`           | Generation / translation                        |
| `GEMINI_EMBEDDING_API_KEY` | Embedding requests (can be a second Gemini key) |
| `SUPABASE_URL`             | Optional; used for PDF storage                  |
| `SUPABASE_SECRET_KEY`      | Optional; used for PDF storage                  |

Confirm these names if you want a different embedding model:

- `GEMINI_EMBEDDING_MODEL=gemini-embedding-001`
- `EMBEDDING_DIMENSION=768`

`gemini-embedding-2` is also supported. Keep documents and queries on the same model and dimension.

## 2. Enable pgvector

After the database is live, open a Postgres shell and run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

The API also runs this on startup. Existing `chunks.embedding` columns from BGE-M3 (`vector(1024)`) will not auto-migrate. Drop and recreate the `chunks` table, or run:

```sql
TRUNCATE chunks;
ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(768);
```

Then re-upload PDFs so they are embedded with Gemini.

## 3. Frontend API URL

The frontend uses `NEXT_PUBLIC_API_URL`. The Blueprint copies the backend public URL automatically. Rebuild the frontend if you change that value.

## 4. Manual deploy (no Blueprint)

Backend:

- Root directory: `backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health check: `/health`

Frontend:

- Root directory: `frontend`
- Build: `npm install && npm run build`
- Start: `npm run start`
- Env: `NEXT_PUBLIC_API_URL=https://<your-api>.onrender.com`

## Notes

- Render Postgres URLs start with `postgres://`. The backend rewrites them to SQLAlchemy’s `postgresql+psycopg2://`.
- Prefer Supabase (or another object store) for PDFs. Local disk on Render is ephemeral unless you attach a disk.
- After changing `GEMINI_EMBEDDING_MODEL` or `EMBEDDING_DIMENSION`, re-ingest every document.
