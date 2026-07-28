"use client";

import { useState, useEffect } from "react";
import { Viewer, Worker } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import type { Document } from "@/lib/types";
import { resolveApiUrl } from "@/lib/api";
import { Empty, Spin, message, Button } from "antd";
import { LoadingOutlined, CloseOutlined } from "@ant-design/icons";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";

interface PDFViewerAdvancedProps {
  document: Document | null;
  requestedPage?: number;
  onClose?: () => void;
}

const CACHE_KEY_PREFIX = "pdf_cache_";
const CACHE_EXPIRY_DAYS = 7;

// IndexedDB helper functions
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("PDFCache", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("pdfs")) {
        db.createObjectStore("pdfs");
      }
    };
  });
}

function getFromIndexedDB(
  db: IDBDatabase,
  key: string,
): Promise<ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["pdfs"], "readonly");
    const store = transaction.objectStore("pdfs");
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const item = request.result;
      if (!item) {
        resolve(null);
        return;
      }

      // Check expiry
      const now = Date.now();
      const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      if (now - item.timestamp > expiryTime) {
        // Expired, delete it
        const deleteReq = store.delete(key);
        deleteReq.onsuccess = () => resolve(null);
        deleteReq.onerror = () => reject(deleteReq.error);
        return;
      }

      resolve(item.data);
    };
  });
}

function saveToIndexedDB(
  db: IDBDatabase,
  key: string,
  data: ArrayBuffer,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["pdfs"], "readwrite");
    const store = transaction.objectStore("pdfs");
    const request = store.put({ data, timestamp: Date.now() }, key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Get cached PDF or fetch from backend
const getCachedPdf = async (
  documentId: string,
  sourceFileUrl: string,
): Promise<ArrayBuffer> => {
  const cacheKey = `${CACHE_KEY_PREFIX}${documentId}`;

  // Resolve to absolute backend URL using API config
  const absoluteUrl = resolveApiUrl(sourceFileUrl);

  console.log(`[PDF Cache] Document: ${documentId}`);
  console.log(`[PDF Cache] URL: ${absoluteUrl}`);

  // Try to get from IndexedDB
  try {
    const db = await openIndexedDB();
    const cached = await getFromIndexedDB(db, cacheKey);
    if (cached) {
      console.log(`✓ [PDF Cache] Loaded from IndexedDB: ${documentId}`);
      return cached;
    }
  } catch (e) {
    console.warn(`⚠ [PDF Cache] IndexedDB unavailable: ${e}`);
  }

  // Fetch from backend
  console.log(`📥 [PDF Cache] Fetching from backend: ${absoluteUrl}`);
  try {
    const response = await fetch(absoluteUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log(
      `✓ [PDF Cache] Downloaded ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`,
    );

    // Cache it
    try {
      const db = await openIndexedDB();
      await saveToIndexedDB(db, cacheKey, arrayBuffer);
      console.log(`✓ [PDF Cache] Saved to IndexedDB: ${documentId}`);
    } catch (e) {
      console.warn(`⚠ [PDF Cache] Failed to cache: ${e}`);
    }

    return arrayBuffer;
  } catch (error) {
    console.error(
      `✗ [PDF Cache] Failed to fetch: ${error instanceof Error ? error.message : error}`,
    );
    throw error;
  }
};

export default function PDFViewerAdvanced({
  document: doc,
  requestedPage,
  onClose,
}: PDFViewerAdvancedProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Create plugin instance at component level (not in hook)
  // Configure to hide all sidebar tabs and add close button
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    toolbarPlugin: {
      fullScreenPlugin: {
        enableShortcuts: false,
      },
      openPlugin: {
        enableShortcuts: false,
      },
      printPlugin: {
        enableShortcuts: false,
      },
    },
    sidebarTabs: () => [],
  });

  // Load and prepare PDF
  useEffect(() => {
    if (!doc?.sourceFileUrl) {
      console.warn("[PDF Viewer] No sourceFileUrl provided");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPdfUrl(null);
      return;
    }

    const loadPdf = async () => {
      setIsLoading(true);
      try {
        console.log(`[PDF Viewer] Loading PDF for document: ${doc.id}`);
        const pdfData = await getCachedPdf(doc.id, doc.sourceFileUrl!);

        // Create blob URL from ArrayBuffer
        const blob = new Blob([pdfData], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        console.log(`✓ [PDF Viewer] PDF ready for viewing`);
      } catch (error) {
        console.error("Failed to load PDF:", error);
        message.error("Failed to load PDF document");
        setPdfUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadPdf();

    // Cleanup blob URL on unmount
    return () => {
      setPdfUrl((pdfUrl) => {
        if (pdfUrl) {
          URL.revokeObjectURL(pdfUrl);
        }
        return null;
      });
    };
  }, [doc?.id, doc?.sourceFileUrl]);

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <Empty
          description={
            <span className="text-sm text-zinc-500">
              Select a document to view
            </span>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} />} />
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="flex h-full items-center justify-center border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <Empty
          description={
            <span className="text-sm text-red-500">Failed to load PDF</span>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-white dark:bg-zinc-900">
      {/* Header with close button */}
      {onClose && (
        <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {doc?.name}
          </span>
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={onClose}
            title="Close viewer"
          />
        </div>
      )}
      {/* PDF Viewer */}
      <div className="flex-1 overflow-hidden">
        <Worker workerUrl="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js">
          <Viewer
            key={`${pdfUrl}-${requestedPage || 0}`}
            fileUrl={pdfUrl}
            plugins={[defaultLayoutPluginInstance]}
            initialPage={requestedPage ? requestedPage - 1 : 0}
          />
        </Worker>
      </div>
    </div>
  );
}
