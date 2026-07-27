export interface Document {
  id: string;
  name: string;
  size: number;
  uploadedAt: Date;
  status: "processing" | "ready" | "error";
  syncFailed?: boolean; // New field to track sync status
  pageCount?: number;
  /** Blob URL (during optimistic upload) or backend file URL */
  url?: string;
  // Backend fields
  level: "global" | "per_subject" | "personal" | string;
  subject: string;
  userId?: string | null;
  language: string;
  sourceFileUrl?: string | null;
}

export interface UploadOptions {
  level?: "global" | "per_subject" | "personal";
  subject?: string;
  userId?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: SourceChunk[];
  error?: boolean;
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
