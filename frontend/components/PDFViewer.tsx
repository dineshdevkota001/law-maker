"use client";

import { useState } from "react";
import type { Document } from "@/lib/types";
import { FileTextOutlined, LoadingOutlined, ZoomInOutlined, ZoomOutOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Typography, Empty } from "antd";

const { Text } = Typography;

interface PDFViewerProps {
  document: Document | null;
}

export default function PDFViewer({ document: doc }: PDFViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <Empty
          description={
            <Text type="secondary" className="text-sm">
              Select a document to view
            </Text>
          }
        />
      </div>
    );
  }

  if (doc.status === "processing") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <LoadingOutlined className="text-3xl text-blue-600" />
        <Text className="text-sm text-zinc-500">Processing document...</Text>
      </div>
    );
  }

  const pageCount = doc.pageCount || 1;

  return (
    <div className="flex h-full flex-col border-l border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <FileTextOutlined className="text-blue-600" />
          <Text strong className="max-w-[200px] truncate text-sm" ellipsis={{ tooltip: doc.name }}>
            {doc.name}
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="small"
            icon={<LeftOutlined />}
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          />
          <Text className="min-w-[60px] text-center text-xs">
            {currentPage} / {pageCount}
          </Text>
          <Button
            size="small"
            icon={<RightOutlined />}
            disabled={currentPage >= pageCount}
            onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
          />

          <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

          <Button
            size="small"
            icon={<ZoomOutOutlined />}
            disabled={zoom <= 50}
            onClick={() => setZoom((z) => Math.max(50, z - 10))}
          />
          <Text className="min-w-[40px] text-center text-xs">{zoom}%</Text>
          <Button
            size="small"
            icon={<ZoomInOutlined />}
            disabled={zoom >= 200}
            onClick={() => setZoom((z) => Math.min(200, z + 10))}
          />
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-auto p-6">
        <div
          className="w-full max-w-[680px] rounded-lg bg-white shadow-lg dark:bg-zinc-800"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
        >
          <div className="flex min-h-[900px] items-center justify-center p-12">
            <div className="text-center text-zinc-400">
              <FileTextOutlined className="mb-3 text-5xl" />
              <br />
              <Text type="secondary" className="text-sm">
                PDF content will render here
              </Text>
              <br />
              <Text type="secondary" className="text-xs">
                Page {currentPage} of {pageCount}
              </Text>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
