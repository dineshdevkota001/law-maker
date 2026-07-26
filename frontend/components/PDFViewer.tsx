"use client";

import { useState } from "react";
import type { Document } from "@/lib/types";
import { buildPdfPageUrl } from "@/lib/api";
import {
  FileTextOutlined,
  LoadingOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { Button, Typography, Empty } from "antd";

const { Text } = Typography;

interface PDFViewerProps {
  document: Document | null;
  requestedPage?: number;
}

export default function PDFViewer({
  document: doc,
  requestedPage,
}: PDFViewerProps) {
  const pageCount = doc?.pageCount || 1;
  const initialPage = Math.max(1, Math.min(pageCount, requestedPage || 1));
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [zoom, setZoom] = useState(100);
  const pdfUrl = doc?.sourceFileUrl
    ? buildPdfPageUrl(doc.sourceFileUrl, currentPage)
    : null;

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

  return (
    <div className="flex h-full flex-col border-l border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <FileTextOutlined className="text-blue-600" />
          <Text
            strong
            className="max-w-[200px] truncate text-sm"
            ellipsis={{ tooltip: doc.name }}
          >
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
        {pdfUrl ? (
          <div
            className="w-full max-w-[760px] overflow-hidden rounded-lg bg-white shadow-lg"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top center",
            }}
          >
            <iframe
              title={doc.name}
              src={pdfUrl}
              className="h-[900px] w-full"
            />
          </div>
        ) : (
          <div className="w-full max-w-[680px] rounded-lg bg-white p-12 text-center shadow-lg dark:bg-zinc-800">
            <FileTextOutlined className="mb-3 text-5xl text-zinc-400" />
            <Text type="secondary" className="text-sm">
              PDF source URL not available for this document.
            </Text>
          </div>
        )}
      </div>
    </div>
  );
}
