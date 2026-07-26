"use client";

import { useState, useCallback, useEffect } from "react";
import type { Document, ChatMessage, SourceChunk } from "@/lib/types";
import { uploadDocument, sendMessageStream, getDocuments } from "@/lib/api";
import DocumentSidebar from "@/components/DocumentSidebar";
import ChatInterface from "@/components/ChatInterface";
import PDFViewer from "@/components/PDFViewer";

export default function Home() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [requestedPage, setRequestedPage] = useState<number | undefined>(
    undefined
  );
  const [requestedPageNonce, setRequestedPageNonce] = useState(0);

  const selectedDoc = documents.find((d) => d.id === selectedDocId) || null;

  useEffect(() => {
    getDocuments()
      .then(setDocuments)
      .catch(() => {});
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    setIsUploading(true);

    const newDoc: Document = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      status: "processing",
      level: "global",
      subject: "general",
      userId: null,
      language: "unknown",
      sourceFileUrl: null,
    };

    setDocuments((prev) => [...prev, newDoc]);

    try {
      const result = await uploadDocument(file);

      setDocuments((prev) =>
        prev.map((d) =>
          d.id === newDoc.id
            ? {
                ...d,
                ...result,
                status: "ready",
                pageCount: result.pageCount,
                sourceFileUrl: result.sourceFileUrl,
              }
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
    const assistantMessageId = crypto.randomUUID();
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      sources: [],
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setIsLoading(true);

    try {
      const { answer, sources } = await sendMessageStream(content, {
        onDelta: (delta) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + delta }
                : msg
            )
          );
        },
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: answer,
                sources,
                isStreaming: false,
              }
            : msg
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: "Sorry, something went wrong. Please try again.",
                isStreaming: false,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSourceClick = useCallback((source: SourceChunk) => {
    setSelectedDocId(source.documentId);
    setRequestedPage(source.page);
    setRequestedPageNonce((prev) => prev + 1);
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
            onSourceClick={handleSourceClick}
          />
        </div>
        <div className="hidden w-[420px] flex-shrink-0 lg:block">
          <PDFViewer
            key={`${selectedDocId || "none"}-${requestedPageNonce}`}
            document={selectedDoc}
            requestedPage={requestedPage}
          />
        </div>
      </main>
    </div>
  );
}
