import type {
  ChatHistoryMessage,
  ChatResponse,
  Document,
  SourceChunk,
} from "./types";
import { getStoredPreference, PREF_KEYS } from "./preferences";

function getApiBase(): string {
  // Try to get from localStorage first (user preference)
  if (typeof window !== "undefined") {
    const stored = getStoredPreference(PREF_KEYS.backendUrl, "");
    if (stored) {
      return stored;
    }
  }
  // Fall back to environment variable or default
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

export function resolveApiUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const normalized = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${getApiBase()}${normalized}`;
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

type SendMessageOptions = {
  sessionId?: string;
};

type UploadOptions = {
  level?: "global" | "per_subject" | "personal";
  subject?: string;
  userId?: string;
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
  handlers: ChatStreamHandlers,
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

export async function uploadDocument(
  file: File,
  options: UploadOptions = {},
): Promise<Document> {
  const formData = new FormData();
  formData.append("file", file);
  if (options.level) {
    formData.append("level", options.level);
  }
  if (options.subject) {
    formData.append("subject", options.subject);
  }

  const headers: HeadersInit = {};
  if (options.level === "personal" && options.userId) {
    headers["x-user-id"] = options.userId;
  }

  const res = await fetch(`${getApiBase()}/api/upload_pdf`, {
    method: "POST",
    body: formData,
    headers,
  });

  if (!res.ok) {
    let message = `Upload failed: ${res.statusText}`;
    try {
      const payload = await res.json();
      if (payload?.detail?.detail) {
        message = payload.detail.detail;
      } else if (payload?.detail) {
        message = payload.detail;
      }
    } catch {
      // Ignore JSON parsing errors and use default message.
    }
    throw new Error(message);
  }

  return res.json();
}

export async function sendMessageStream(
  query: string,
  handlers: ChatStreamHandlers,
  options: SendMessageOptions = {},
): Promise<ChatResponse> {
  const params = new URLSearchParams({ query });
  if (options.sessionId) {
    params.set("sessionId", options.sessionId);
  }

  const res = await fetch(`${getApiBase()}/api/chat?${params.toString()}`);

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
  const res = await fetch(`${getApiBase()}/api/documents`);

  if (!res.ok) {
    return [];
  }

  return res.json();
}

export async function getChatHistory(
  sessionId: string,
): Promise<ChatHistoryMessage[]> {
  const params = new URLSearchParams({ sessionId });
  const res = await fetch(
    `${getApiBase()}/api/chat/history?${params.toString()}`,
  );

  if (!res.ok) {
    return [];
  }

  return res.json();
}

export async function clearChatHistory(sessionId: string): Promise<void> {
  const params = new URLSearchParams({ sessionId });
  const res = await fetch(
    `${getApiBase()}/api/chat/history?${params.toString()}`,
    {
      method: "DELETE",
    },
  );

  if (!res.ok) {
    throw new Error("Failed to clear chat history.");
  }
}

export async function deleteDocument(
  documentId: string,
  userId?: string,
): Promise<void> {
  const headers: HeadersInit = {};
  if (userId) {
    headers["x-user-id"] = userId;
  }

  const res = await fetch(`${getApiBase()}/api/documents/${documentId}`, {
    method: "DELETE",
    headers,
  });

  if (!res.ok) {
    let message = `Delete failed: ${res.statusText}`;
    try {
      const payload = await res.json();
      if (payload?.detail?.detail) {
        message = payload.detail.detail;
      } else if (payload?.detail) {
        message = payload.detail;
      }
    } catch {
      // Ignore JSON parsing errors and use default message.
    }
    throw new Error(message);
  }
}
