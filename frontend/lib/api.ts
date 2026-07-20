import type { Document, SourceChunk } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function uploadDocument(file: File): Promise<Document> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/upload_pdf`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.statusText}`);
  }

  return res.json();
}

export async function sendMessage(
  query: string
): Promise<{ answer: string; sources: SourceChunk[] }> {
  const res = await fetch(
    `${API_BASE}/api/chat?query=${encodeURIComponent(query)}`
  );

  if (!res.ok) {
    throw new Error(`Chat failed: ${res.statusText}`);
  }

  return res.json();
}

export async function getDocuments(): Promise<Document[]> {
  const res = await fetch(`${API_BASE}/api/documents`);

  if (!res.ok) {
    return [];
  }

  return res.json();
}
