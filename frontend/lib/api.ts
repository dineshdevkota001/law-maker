import type { Document, SourceChunk, UploadOptions } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Documents API
// ---------------------------------------------------------------------------

/**
 * Uploads a PDF file to the backend vector RAG pipeline.
 * POST /api/upload_pdf
 */
export async function uploadDocument(
  file: File,
  opts?: UploadOptions
): Promise<Document> {
  const formData = new FormData();
  formData.append("file", file);
  if (opts?.level) formData.append("level", opts.level);
  if (opts?.subject) formData.append("subject", opts.subject);

  const headers: HeadersInit = {};
  if (opts?.userId) headers["x-user-id"] = opts.userId;

  const res = await fetch(`${API_BASE}/api/upload_pdf`, {
    method: "POST",
    body: formData,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detailMsg = typeof body?.detail === "string" 
      ? body.detail 
      : body?.detail?.detail ?? body?.error ?? `Upload failed (${res.status})`;
    throw new Error(detailMsg);
  }

  return _toDocument(await res.json());
}

/**
 * Lists all documents accessible to the given user.
 * GET /api/documents
 */
export async function getDocuments(userId?: string): Promise<Document[]> {
  const headers: HeadersInit = {};
  if (userId) headers["x-user-id"] = userId;

  const res = await fetch(`${API_BASE}/api/documents`, { headers });
  if (!res.ok) return [];

  const data: unknown[] = await res.json();
  return data.map(_toDocument);
}

/**
 * Retrieves single document metadata by ID.
 * GET /api/documents/{id}
 */
export async function getDocument(
  id: string,
  userId?: string
): Promise<Document> {
  const headers: HeadersInit = {};
  if (userId) headers["x-user-id"] = userId;

  const res = await fetch(`${API_BASE}/api/documents/${id}`, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detailMsg = typeof body?.detail === "string"
      ? body.detail
      : body?.detail?.detail ?? `Failed to fetch document (${res.status})`;
    throw new Error(detailMsg);
  }

  return _toDocument(await res.json());
}

/**
 * Generates a signed/temporary source view link for a document page.
 * GET /api/documents/{id}/source-link?page={page}
 */
export async function getDocumentSourceLink(
  id: string,
  page: number = 1,
  userId?: string
): Promise<{ documentId: string; sourceUrl: string; expiresInSeconds: number }> {
  const headers: HeadersInit = {};
  if (userId) headers["x-user-id"] = userId;

  const res = await fetch(
    `${API_BASE}/api/documents/${id}/source-link?page=${page}`,
    { headers }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detailMsg = typeof body?.detail === "string"
      ? body.detail
      : body?.detail?.detail ?? `Failed to get source link (${res.status})`;
    throw new Error(detailMsg);
  }

  return res.json();
}

/**
 * Deletes a document by ID.
 * DELETE /api/documents/{id}
 */
export async function deleteDocument(
  id: string,
  userId?: string
): Promise<void> {
  const headers: HeadersInit = {};
  if (userId) headers["x-user-id"] = userId;

  const res = await fetch(`${API_BASE}/api/documents/${id}`, {
    method: "DELETE",
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detailMsg = typeof body?.detail === "string"
      ? body.detail
      : body?.detail?.detail ?? `Delete failed (${res.status})`;
    throw new Error(detailMsg);
  }
}

// ---------------------------------------------------------------------------
// Chat & Vector Search API
// ---------------------------------------------------------------------------

/**
 * Sends a query to the Legal RAG endpoint.
 * GET /api/chat
 */
export async function sendMessage(
  query: string,
  opts?: {
    level?: string;
    subject?: string;
    documentId?: string;
    userId?: string;
  }
): Promise<{ answer: string; sources: SourceChunk[] }> {
  const params = new URLSearchParams({ query });
  if (opts?.level) params.set("level", opts.level);
  if (opts?.subject) params.set("subject", opts.subject);
  if (opts?.documentId) params.set("documentId", opts.documentId);

  const headers: HeadersInit = {};
  if (opts?.userId) headers["x-user-id"] = opts.userId;

  const res = await fetch(`${API_BASE}/api/chat?${params.toString()}`, {
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detailMsg = typeof body?.detail === "string"
      ? body.detail
      : body?.detail?.detail ?? `Chat query failed (${res.status})`;
    throw new Error(detailMsg);
  }

  return res.json();
}

/**
 * Direct vector & lexical search without LLM generation.
 * GET /api/search
 */
export async function searchChunks(
  query: string,
  opts?: {
    level?: string;
    subject?: string;
    documentId?: string;
    limit?: number;
    userId?: string;
  }
): Promise<SourceChunk[]> {
  const params = new URLSearchParams({ query });
  if (opts?.level) params.set("level", opts.level);
  if (opts?.subject) params.set("subject", opts.subject);
  if (opts?.documentId) params.set("documentId", opts.documentId);
  if (opts?.limit) params.set("limit", opts.limit.toString());

  const headers: HeadersInit = {};
  if (opts?.userId) headers["x-user-id"] = opts.userId;

  const res = await fetch(`${API_BASE}/api/search?${params.toString()}`, {
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detailMsg = typeof body?.detail === "string"
      ? body.detail
      : body?.detail?.detail ?? `Search query failed (${res.status})`;
    throw new Error(detailMsg);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Helper Utilities
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _toDocument(raw: any): Document {
  return {
    id: raw.id,
    name: raw.name,
    size: raw.size,
    uploadedAt: new Date(raw.uploadedAt),
    status: raw.status,
    pageCount: raw.pageCount ?? undefined,
    level: raw.level,
    subject: raw.subject,
    userId: raw.userId ?? null,
    language: raw.language,
    sourceFileUrl: raw.sourceFileUrl ?? null,
    url: raw.sourceFileUrl ? `${API_BASE}${raw.sourceFileUrl}` : undefined,
  };
}
