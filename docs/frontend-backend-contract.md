# Frontend-Backend API Contract

This document defines how frontend should integrate with ingestion, multilingual retrieval, and citation source viewing APIs.

## Base URL

- Local: http://localhost:8000

## Authentication model (current)

- No auth middleware yet.
- Personal scope depends on request header:
  - x-user-id: string

## Document levels and metadata

The backend stores each document with:

- level: one of global, per_subject, personal
- subject: string (optional for upload, defaults to general)
- user_id: string | null

Rules:

- global: visible to everyone
- per_subject: visible to everyone, but can be filtered by subject
- personal: only visible/searchable for same x-user-id

## Endpoints

## 1) Upload PDF

POST /api/upload_pdf
Content-Type: multipart/form-data

Form fields:

- file: PDF file (required)
- level: global | per_subject | personal (optional, defaults to global)
- subject: string (optional, defaults to general)

Headers:

- x-user-id: required only when level=personal

Success response (200):

```json
{
  "id": "95db4c89-f91d-4d17-909a-221bbafb1659",
  "name": "civil-code-nepal.pdf",
  "size": 1723112,
  "uploadedAt": "2026-07-22T07:31:42.114907+00:00",
  "status": "ready",
  "pageCount": 84,
  "level": "per_subject",
  "subject": "criminal",
  "userId": null,
  "language": "ne",
  "sourceFileUrl": "/api/documents/95db4c89-f91d-4d17-909a-221bbafb1659/file"
}
```

Error shape:

```json
{
  "error": "ERROR_CODE",
  "detail": "Human readable detail"
}
```

Common upload errors:

- UNSUPPORTED_FILE_TYPE (400)
- INVALID_LEVEL (400)
- USER_ID_REQUIRED (400)
- UPLOAD_SIZE_EXCEEDED (413)
- PDF_PARSE_FAILED (400)
- UPLOAD_PROCESSING_FAILED (500)

## 2) List documents

GET /api/documents

Headers:

- x-user-id optional

Response:

```json
[
  {
    "id": "...",
    "name": "...",
    "size": 123,
    "uploadedAt": "...",
    "status": "ready",
    "pageCount": 12,
    "level": "global",
    "subject": "general",
    "userId": null,
    "language": "ne",
    "sourceFileUrl": "/api/documents/.../file"
  }
]
```

## 3) Get document by id

GET /api/documents/{document_id}

Visibility follows scope rules.

## 4) Delete document

DELETE /api/documents/{document_id}

Rules:

- global/per_subject can be deleted (no auth guard yet)
- personal can only be deleted by matching x-user-id

Success:

```json
{
  "ok": true,
  "deletedDocumentId": "..."
}
```

## 5) Get source link for a page

GET /api/documents/{document_id}/source-link?page=22

Response:

```json
{
  "documentId": "...",
  "sourceUrl": "/api/documents/.../file?page=22",
  "expiresInSeconds": 900
}
```

## 6) Stream original PDF

GET /api/documents/{document_id}/file

Returns original PDF binary stream. Frontend can use query page=... for viewer state.

## 7) Chat with RAG

GET /api/chat

Query params:

- query: string (required)
- level: global | per_subject | personal (optional)
- subject: string (optional)
- documentId: string (optional)

Headers:

- x-user-id required only for personal scope

Response:

```json
{
  "answer": "...",
  "sources": [
    {
      "chunkId": "...",
      "documentId": "...",
      "documentName": "civil-code-nepal.pdf",
      "page": 22,
      "pageStart": 22,
      "pageEnd": 22,
      "clauseId": "p22-c3",
      "clauseHeading": "दफा ५",
      "text": "...",
      "score": 0.8421,
      "sourceUrl": "/api/documents/.../file?page=22"
    }
  ]
}
```

Behavior:

- Query can be Nepali or English.
- Backend detects language and generates bilingual query variants.
- Retrieval uses hybrid ranking (vector + lexical) for better legal matching.
- Gemini generates answer in the same language as user query.

## 8) Search only (no answer generation)

GET /api/search

Query params:

- query: string (required)
- level: global | per_subject | personal (optional)
- subject: string (optional)
- documentId: string (optional)
- limit: number, 1..25 (optional, default 6)

Headers:

- x-user-id required only for personal scope

Response:

Array of source chunks (same as chat.sources).

## Frontend implementation guidance

- Keep current optimistic upload UI, then replace with backend payload document id.
- For personal documents, always send x-user-id.
- Use sourceUrl from citations to open source PDF and jump to page in viewer state.
- For per_subject filtering, include subject in upload/search requests.
- For error handling, parse response body and surface error/detail.
- For query mode toggles:
  - default chat call: /api/chat?query=...
  - retrieval debug mode: /api/search?query=...

## Suggested future extension points

- Async ingestion progress field (0-100)
- JWT auth and role-based access control
- Chunk offsets for text highlighting inside rendered PDF
- Pagination for /api/documents
