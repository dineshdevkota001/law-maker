"use client";

import Link from "next/link";
import { useState, useCallback, useEffect, useRef } from "react";
import type { Document, ChatMessage, SourceChunk } from "@/lib/types";
import { sendMessageStream, getDocuments } from "@/lib/api";
import { MessageOutlined, SettingOutlined } from "@ant-design/icons";
import DocumentSidebar from "@/components/DocumentSidebar";
import ChatInterface from "@/components/ChatInterface";
import PDFViewer from "@/components/PDFViewer";

export default function Home() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [requestedPage, setRequestedPage] = useState<number | undefined>(
    undefined
  );
  const [requestedPageNonce, setRequestedPageNonce] = useState(0);
  const [isSourceViewerOpen, setIsSourceViewerOpen] = useState(false);
  const [viewerWidth, setViewerWidth] = useState(42);
  const isResizingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDoc = documents.find((d) => d.id === selectedDocId) || null;

  useEffect(() => {
    getDocuments()
      .then(setDocuments)
      .catch(() => {});
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
    setIsSourceViewerOpen(true);
  }, []);

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      if (!isResizingRef.current || !containerRef.current) {
        return;
      }
      const bounds = containerRef.current.getBoundingClientRect();
      const newViewerPercent =
        ((bounds.right - event.clientX) / bounds.width) * 100;
      const clamped = Math.min(62, Math.max(28, newViewerPercent));
      setViewerWidth(clamped);
    }

    function stopResize() {
      isResizingRef.current = false;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopResize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopResize);
    };
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--surface-app)]">
      <header className="border-b border-zinc-200/80 bg-white/80 px-6 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Law Maker Workspace
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Chat with cited legal context and inspect sources side by side.
            </p>
          </div>
          <nav className="flex items-center gap-2 rounded-2xl bg-zinc-100 p-1.5 dark:bg-zinc-900">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
            >
              <MessageOutlined /> Chat
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <SettingOutlined /> Settings
            </Link>
          </nav>
        </div>
      </header>

      <main
        ref={containerRef}
        className="mx-auto flex w-full max-w-[1600px] flex-1 overflow-hidden px-4 py-4"
      >
        <DocumentSidebar
          documents={documents}
          selectedDocId={selectedDocId}
          onSelectDoc={setSelectedDocId}
        />

        <div className="ml-4 flex min-w-0 flex-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div
            className="flex h-full min-w-0 flex-col overflow-hidden"
            style={{
              width: isSourceViewerOpen ? `${100 - viewerWidth}%` : "100%",
            }}
          >
            <ChatInterface
              messages={messages}
              isLoading={isLoading}
              onSend={handleSend}
              onSourceClick={handleSourceClick}
            />
          </div>

          {isSourceViewerOpen && selectedDoc && (
            <>
              <div
                className="w-2 cursor-col-resize bg-zinc-100 transition hover:bg-blue-100 dark:bg-zinc-800 dark:hover:bg-blue-900/40"
                onMouseDown={() => {
                  isResizingRef.current = true;
                }}
                title="Drag to resize"
              />
              <div
                className="h-full min-w-[380px] overflow-hidden"
                style={{ width: `${viewerWidth}%` }}
              >
                <PDFViewer
                  key={`${selectedDocId || "none"}-${requestedPageNonce}`}
                  document={selectedDoc}
                  requestedPage={requestedPage}
                  onClose={() => setIsSourceViewerOpen(false)}
                />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
