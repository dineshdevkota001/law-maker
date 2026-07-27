"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage as ChatMessageType, SourceChunk } from "@/lib/types";
import {
  UserOutlined,
  RobotOutlined,
  BookOutlined,
  LoadingOutlined,
  FilterOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Typography, Tag, Tooltip } from "antd";

const { Text } = Typography;

const SAMPLE_PROMPTS = [
  "What is the main objective of this legal document?",
  "List key clauses and obligations defined in the text.",
  "Summarize Section 1 and relevant definitions.",
];

function SourceBadge({
  source,
  onSelectSource,
}: {
  source: SourceChunk;
  onSelectSource?: (docId: string, page: number) => void;
}) {
  const percent = Math.round(source.score * 100);

  return (
    <button
      onClick={() => onSelectSource?.(source.documentId, source.page)}
      className="group inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs transition-all hover:border-blue-500 hover:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-blue-500 dark:hover:bg-blue-950/40"
    >
      <BookOutlined className="text-blue-500 group-hover:scale-110 transition-transform" />
      <span className="font-medium text-zinc-700 dark:text-zinc-200">
        {source.documentName}
      </span>
      <Tag color="blue" className="!mr-0 font-normal">
        p.{source.page}
      </Tag>
      {source.clauseHeading && (
        <span className="max-w-[120px] truncate text-zinc-400 dark:text-zinc-500">
          ({source.clauseHeading})
        </span>
      )}
      <Tooltip title={`Vector match similarity: ${percent}%`}>
        <span className="ml-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
          {percent}%
        </span>
      </Tooltip>
    </button>
  );
}

function ChatBubble({
  message,
  onSelectSource,
}: {
  message: ChatMessageType;
  onSelectSource?: (docId: string, page: number) => void;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
          isUser
            ? "bg-blue-600 shadow-sm"
            : message.error
            ? "bg-red-500"
            : "bg-zinc-800 dark:bg-zinc-700"
        }`}
      >
        {isUser ? <UserOutlined /> : <RobotOutlined />}
      </div>

      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white shadow-sm"
            : message.error
            ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300 border border-red-200 dark:border-red-900/50"
            : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 shadow-xs"
        }`}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>

        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 border-t border-zinc-200/40 pt-2.5 dark:border-zinc-700/50">
            <div className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              <SafetyCertificateOutlined className="text-blue-500" />
              <span>Cited Legal Sources (click to jump in viewer):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {message.sources.map((source, idx) => (
                <SourceBadge
                  key={`${source.chunkId}-${idx}`}
                  source={source}
                  onSelectSource={onSelectSource}
                />
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
  onSend: (message: string, scopeToDoc: boolean) => void;
  selectedDocName?: string | null;
  onSelectSource?: (docId: string, page: number) => void;
  /** Current level scope for chat queries */
  chatLevel?: string;
  /** Current subject scope for chat queries */
  chatSubject?: string;
  onChatLevelChange?: (level: string) => void;
  onChatSubjectChange?: (subject: string) => void;
}

const LEVEL_OPTIONS = [
  { value: "global", label: "Global" },
  { value: "per_subject", label: "Per Subject" },
  { value: "personal", label: "Personal" },
];

export default function ChatInterface({
  messages,
  isLoading,
  onSend,
  selectedDocName,
  onSelectSource,
  chatLevel = "global",
  chatSubject = "",
  onChatLevelChange,
  onChatSubjectChange,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [scopeToSelected, setScopeToSelected] = useState(false);
  const [showScopeConfig, setShowScopeConfig] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  function handleSubmit(overrideText?: string) {
    const textToSend = overrideText ?? input;
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed, scopeToSelected && !!selectedDocName);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-900">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <RobotOutlined className="text-blue-600 text-lg" />
          <Text strong className="text-sm">
            Legal RAG Assistant
          </Text>
        </div>

        <div className="flex items-center gap-2">
          {/* Scope config toggle */}
          <button
            onClick={() => setShowScopeConfig(!showScopeConfig)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all border ${
              showScopeConfig
                ? "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            <FilterOutlined />
            <span>Scope</span>
          </button>

          {selectedDocName && (
            <button
              onClick={() => setScopeToSelected(!scopeToSelected)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all border ${
                scopeToSelected
                  ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                  : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              <span>
                {scopeToSelected
                  ? `Doc: ${selectedDocName}`
                  : "Search: All Docs"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Scope configuration panel */}
      {showScopeConfig && (
        <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50/50 px-6 py-2 dark:border-zinc-800 dark:bg-zinc-800/30">
          <Text type="secondary" className="text-xs shrink-0">
            Level:
          </Text>
          <select
            value={chatLevel}
            onChange={(e) => onChatLevelChange?.(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Text type="secondary" className="text-xs shrink-0">
            Subject:
          </Text>
          <input
            type="text"
            value={chatSubject}
            onChange={(e) => onChatSubjectChange?.(e.target.value)}
            placeholder="Subject (optional)"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs placeholder-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          />
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 && !isLoading && (
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center max-w-md mx-auto">
            <div className="rounded-2xl bg-blue-50 p-4 dark:bg-blue-950/30 text-blue-600">
              <RobotOutlined className="text-4xl" />
            </div>
            <div>
              <Text className="text-lg font-semibold text-zinc-800 dark:text-zinc-100 block">
                Nepal Legal Document Intelligence
              </Text>
              <Text type="secondary" className="text-sm mt-1 block">
                Ask questions about indexed legal statutes, acts, or uploaded PDF documents.
              </Text>
            </div>

            {/* Quick starter prompts */}
            <div className="w-full flex flex-col gap-2">
              <Text type="secondary" className="text-xs font-medium uppercase tracking-wider text-left block px-1">
                <ThunderboltOutlined className="mr-1 text-amber-500" /> Suggested Queries
              </Text>
              {SAMPLE_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSubmit(prompt)}
                  className="w-full text-left rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-xs text-zinc-700 transition-all hover:border-blue-400 hover:bg-blue-50/40 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-300 dark:hover:border-blue-600"
                >
                  "{prompt}"
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              message={msg}
              onSelectSource={onSelectSource}
            />
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs text-white dark:bg-zinc-700">
                <RobotOutlined />
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
                <LoadingOutlined className="text-blue-600" />
                <Text type="secondary" className="text-sm">
                  Performing hybrid vector & lexical retrieval...
                </Text>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-2xl gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              scopeToSelected && selectedDocName
                ? `Ask about ${selectedDocName}...`
                : "Ask a question about your legal documents..."
            }
            rows={1}
            className="flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-blue-600"
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isLoading}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-all hover:bg-blue-700 active:scale-98 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
