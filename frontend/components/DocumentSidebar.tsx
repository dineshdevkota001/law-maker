"use client";

import type { Document } from "@/lib/types";
import {
  FileTextOutlined,
  DeleteOutlined,
  InboxOutlined,
  LoadingOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Tooltip, Progress, Typography } from "antd";
import PDFUpload from "./PDFUpload";

const { Text } = Typography;

const LANGUAGE_LABELS: Record<string, string> = {
  ne: "Nepali",
  en: "English",
  hi: "Hindi",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentSidebarProps {
  documents: Document[];
  selectedDocId: string | null;
  onSelectDoc: (id: string | null) => void;
  onUpload: (files: File[]) => void;
  onRemoveDoc: (id: string) => void;
  onRefreshDoc?: (id: string) => void;
  isUploading: boolean;
  isLoadingDocs?: boolean;
  docsError?: string | null;
  uploadLevel?: string;
  uploadSubject?: string;
  onUploadLevelChange?: (level: string) => void;
  onUploadSubjectChange?: (subject: string) => void;
}

export default function DocumentSidebar({
  documents,
  selectedDocId,
  onSelectDoc,
  onUpload,
  onRemoveDoc,
  onRefreshDoc,
  isUploading,
  isLoadingDocs,
  docsError,
  uploadLevel = "global",
  uploadSubject = "",
  onUploadLevelChange,
  onUploadSubjectChange,
}: DocumentSidebarProps) {

  return (
    <aside className="flex h-full w-72 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:[&_.ant-typography]:!text-zinc-100 dark:[&_.ant-typography-secondary]:!text-zinc-400">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <FileTextOutlined className="text-base text-blue-600" />
        <Text strong className="text-sm">
          Documents
        </Text>
        <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          {documents.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {docsError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-950/30">
            <Text type="danger" className="text-xs">
              {docsError}
            </Text>
          </div>
        )}

        {documents.length == 0 && isLoadingDocs && !docsError && (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-zinc-400">
            <LoadingOutlined className="text-3xl" />
            <Text type="secondary" className="text-xs">
              Loading documents...
            </Text>
          </div>
        )}

        {documents.length === 0 && !isLoadingDocs && isUploading && (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-blue-600 dark:text-blue-400">
            <LoadingOutlined className="text-3xl" />
            <Text type="secondary" className="text-xs">
              Uploading & processing PDF...
            </Text>
          </div>
        )}

        {documents.length === 0 && !isLoadingDocs && !isUploading && (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-zinc-400">
            <InboxOutlined className="text-4xl" />
            <div>
              <Text type="secondary" className="text-xs">
                No documents uploaded yet
              </Text>
              <br />
              <Text type="secondary" className="text-xs">
                Upload a PDF to get started
              </Text>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className={`group flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 transition-all ${selectedDocId === doc.id
                ? "border-l-2 border-blue-500 bg-blue-50 pl-2.5 dark:bg-blue-950/30"
                : "border-l-2 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              onClick={() => onSelectDoc(doc.id)}
            >
              <FileTextOutlined
                className={`mt-0.5 text-lg ${doc.status === "ready"
                  ? "text-green-600"
                  : doc.status === "processing"
                    ? "text-amber-500"
                    : "text-red-500"
                  }`}
              />
              <div className="min-w-0 flex-1">
                <Text
                  className="block truncate text-sm font-medium"
                  ellipsis={{ tooltip: doc.name }}
                >
                  {doc.name}
                </Text>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <Text type="secondary" className="text-xs">
                    {formatSize(doc.size)}
                  </Text>
                  {doc.pageCount && (
                    <>
                      <span className="text-zinc-300 dark:text-zinc-600">·</span>
                      <Text type="secondary" className="text-xs">
                        {doc.pageCount}p
                      </Text>
                    </>
                  )}
                  {doc.language && (
                    <>
                      <span className="text-zinc-300 dark:text-zinc-600">·</span>
                      <span className="rounded bg-zinc-200/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-700/60 dark:text-zinc-400">
                        {LANGUAGE_LABELS[doc.language] ?? doc.language}
                      </span>
                    </>
                  )}
                </div>
                {doc.status === "processing" && (
                  <Progress
                    size="small"
                    status="active"
                    showInfo={false}
                    className="mt-1"
                  />
                )}
                {doc.status === "error" && (
                  <Text type="danger" className="text-xs">
                    Processing failed
                  </Text>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip title="Refresh document metadata">
                  <Button
                    type="text"
                    size="small"
                    icon={<ReloadOutlined />}
                    className="!opacity-0 group-hover:!opacity-100 text-zinc-400"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onRefreshDoc?.(doc.id);
                    }}
                  />
                </Tooltip>
                <Tooltip title="Remove document">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    className="!opacity-0 group-hover:!opacity-100"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onRemoveDoc(doc.id);
                    }}
                  />
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <PDFUpload
          onUpload={onUpload}
          isUploading={isUploading}
          level={uploadLevel}
          subject={uploadSubject}
          onLevelChange={onUploadLevelChange ?? (() => { })}
          onSubjectChange={onUploadSubjectChange ?? (() => { })}
        />
      </div>
    </aside>
  );
}
