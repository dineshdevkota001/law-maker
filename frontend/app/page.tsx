"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Document, ChatMessage, SourceChunk } from "@/lib/types";
import {
  clearChatHistory,
  getChatHistory,
  getDocuments,
  sendMessageStream,
} from "@/lib/api";
import { Drawer } from "antd";
import ChatInterface from "@/components/ChatInterface";
import PDFViewerAdvanced from "@/components/PDFViewerAdvanced";
import AppTopbar from "@/components/AppTopbar";
import {
  PREF_KEYS,
  getOrCreateStoredPreference,
  getStoredPreference,
} from "@/lib/preferences";

export default function Home() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [requestedPage, setRequestedPage] = useState<number | undefined>(
    undefined,
  );
  const [requestedPageNonce, setRequestedPageNonce] = useState(0);
  const [isSourceViewerOpen, setIsSourceViewerOpen] = useState(false);
  const [isMobileSourceViewerOpen, setIsMobileSourceViewerOpen] =
    useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [viewerWidth, setViewerWidth] = useState(42);
  const [defaultUserId, setDefaultUserId] = useState("dinesh");
  const [defaultTopic, setDefaultTopic] = useState("general");
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const isResizingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDoc = documents.find((d) => d.id === selectedDocId) || null;
  const globalCount = documents.filter((d) => d.level === "global").length;
  const perSubjectCount = documents.filter(
    (d) => d.level === "per_subject",
  ).length;
  const personalCount = documents.filter((d) => d.level === "personal").length;

  useEffect(() => {
    const userId = getStoredPreference(PREF_KEYS.userId, "dinesh");
    const topic = getStoredPreference(PREF_KEYS.defaultTopic, "general");
    const sessionId = getOrCreateStoredPreference(PREF_KEYS.chatSessionId, () =>
      crypto.randomUUID(),
    );
    setDefaultUserId(userId);
    setDefaultTopic(topic);
    setChatSessionId(sessionId);
  }, []);

  useEffect(() => {
    getDocuments()
      .then(setDocuments)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!chatSessionId) {
      return;
    }

    getChatHistory(chatSessionId)
      .then((history) => {
        const hydrated: ChatMessage[] = history.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          timestamp: new Date(message.timestamp),
          sources: message.sources,
          isStreaming: false,
        }));
        setMessages(hydrated);
      })
      .catch(() => {});
  }, [chatSessionId]);

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < 1024);
    }

    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const handleSend = useCallback(
    async (content: string) => {
      if (!chatSessionId) {
        return;
      }

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
        const { answer, sources } = await sendMessageStream(
          content,
          {
            onDelta: (delta) => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: msg.content + delta }
                    : msg,
                ),
              );
            },
          },
          { sessionId: chatSessionId },
        );

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: answer,
                  sources,
                  isStreaming: false,
                }
              : msg,
          ),
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
              : msg,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [chatSessionId],
  );

  const handleClearChat = useCallback(async () => {
    if (!chatSessionId || isLoading) {
      return;
    }
    try {
      await clearChatHistory(chatSessionId);
      setMessages([]);
    } catch {
      // Keep current messages if clear fails.
    }
  }, [chatSessionId, isLoading]);

  const handleSourceClick = useCallback(
    (source: SourceChunk) => {
      setSelectedDocId(source.documentId);
      setRequestedPage(source.page);
      setRequestedPageNonce((prev) => prev + 1);
      if (isMobile) {
        setIsMobileSourceViewerOpen(true);
      } else {
        setIsSourceViewerOpen(true);
      }
    },
    [isMobile],
  );

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
      <AppTopbar
        active="chat"
        documentCounts={{
          global: globalCount,
          perSubject: perSubjectCount,
          personal: personalCount,
        }}
      />

      <main
        ref={containerRef}
        className="mx-auto flex w-full max-w-[1600px] flex-1 overflow-hidden px-4 py-4"
      >
        <div className="flex min-w-0 flex-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div
            className="flex h-full min-w-0 flex-1 flex-col overflow-hidden"
            style={{
              width:
                !isMobile && isSourceViewerOpen
                  ? `${100 - viewerWidth}%`
                  : "100%",
            }}
          >
            {messages.length === 0 && (
              <div className="border-b border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
                  <p>Default subject: {defaultTopic}</p>
                  <p>Default user id: {defaultUserId}</p>
                  <p>Total documents available: {documents.length}</p>
                </div>
              </div>
            )}

            <ChatInterface
              messages={messages}
              isLoading={isLoading}
              onSend={handleSend}
              onClear={handleClearChat}
              onSourceClick={handleSourceClick}
            />
          </div>

          {!isMobile && isSourceViewerOpen && selectedDoc && (
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
                <PDFViewerAdvanced
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

      <Drawer
        open={isMobile && isMobileSourceViewerOpen && !!selectedDoc}
        onClose={() => setIsMobileSourceViewerOpen(false)}
        title="Source Viewer"
        placement="right"
        size="100%"
        className="lg:hidden"
        styles={{ body: { padding: 0 } }}
      >
        <div className="h-full min-h-[60vh]">
          <PDFViewerAdvanced
            key={`${selectedDocId || "none"}-${requestedPageNonce}-mobile`}
            document={selectedDoc}
            requestedPage={requestedPage}
            onClose={() => setIsMobileSourceViewerOpen(false)}
          />
        </div>
      </Drawer>
    </div>
  );
}
