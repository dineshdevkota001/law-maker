"use client";

import { useState, useCallback, useEffect } from "react";
import type { Document, ChatMessage } from "@/lib/types";
import { uploadDocument, getDocuments, deleteDocument, sendMessage } from "@/lib/api";
import DocumentSidebar from "@/components/DocumentSidebar";
import ChatInterface from "@/components/ChatInterface";
import PDFViewer from "@/components/PDFViewer";

export default function Home() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Scope state for upload
  const [uploadLevel, setUploadLevel] = useState("global");
  const [uploadSubject, setUploadSubject] = useState("");

  // Scope state for chat queries
  const [chatLevel, setChatLevel] = useState("global");
  const [chatSubject, setChatSubject] = useState("");

  const selectedDoc = documents.find((d) => d.id === selectedDocId) || null;

  // -------------------------------------------------------------------------
  // Fetch existing documents from backend on first mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    getDocuments()
      .then((docs) => {
        setDocuments(docs);
      })
      .catch((err) => {
        console.error("getDocuments failed:", err);
      });
  }, []);

  // Reset active page when user changes selected document manually from sidebar
  const handleSelectDoc = useCallback((id: string | null) => {
    setSelectedDocId(id);
    setActivePage(null);
  }, []);
  // -------------------------------------------------------------------------
  // Upload — calls POST /api/upload_pdf for each file
  // -------------------------------------------------------------------------
  const uid = () =>
    typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const handleUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setIsUploading(true);

    const localDocs: Document[] = files.map((file) => ({
      id: `doc-${uid()}`,
      name: file.name,
      size: file.size,
      uploadedAt: new Date(),
      status: "processing" as const,
      level: "global",
      subject: "general",
      language: "en",
      url: URL.createObjectURL(file),
    }));

    setDocuments((prev) => [...prev, ...localDocs]);
    setSelectedDocId(localDocs[0].id);

    try {
      const results = await Promise.allSettled(
        files.map((file, i) =>
          uploadDocument(file, {
            level: uploadLevel as "global" | "per_subject" | "personal",
            subject: uploadSubject || undefined,
          }).then((doc) => ({
            doc: {
              ...doc,
              url: doc.url || localDocs[i].url,
            },
            localId: localDocs[i].id,
          }))
        )
      );

      setDocuments((prev) => {
        let next = [...prev];
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const localId = localDocs[i].id;
          if (result.status === "fulfilled") {
            const { doc } = result.value;
            next = next.map((d) => (d.id === localId ? doc : d));
          } else {
            next = next.map((d) =>
              d.id === localId ? { ...d, status: "ready" as const } : d
            );
          }
        }
        return next;
      });

      const firstResult = results[0];
      if (firstResult?.status === "fulfilled") {
        setSelectedDocId(firstResult.value.doc.id);
      }
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setIsUploading(false);
    }
  }, [uploadLevel, uploadSubject]);

  // -------------------------------------------------------------------------
  // Delete — calls DELETE /api/documents/{id}
  // -------------------------------------------------------------------------
  const handleRemoveDoc = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    setSelectedDocId((prev) => (prev === id ? null : prev));
    setActivePage(null);

    if (!id.startsWith("doc-")) {
      deleteDocument(id).catch((err) => {
        console.error("Failed to delete document on backend:", err);
      });
    }
  }, []);

  // -------------------------------------------------------------------------
  // Chat — calls GET /api/chat
  // -------------------------------------------------------------------------
  const handleSend = useCallback(
    async (content: string, scopeToSelected: boolean) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const { answer, sources } = await sendMessage(content, {
          documentId: scopeToSelected && selectedDocId ? selectedDocId : undefined,
          level: chatLevel,
          subject: chatSubject || undefined,
        });

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: answer,
          timestamp: new Date(),
          sources,
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        console.error("Chat error:", err);
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            err instanceof Error
              ? `Error: ${err.message}`
              : "Sorry, something went wrong. Please try again.",
          timestamp: new Date(),
          error: true,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedDocId, chatLevel, chatSubject]
  );

  // -------------------------------------------------------------------------
  // Select Citation Source — Jump to Document & Page in Viewer
  // -------------------------------------------------------------------------
  const handleSelectSource = useCallback(
    (docId: string, page: number) => {
      // Find matching document by ID or filename
      const targetDoc = documents.find(
        (d) => d.id === docId || d.name === docId
      );
      if (targetDoc) {
        setSelectedDocId(targetDoc.id);
      } else if (docId) {
        setSelectedDocId(docId);
      }
      setActivePage(page);
    },
    [documents]
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <DocumentSidebar
        documents={documents}
        selectedDocId={selectedDocId}
        onSelectDoc={handleSelectDoc}
        onUpload={handleUpload}
        onRemoveDoc={handleRemoveDoc}
        isUploading={isUploading}
        uploadLevel={uploadLevel}
        uploadSubject={uploadSubject}
        onUploadLevelChange={setUploadLevel}
        onUploadSubjectChange={setUploadSubject}
      />
      <main className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <ChatInterface
            messages={messages}
            isLoading={isLoading}
            onSend={handleSend}
            selectedDocName={selectedDoc?.name}
            onSelectSource={handleSelectSource}
            chatLevel={chatLevel}
            chatSubject={chatSubject}
            onChatLevelChange={setChatLevel}
            onChatSubjectChange={setChatSubject}
          />
        </div>
        <div className="w-[45%] flex-shrink-0">
          <PDFViewer document={selectedDoc} activePage={activePage} />
        </div>
      </main>
    </div>
  );
}
