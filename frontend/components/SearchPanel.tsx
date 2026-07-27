"use client";

import { useState } from "react";
import type { SourceChunk } from "@/lib/types";
import { searchChunks } from "@/lib/api";
import {
  SearchOutlined,
  LoadingOutlined,
  BookOutlined,
  FilterOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { Typography, Tag, Tooltip } from "antd";

const { Text } = Typography;

interface SearchPanelProps {
  onSelectSource?: (docId: string, page: number) => void;
}

const LEVEL_OPTIONS = [
  { value: "global", label: "Global" },
  { value: "per_subject", label: "Per Subject" },
  { value: "personal", label: "Personal" },
];

export default function SearchPanel({ onSelectSource }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SourceChunk[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [level, setLevel] = useState("global");
  const [subject, setSubject] = useState("");
  const [showScope, setShowScope] = useState(false);

  async function handleSearch() {
    const trimmed = query.trim();
    if (!trimmed || isSearching) return;
    setIsSearching(true);
    setResults([]);
    setHasSearched(true);
    try {
      const chunks = await searchChunks(trimmed, {
        level,
        subject: subject || undefined,
        limit: 15,
      });
      setResults(chunks);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-900 dark:[&_.ant-typography]:!text-zinc-100 dark:[&_.ant-typography-secondary]:!text-zinc-400">
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <SearchOutlined className="text-blue-600 text-lg" />
          <Text strong className="text-sm dark:text-zinc-100">
            Document Search
          </Text>
        </div>
        <button
          onClick={() => setShowScope(!showScope)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all border ${
            showScope
              ? "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
              : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          <FilterOutlined />
          <span>Scope</span>
        </button>
      </div>

      {showScope && (
        <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50/50 px-6 py-2 dark:border-zinc-800 dark:bg-zinc-800/30">
          <Text type="secondary" className="text-xs shrink-0 dark:text-zinc-400">Level:</Text>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <Text type="secondary" className="text-xs shrink-0 dark:text-zinc-400">Subject:</Text>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (optional)"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs placeholder-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          />
        </div>
      )}

      <div className="border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search across all documents..."
            className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-blue-600"
          />
          <button
            onClick={handleSearch}
            disabled={!query.trim() || isSearching}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-blue-700 active:scale-98 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
          >
            {isSearching ? <LoadingOutlined /> : "Search"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!hasSearched && !isSearching && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center max-w-md mx-auto">
            <div className="rounded-2xl bg-blue-50 p-4 dark:bg-blue-950/30 text-blue-600">
              <SearchOutlined className="text-4xl" />
            </div>
            <div>
              <Text className="text-lg font-semibold text-zinc-800 dark:text-zinc-100 block">
                Hybrid Vector & Lexical Search
              </Text>
              <Text type="secondary" className="text-sm mt-1 block dark:text-zinc-400">
                Search for specific clauses, sections, or legal language across all indexed documents.
              </Text>
            </div>
            <div className="w-full flex flex-col gap-2">
              <Text type="secondary" className="text-xs font-medium uppercase tracking-wider text-left block px-1 dark:text-zinc-400">
                <ThunderboltOutlined className="mr-1 text-amber-500" /> Example searches
              </Text>
              {[
                "fundamental rights",
                "tax exemption provisions",
                "criminal procedure section",
              ].map((ex, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(ex); setTimeout(() => handleSearch(), 0); }}
                  className="w-full text-left rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-xs text-zinc-700 transition-all hover:border-blue-400 hover:bg-blue-50/40 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-300 dark:hover:border-blue-600"
                >
                  &ldquo;{ex}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}

        {hasSearched && !isSearching && results.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <SearchOutlined className="text-3xl text-zinc-300 dark:text-zinc-600 mb-2" />
              <Text type="secondary" className="text-sm block dark:text-zinc-400">No results found for this query.</Text>
              <Text type="secondary" className="text-xs mt-1 block dark:text-zinc-400">Try different keywords or adjust scope filters.</Text>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="flex flex-col gap-3">
            <Text type="secondary" className="text-xs font-medium dark:text-zinc-400">
              {results.length} result{results.length !== 1 ? "s" : ""}
            </Text>
            {results.map((chunk, idx) => (
              <SearchResultCard key={`${chunk.chunkId}-${idx}`} chunk={chunk} onSelectSource={onSelectSource} />
            ))}
          </div>
        )}

        {isSearching && (
          <div className="flex items-center justify-center gap-2 py-16">
            <LoadingOutlined className="text-blue-600 text-lg" />
            <Text type="secondary" className="text-sm dark:text-zinc-400">Searching document chunks...</Text>
          </div>
        )}
      </div>
    </div>
  );
}

function SearchResultCard({
  chunk,
  onSelectSource,
}: {
  chunk: SourceChunk;
  onSelectSource?: (docId: string, page: number) => void;
}) {
  const percent = Math.round(chunk.score * 100);

  return (
    <button
      onClick={() => onSelectSource?.(chunk.documentId, chunk.page)}
      className="w-full text-left rounded-lg border border-zinc-200 bg-white p-3.5 transition-all hover:border-blue-400 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-800/60 dark:hover:border-blue-600"
    >
      <div className="flex items-center gap-2 mb-2">
        <BookOutlined className="text-blue-500 text-xs" />
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">
          {chunk.documentName}
        </span>
        <Tag color="blue" className="!mr-0 text-[10px] font-normal leading-none">
          p.{chunk.page}
        </Tag>
        {chunk.clauseHeading && (
          <Tag color="purple" className="!mr-0 text-[10px] font-normal leading-none">
            {chunk.clauseHeading}
          </Tag>
        )}
        <Tooltip title={`Vector match similarity: ${percent}%`}>
          <span className="ml-auto text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            {percent}%
          </span>
        </Tooltip>
      </div>
      <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 line-clamp-3">
        {chunk.text}
      </p>
      {chunk.pageStart !== chunk.pageEnd && (
        <div className="mt-1.5 flex items-center gap-1">
          <SafetyCertificateOutlined className="text-[10px] text-zinc-400" />
          <Text type="secondary" className="text-[10px] dark:text-zinc-400">
            Pages {chunk.pageStart}–{chunk.pageEnd}
          </Text>
        </div>
      )}
    </button>
  );
}
