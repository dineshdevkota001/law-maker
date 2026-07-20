"use client";

import { useState, useCallback, useEffect } from "react";
import type { Document, ChatMessage } from "@/lib/types";
import { uploadDocument, sendMessage, getDocuments } from "@/lib/api";
import DocumentSidebar from "@/components/DocumentSidebar";
import ChatInterface from "@/components/ChatInterface";
import PDFViewer from "@/components/PDFViewer";

export default function Home() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const selectedDoc = documents.find((d) => d.id === selectedDocId) || null;

  useEffect(() => {
    getDocuments().then(setDocuments).catch(() => {});
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    setIsUploading(true);

    const newDoc: Document = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      uploadedAt: new Date(),
      status: "processing",
    };

    setDocuments((prev) => [...prev, newDoc]);

    try {
      const result = await uploadDocument(file);

      setDocuments((prev) =>
        prev.map((d) =>
          d.id === newDoc.id
            ? { ...d, id: result.id, status: "ready", pageCount: result.pageCount }
            : d
        )
      );
    } catch {
      setDocuments((prev) =>
        prev.map((d) => (d.id === newDoc.id ? { ...d, status: "error" } : d))
      );
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleRemoveDoc = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    setSelectedDocId((prev) => (prev === id ? null : prev));
  }, []);

  const handleSend = useCallback(async (content: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const { answer, sources } = await sendMessage(content);

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: answer,
        timestamp: new Date(),
        sources,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <DocumentSidebar
        documents={documents}
        selectedDocId={selectedDocId}
        onSelectDoc={setSelectedDocId}
        onUpload={handleUpload}
        onRemoveDoc={handleRemoveDoc}
        isUploading={isUploading}
      />
      <main className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <ChatInterface
            messages={messages}
            isLoading={isLoading}
            onSend={handleSend}
          />
        </div>
        <div className="hidden w-[420px] flex-shrink-0 lg:block">
          <PDFViewer document={selectedDoc} />
        </div>
      </main>
    </div>
  );
}
