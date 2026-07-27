export interface Document {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  status: "processing" | "ready" | "error";
  pageCount?: number;
  level: "global" | "per_subject" | "personal";
  subject: string;
  userId: string | null;
  language: string;
  sourceFileUrl?: string | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: SourceChunk[];
  isStreaming?: boolean;
}

export interface SourceChunk {
  chunkId: string;
  documentId: string;
  documentName: string;
  page: number;
  pageStart: number;
  pageEnd: number;
  clauseId?: string | null;
  clauseHeading?: string | null;
  text: string;
  score: number;
  sourceUrl: string;
}

export interface ChatResponse {
  answer: string;
  sources: SourceChunk[];
}
