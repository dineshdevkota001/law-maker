"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import {
  UserOutlined,
  RobotOutlined,
  PaperClipOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { Typography } from "antd";

const { Text } = Typography;

function ChatBubble({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-3 ${
        isUser ? "flex-row-reverse" : ""
      }`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
          isUser
            ? "bg-blue-600"
            : "bg-zinc-700 dark:bg-zinc-600"
        }`}
      >
        {isUser ? <UserOutlined /> : <RobotOutlined />}
      </div>

      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
        }`}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>

        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 border-t border-zinc-200/20 pt-2 dark:border-zinc-600/30">
            <Text
              className={`text-xs ${
                isUser ? "text-blue-100" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <PaperClipOutlined className="mr-1" />
              Sources:{" "}
              {message.sources
                .map((s) => `${s.documentName} (p.${s.page})`)
                .join(", ")}
            </Text>
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
}

export default function ChatInterface({
  messages,
  isLoading,
  onSend,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <RobotOutlined className="text-5xl text-zinc-300 dark:text-zinc-600" />
            <div>
              <Text className="text-base font-medium text-zinc-500 dark:text-zinc-400">
                Legal Document Assistant
              </Text>
              <br />
              <Text type="secondary" className="text-sm">
                Upload PDFs and ask questions about your documents
              </Text>
            </div>
          </div>
        )}

        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}

          {isLoading && (
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
        <div className="mx-auto flex max-w-2xl gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your documents..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-blue-600"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
