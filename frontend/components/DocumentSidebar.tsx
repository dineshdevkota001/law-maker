"use client";

import type { Document } from "@/lib/types";
import {
  FileTextOutlined,
  DeleteOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import { Button, Tooltip, Progress, Typography } from "antd";
import PDFUpload from "./PDFUpload";

const { Text } = Typography;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentSidebarProps {
  documents: Document[];
  selectedDocId: string | null;
  onSelectDoc: (id: string | null) => void;
  onUpload: (file: File) => void;
  onRemoveDoc: (id: string) => void;
  isUploading: boolean;
}

export default function DocumentSidebar({
  documents,
  selectedDocId,
  onSelectDoc,
  onUpload,
  onRemoveDoc,
  isUploading,
}: DocumentSidebarProps) {
  return (
    <aside className="flex h-full w-72 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
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
        {documents.length === 0 && !isUploading && (
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
              className={`group flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 transition-colors ${
                selectedDocId === doc.id
                  ? "bg-blue-50 dark:bg-blue-950/30"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
              onClick={() => onSelectDoc(doc.id)}
            >
              <FileTextOutlined
                className={`mt-0.5 text-lg ${
                  doc.status === "ready"
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
                <div className="mt-0.5 flex items-center gap-2">
                  <Text type="secondary" className="text-xs">
                    {formatSize(doc.size)}
                  </Text>
                  {doc.pageCount && (
                    <>
                      <span className="text-zinc-300 dark:text-zinc-600">
                        ·
                      </span>
                      <Text type="secondary" className="text-xs">
                        {doc.pageCount} pages
                      </Text>
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
          ))}
        </div>
      </div>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <PDFUpload onUpload={onUpload} isUploading={isUploading} />
      </div>
    </aside>
  );
}
