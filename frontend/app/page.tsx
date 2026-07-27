"use client";

import { useState, useCallback, useEffect } from "react";
import type { Document, ChatMessage } from "@/lib/types";
import { uploadDocument, getDocuments, deleteDocument, sendMessage, getDocument } from "@/lib/api";
import DocumentSidebar from "@/components/DocumentSidebar";
import ChatInterface from "@/components/ChatInterface";
import SearchPanel from "@/components/SearchPanel";
import PDFViewer from "@/components/PDFViewer";
import { CommentOutlined, SearchOutlined } from "@ant-design/icons";

export default function Home() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);

  // Scope state for upload
  const [uploadLevel, setUploadLevel] = useState("global");
  const [uploadSubject, setUploadSubject] = useState("");

  // Scope state for chat queries
  const [chatLevel, setChatLevel] = useState("global");
  const [chatSubject, setChatSubject] = useState("");

  const [viewMode, setViewMode] = useState<"chat" | "search">("chat");

  const selectedDoc = documents.find((d) => d.id === selectedDocId) || null;

  // -------------------------------------------------------------------------
  // Fetch existing documents from backend on first mount (with retries)
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let retries = 0;
    const maxRetries = 3;

    const fetchDocs = async () => {
      try {
        const docs = await getDocuments();
        if (!cancelled) {
          setDocuments(docs);
          setDocsError(null);
        }
      } catch (err) {
        if (!cancelled) {
          if (retries < maxRetries) {
            retries++;
            await new Promise((r) => setTimeout(r, 2000));
            return fetchDocs();
          }
          setDocsError(
            err instanceof Error
              ? err.message
              : "Failed to load documents"
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDocs(false);
        }
      }
    };

    fetchDocs();
    return () => { cancelled = true; };
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
        id: uid(),
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
          id: uid(),
          role: "assistant",
          content: answer,
          timestamp: new Date(),
          sources,
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        console.error("Chat error:", err);
        const errorMsg: ChatMessage = {
          id: uid(),
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

  const handleRefreshDoc = useCallback(async (id: string) => {
    try {
      const updated = await getDocument(id);
      setDocuments((prev) =>
        prev.map((d) => (d.id === id ? updated : d))
      );
    } catch (err) {
      console.error("Failed to refresh document:", err);
    }
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <DocumentSidebar
        documents={documents}
        selectedDocId={selectedDocId}
        onSelectDoc={handleSelectDoc}
        onUpload={handleUpload}
        onRemoveDoc={handleRemoveDoc}
        onRefreshDoc={handleRefreshDoc}
        isUploading={isUploading}
        uploadLevel={uploadLevel}
        uploadSubject={uploadSubject}
        onUploadLevelChange={setUploadLevel}
        onUploadSubjectChange={setUploadSubject}
        isLoadingDocs={isLoadingDocs}
        docsError={docsError}
      />
      <main className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-0 border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-900">
            {[
              { key: "chat" as const, label: "Chat", icon: CommentOutlined },
              { key: "search" as const, label: "Search", icon: SearchOutlined },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setViewMode(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                  viewMode === tab.key
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                <tab.icon className="text-sm" />
                {tab.label}
              </button>
            ))}
          </div>
          {viewMode === "chat" ? (
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
          ) : (
            <SearchPanel onSelectSource={handleSelectSource} />
          )}
        </div>
        <div className="w-[45%] flex-shrink-0">
          <PDFViewer document={selectedDoc} activePage={activePage} />
        </div>
      </main>
    </div>
  );
}
