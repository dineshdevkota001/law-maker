"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage as ChatMessageType, SourceChunk } from "@/lib/types";
import {
  UserOutlined,
  RobotOutlined,
  PaperClipOutlined,
  LoadingOutlined,
  CopyOutlined,
  CheckOutlined,
  DeleteOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { Modal, Tag, Typography } from "antd";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const { Text } = Typography;

function getSourceIndexFromHref(href: string | undefined): number | null {
  if (!href) {
    return null;
  }

  const match = href.match(/#source-(\d+)/i) || href.match(/source:\/\/(\d+)/i);
  if (!match) {
    return null;
  }

  const index = Number(match[1]);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

function toInlineCitationMarkdown(
  content: string,
  sources: SourceChunk[] | undefined,
): string {
  if (!sources || sources.length === 0) {
    return content;
  }

  return content.replace(/\[(\d+)\]/g, (full, rawIndex) => {
    const index = Number(rawIndex) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= sources.length) {
      return full;
    }
    return `[${rawIndex}](#source-${index})`;
  });
}

function hasInlineCitations(
  content: string,
  sources: SourceChunk[] | undefined,
): boolean {
  if (!sources || sources.length === 0) {
    return false;
  }
  return /\[(\d+)\]/.test(content);
}

function cleanMessageForCopy(content: string): string {
  return content
    .replace(/\[(\d+)\]\(#source-\d+\)/g, "")
    .replace(/\[(\d+)\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ChatBubble({
  message,
  onSourceClick,
}: {
  message: ChatMessageType;
  onSourceClick?: (source: SourceChunk) => void;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const markdownWithCitations = toInlineCitationMarkdown(
    message.content,
    message.sources,
  );
  const showBottomSources = !hasInlineCitations(
    message.content,
    message.sources,
  );

  async function handleCopy() {
    const cleaned = cleanMessageForCopy(message.content);
    if (!cleaned) {
      return;
    }

    try {
      await navigator.clipboard.writeText(cleaned);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Ignore clipboard permission/runtime failures silently.
    }
  }

  return (
    <div className={`flex gap-4 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${
          isUser ? "bg-blue-600" : "bg-zinc-700 dark:bg-zinc-600"
        }`}
      >
        {isUser ? <UserOutlined /> : <RobotOutlined />}
      </div>

      <div
        className={`max-w-[82%] rounded-3xl px-5 py-4 text-base leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
        }`}
      >
        {!isUser && !!message.content && (
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
              title="Copy answer without citations"
            >
              {copied ? <CheckOutlined /> : <CopyOutlined />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}

        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="space-y-2">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc space-y-1.5 pl-6">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal space-y-1.5 pl-6">{children}</ol>
                ),
                li: ({ children }) => <li>{children}</li>,
                code: ({ children }) => (
                  <code className="rounded bg-zinc-200/80 px-1 py-0.5 text-xs dark:bg-zinc-700/90">
                    {children}
                  </code>
                ),
                a: ({ href, children }) => {
                  const index = getSourceIndexFromHref(href);
                  if (index !== null) {
                    const source =
                      message.sources && index < message.sources.length
                        ? message.sources[index]
                        : undefined;

                    if (!source) {
                      return null;
                    }

                    return (
                      <sup className="mx-0.5 align-super">
                        <Tag
                          className="cursor-pointer select-none !rounded-full !border-zinc-300 !bg-zinc-200/90 !px-1.5 !py-0 !text-[10px] !font-medium !leading-4 !text-zinc-700 hover:!bg-zinc-300 dark:!border-zinc-600 dark:!bg-zinc-700/90 dark:!text-zinc-100 dark:hover:!bg-zinc-600"
                          title={`Source ${index + 1}, page ${source.page}`}
                          onClick={() => onSourceClick?.(source)}
                        >
                          {`${index + 1}·p${source.page}`}
                        </Tag>
                      </sup>
                    );
                  }

                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {children}
                    </a>
                  );
                },
              }}
            >
              {markdownWithCitations}
            </ReactMarkdown>
            {message.isStreaming && !message.content && (
              <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                <LoadingOutlined />
                <span className="text-xs">Streaming response...</span>
              </div>
            )}
          </div>
        )}

        {showBottomSources && message.sources && message.sources.length > 0 && (
          <div className="mt-3 border-t border-zinc-200/20 pt-2 dark:border-zinc-600/30">
            <Text
              className={`mb-2 block text-xs ${
                isUser ? "text-blue-100" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <PaperClipOutlined className="mr-1" />
              Sources
            </Text>
            <div className="flex flex-col gap-1.5">
              {message.sources.map((source) => (
                <div
                  key={source.chunkId}
                  className="flex items-center justify-between gap-2 rounded-md bg-zinc-200/40 px-2 py-1.5 text-xs dark:bg-zinc-700/40"
                >
                  <button
                    type="button"
                    onClick={() => onSourceClick?.(source)}
                    className="w-full truncate text-left underline"
                    title={`Open ${source.documentName} page ${source.page}`}
                  >
                    {`${source.documentName} (p.${source.page})`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ChatInterfaceProps {
  messages: ChatMessageType[];
  isLoading: boolean;
  onSend: (message: string) => void;
  onClear?: () => void;
  onSourceClick?: (source: SourceChunk) => void;
}

export default function ChatInterface({
  messages,
  isLoading,
  onSend,
  onClear,
  onSourceClick,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function openClearConfirmation() {
    if (isLoading || messages.length === 0) {
      return;
    }
    setIsClearConfirmOpen(true);
  }

  function closeClearConfirmation() {
    setIsClearConfirmOpen(false);
  }

  function confirmClearChat() {
    onClear?.();
    setIsClearConfirmOpen(false);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-4xl justify-end">
          <button
            type="button"
            onClick={openClearConfirmation}
            disabled={isLoading || messages.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            title="Clear this browser chat history"
          >
            <DeleteOutlined />
            Clear chat
          </button>
        </div>
      </div>

      <Modal
        title="Clear chat history"
        open={isClearConfirmOpen}
        onOk={confirmClearChat}
        onCancel={closeClearConfirmation}
        okText="Clear"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
      >
        <p>
          This will permanently delete this browser&apos;s conversation history.
        </p>
      </Modal>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <RobotOutlined className="text-6xl text-zinc-300 dark:text-zinc-600" />
            <div>
              <Text className="text-xl font-semibold text-zinc-500 dark:text-zinc-400">
                Legal Document Assistant
              </Text>
              <br />
              <Text type="secondary" className="text-base">
                Upload PDFs and ask questions about your documents
              </Text>
            </div>
          </div>
        )}

        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              message={msg}
              onSourceClick={onSourceClick}
            />
          ))}

          {isLoading && !messages.some((m) => m.isStreaming) && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs text-white dark:bg-zinc-600">
                <RobotOutlined />
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
                <LoadingOutlined className="text-zinc-400" />
                <Text type="secondary" className="text-sm">
                  Thinking...
                </Text>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex w-full max-w-4xl gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your documents..."
            rows={1}
            style={{
              fieldSizing: "content",
            }}
            className="flex-1 max-h-24 rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-base outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-blue-600"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            title="Send message"
          >
            <SendOutlined />
          </button>
        </div>
      </div>
    </div>
  );
}
