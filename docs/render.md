# Deploy Law Maker to Render

Gemini embeddings replace the local BGE-M3 model so the API can run on Render without a GPU or a large PyTorch image.

## What gets created

`render.yaml` defines the FastAPI backend (`law-maker-api`). Postgres and PDF files live on Supabase (Session pooler + Storage). Deploy the Next.js frontend as a second web service if you are not using a Blueprint that includes it.

## 1. Create the Blueprint

1. Push this repo to GitHub.
2. In Render, open **Blueprints** and connect the repo.
3. Render will read `render.yaml` and ask for the secret env vars marked `sync: false`.

Set these backend secrets:

| Variable                   | Purpose                                         |
| -------------------------- | ----------------------------------------------- |
| `DATABASE_URL`             | Supabase **Session pooler** URI (IPv4)          |
| `GEMINI_API_KEY`           | Generation / translation                        |
| `GEMINI_EMBEDDING_API_KEY` | Embedding requests (can be a second Gemini key) |
| `SUPABASE_URL`             | Project URL for Storage (`https://….supabase.co`) |
| `SUPABASE_SECRET_KEY`      | Service role / secret key (server-side uploads) |
| `SUPABASE_BUCKET`          | Storage bucket name (default `documents`)       |

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

- **Postgres** needs the Session pooler. Render outbound is IPv4; Supabase’s direct host (`db.<project-ref>.supabase.co`) is IPv6-only:
  - Dashboard: **Project Settings → Database → Connect → Session pooler**
  - Host: `aws-0-<region>.pooler.supabase.com`
  - Port: `5432` (session). Prefer this over transaction mode (`6543`) for SQLAlchemy + pgvector.
  - User: `postgres.<project-ref>` (not `postgres`)
  - Example: `postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require`
  - The backend rewrites `postgres://` / `postgresql://` to `postgresql+psycopg2://` and adds `sslmode=require` when missing.
- **PDF uploads** use the Storage REST API (`SUPABASE_URL`), which is HTTPS and already IPv4. Do not put the pooler host in `SUPABASE_URL`. Create a private or public bucket named `documents` (or set `SUPABASE_BUCKET`). Render disk is ephemeral, so uploads fail if Storage is not configured.
- After changing `GEMINI_EMBEDDING_MODEL` or `EMBEDDING_DIMENSION`, re-ingest every document.
