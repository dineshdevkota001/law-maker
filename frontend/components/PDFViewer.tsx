"use client";

import { useState } from "react";
import type { Document } from "@/lib/types";
import { FileTextOutlined, LoadingOutlined, ReloadOutlined, BookOutlined } from "@ant-design/icons";
import { Button, Typography, Empty, Tag } from "antd";

const { Text } = Typography;

interface PDFViewerProps {
  document: Document | null;
  activePage?: number | null;
}

export default function PDFViewer({ document: doc, activePage }: PDFViewerProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <Empty
          description={
            <Text type="secondary" className="text-sm dark:!text-zinc-400">
              Select a document from the sidebar to view
            </Text>
          }
        />
      </div>
    );
  }

  if (!doc.url) {
    if (doc.status === "processing") {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
          <LoadingOutlined className="text-3xl text-blue-600" />
          <Text className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Processing document...</Text>
          <Text type="secondary" className="text-xs dark:!text-zinc-400">Extracting text & generating vector embeddings</Text>
        </div>
      );
    }

    if (doc.status === "error") {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
          <FileTextOutlined className="text-3xl text-red-500" />
          <Text className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Failed to process document</Text>
          <Text type="secondary" className="text-xs text-red-400">PDF text extraction yielded zero searchable chunks</Text>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <FileTextOutlined className="text-3xl text-zinc-400" />
        <Text className="text-sm text-zinc-500 dark:!text-zinc-400">No preview available</Text>
      </div>
    );
  }

  // Construct PDF URL with page fragment identifier (e.g. /api/documents/id/file?page=2#page=2)
  const viewerUrl = activePage && activePage > 0
    ? `${doc.url}?page=${activePage}#page=${activePage}`
    : doc.url;

  return (
    <div className="flex h-full flex-col border-l border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileTextOutlined className="text-blue-600 text-base shrink-0" />
          <Text strong className="truncate text-sm dark:!text-zinc-100" ellipsis={{ tooltip: doc.name }}>
            {doc.name}
          </Text>
          {activePage && activePage > 0 && (
            <Tag color="blue" className="!mr-0 flex items-center gap-1">
              <BookOutlined /> Page {activePage}
            </Tag>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-hidden bg-zinc-800">
        <object
          key={`${doc.id}-${activePage || 1}-${refreshKey}`}
          data={viewerUrl}
          type="application/pdf"
          className="h-full w-full"
          title={doc.name}
        >
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-white">
            <FileTextOutlined className="text-5xl text-zinc-400" />
            <Text type="secondary" className="text-sm text-zinc-300">
              Your browser does not support inline PDF viewing.
            </Text>
            <Button
              type="primary"
              size="small"
              onClick={() => {
                const a = document.createElement("a");
                a.href = doc.url!;
                a.download = doc.name;
                a.click();
              }}
            >
              Download Document PDF
            </Button>
          </div>
        </object>
      </div>
    </div>
  );
}
