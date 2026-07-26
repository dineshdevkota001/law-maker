"use client";

import type { Document } from "@/lib/types";
import { FileTextOutlined, InboxOutlined } from "@ant-design/icons";
import { Progress, Tag, Typography } from "antd";

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
}

export default function DocumentSidebar({
  documents,
  selectedDocId,
  onSelectDoc,
}: DocumentSidebarProps) {
  return (
    <aside className="flex h-full w-88 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <FileTextOutlined className="text-xl text-blue-600" />
        <Text strong className="text-base">
          Documents
        </Text>
        <span className="ml-auto rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          {documents.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {documents.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-14 text-center text-zinc-400">
            <InboxOutlined className="text-4xl" />
            <div>
              <Text type="secondary" className="text-sm">
                No documents available yet
              </Text>
              <br />
              <Text type="secondary" className="text-sm">
                Manage uploads in Settings
              </Text>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className={`group flex cursor-pointer items-start gap-3 rounded-xl px-4 py-3 transition-colors ${
                selectedDocId === doc.id
                  ? "bg-blue-50 dark:bg-blue-950/30"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
              onClick={() => onSelectDoc(doc.id)}
            >
              <FileTextOutlined
                className={`mt-0.5 text-xl ${
                  doc.status === "ready"
                    ? "text-green-600"
                    : doc.status === "processing"
                    ? "text-amber-500"
                    : "text-red-500"
                }`}
              />
              <div className="min-w-0 flex-1">
                <Text
                  className="block truncate text-base font-semibold"
                  ellipsis={{ tooltip: doc.name }}
                >
                  {doc.name}
                </Text>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Text type="secondary" className="text-sm">
                    {formatSize(doc.size)}
                  </Text>
                  {doc.pageCount && (
                    <>
                      <span className="text-zinc-300 dark:text-zinc-600">
                        ·
                      </span>
                      <Text type="secondary" className="text-sm">
                        {doc.pageCount} pages
                      </Text>
                    </>
                  )}
                  <Tag className="!mr-0 capitalize">
                    {doc.level.replace("_", " ")}
                  </Tag>
                  {doc.level === "per_subject" && doc.subject && (
                    <Tag className="!mr-0" color="processing">
                      {doc.subject}
                    </Tag>
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
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
