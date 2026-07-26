import type { ChatResponse, Document, SourceChunk } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function resolveApiUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const normalized = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${API_BASE}${normalized}`;
}

export function buildPdfPageUrl(sourceUrl: string, page: number): string {
  const url = new URL(resolveApiUrl(sourceUrl));
  url.searchParams.set("page", String(page));
  url.hash = `page=${page}`;
  return url.toString();
}

type ChatStreamHandlers = {
  onDelta: (delta: string) => void;
};

function parseMaybeJson(payload: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(payload);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function mergeSources(candidate: unknown): SourceChunk[] | null {
  if (!Array.isArray(candidate)) {
    return null;
  }
  return candidate as SourceChunk[];
}

function applyStreamPayload(
  payload: string,
  state: { answer: string; sources: SourceChunk[] },
  handlers: ChatStreamHandlers
): void {
  const trimmed = payload.trim();
  if (!trimmed || trimmed === "[DONE]") {
    return;
  }

  const data = parseMaybeJson(trimmed);
  if (!data) {
    state.answer += trimmed;
    handlers.onDelta(trimmed);
    return;
  }

  const deltaCandidate =
    typeof data.delta === "string"
      ? data.delta
      : typeof data.answerDelta === "string"
      ? data.answerDelta
      : null;

  if (deltaCandidate) {
    state.answer += deltaCandidate;
    handlers.onDelta(deltaCandidate);
  }

  if (typeof data.answer === "string") {
    const nextAnswer = data.answer;
    if (nextAnswer.length > state.answer.length) {
      const delta = nextAnswer.slice(state.answer.length);
      state.answer = nextAnswer;
      if (delta) {
        handlers.onDelta(delta);
      }
    } else {
      state.answer = nextAnswer;
    }
  }

  const nextSources = mergeSources(data.sources);
  if (nextSources) {
    state.sources = nextSources;
  }
}

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

export async function sendMessageStream(
  query: string,
  handlers: ChatStreamHandlers
): Promise<ChatResponse> {
  const res = await fetch(
    `${API_BASE}/api/chat?query=${encodeURIComponent(query)}`
  );

  if (!res.ok) {
    throw new Error(`Chat failed: ${res.statusText}`);
  }

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json") || !res.body) {
    const json = (await res.json()) as ChatResponse;
    if (json.answer) {
      handlers.onDelta(json.answer);
    }
    return json;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const state: ChatResponse = { answer: "", sources: [] };
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }
      if (line.startsWith("data:")) {
        applyStreamPayload(line.slice(5), state, handlers);
      } else {
        applyStreamPayload(line, state, handlers);
      }
    }
  }

  const finalChunk = buffer.trim();
  if (finalChunk) {
    if (finalChunk.startsWith("data:")) {
      applyStreamPayload(finalChunk.slice(5), state, handlers);
    } else {
      applyStreamPayload(finalChunk, state, handlers);
    }
  }

  return state;
}

export async function getDocuments(): Promise<Document[]> {
  const res = await fetch(`${API_BASE}/api/documents`);

  if (!res.ok) {
    return [];
  }

  return res.json();
}
