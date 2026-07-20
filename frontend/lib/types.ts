export interface Document {
  id: string;
  name: string;
  size: number;
  uploadedAt: Date;
  status: "processing" | "ready" | "error";
  pageCount?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: SourceChunk[];
}

export interface SourceChunk {
  documentId: string;
  documentName: string;
  page: number;
  text: string;
  score: number;
}
