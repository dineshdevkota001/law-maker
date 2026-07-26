"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useEffect } from "react";
import type { Document } from "@/lib/types";
import {
  DeleteOutlined,
  FileTextOutlined,
  LoadingOutlined,
  MessageOutlined,
  SettingOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Input,
  Segmented,
  Tag,
  Typography,
  message,
} from "antd";
import { deleteDocument, getDocuments, uploadDocument } from "@/lib/api";

const { Title, Text } = Typography;

type DocLevel = "global" | "per_subject" | "personal";

const USER_ID_STORAGE_KEY = "law-maker-user-id";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function groupDocumentsByLevel(documents: Document[]) {
  return {
    global: documents.filter((d) => d.level === "global"),
    per_subject: documents.filter((d) => d.level === "per_subject"),
    personal: documents.filter((d) => d.level === "personal"),
  };
}

function DocumentRow({
  doc,
  onDelete,
  deleting,
}: {
  doc: Document;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <FileTextOutlined className="text-blue-600" />
          <Text className="truncate text-base font-semibold">{doc.name}</Text>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <span>{formatSize(doc.size)}</span>
          {doc.pageCount ? <span>{doc.pageCount} pages</span> : null}
          <Tag className="!mr-0">{doc.status}</Tag>
          {doc.level === "per_subject" ? (
            <Tag className="!mr-0" color="processing">
              subject: {doc.subject}
            </Tag>
          ) : null}
          {doc.level === "personal" && doc.userId ? (
            <Tag className="!mr-0" color="gold">
              user: {doc.userId}
            </Tag>
          ) : null}
        </div>
      </div>

      <Button
        danger
        icon={<DeleteOutlined />}
        loading={deleting}
        onClick={() => onDelete(doc.id)}
      >
        Delete
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  const initialUserId =
    typeof window !== "undefined"
      ? window.localStorage.getItem(USER_ID_STORAGE_KEY) || "dinesh"
      : "dinesh";

  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<DocLevel>("global");
  const [subject, setSubject] = useState("general");
  const [userId, setUserId] = useState(initialUserId);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => groupDocumentsByLevel(documents), [documents]);

  const loadDocuments = useCallback(async () => {
    setIsLoadingDocs(true);
    setError(null);
    try {
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (e) {
      const msgText = e instanceof Error ? e.message : "Failed to load documents.";
      setError(msgText);
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getDocuments()
      .then((docs) => {
        if (!active) {
          return;
        }
        setDocuments(docs);
      })
      .catch((e) => {
        if (!active) {
          return;
        }
        const msgText =
          e instanceof Error ? e.message : "Failed to load documents.";
        setError(msgText);
      })
      .finally(() => {
        if (active) {
          setIsLoadingDocs(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(USER_ID_STORAGE_KEY, userId);
  }, [userId]);

  async function handleUploadFile(file: File) {
    setUploading(true);
    setError(null);

    try {
      await uploadDocument(file, {
        level: selectedLevel,
        subject,
        userId,
      });
      message.success("Document uploaded.");
      await loadDocuments();
    } catch (e) {
      const msgText = e instanceof Error ? e.message : "Upload failed.";
      setError(msgText);
      message.error(msgText);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(documentId: string) {
    setDeletingId(documentId);
    setError(null);

    try {
      await deleteDocument(documentId, userId);
      message.success("Document deleted.");
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
    } catch (e) {
      const msgText = e instanceof Error ? e.message : "Delete failed.";
      setError(msgText);
      message.error(msgText);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--surface-app)]">
      <header className="border-b border-zinc-200/80 bg-white/80 px-6 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Law Maker Settings
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Manage uploads and document classes for retrieval scope.
            </p>
          </div>
          <nav className="flex items-center gap-2 rounded-2xl bg-zinc-100 p-1.5 dark:bg-zinc-900">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <MessageOutlined /> Chat
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
            >
              <SettingOutlined /> Settings
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] px-6 py-6">
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Title level={4} className="!mb-2">
            Upload Document
          </Title>
          <Text className="block text-base text-zinc-500 dark:text-zinc-400">
            Choose class and metadata before uploading. This controls retrieval visibility.
          </Text>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div>
              <Text className="mb-1 block text-sm font-medium">Class</Text>
              <Segmented
                block
                value={selectedLevel}
                onChange={(value) => setSelectedLevel(value as DocLevel)}
                options={[
                  { label: "Global", value: "global" },
                  { label: "Per Subject", value: "per_subject" },
                  { label: "Personal", value: "personal" },
                ]}
              />
            </div>

            <div>
              <Text className="mb-1 block text-sm font-medium">Subject</Text>
              <Input
                size="large"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="general"
                disabled={selectedLevel !== "per_subject"}
              />
            </div>

            <div>
              <Text className="mb-1 block text-sm font-medium">User Id</Text>
              <Input
                size="large"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="user id for personal docs"
                disabled={selectedLevel !== "personal"}
              />
            </div>
          </div>

          <div className="mt-5">
            <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
              {uploading ? <LoadingOutlined /> : <UploadOutlined />}
              {uploading ? "Uploading..." : "Select PDF to Upload"}
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleUploadFile(file);
                  }
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>

          {error ? (
            <Alert className="mt-4" type="error" message={error} showIcon />
          ) : null}
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-3">
          {([
            ["Global", grouped.global],
            ["Per Subject", grouped.per_subject],
            ["Personal", grouped.personal],
          ] as const).map(([title, docs]) => (
            <div
              key={title}
              className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="mb-3 flex items-center justify-between">
                <Title level={5} className="!mb-0">
                  {title}
                </Title>
                <Tag className="!mr-0">{docs.length}</Tag>
              </div>

              <div className="space-y-3">
                {isLoadingDocs ? (
                  <div className="rounded-xl border border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    Loading documents...
                  </div>
                ) : docs.length === 0 ? (
                  <div className="rounded-xl border border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    No documents in this class.
                  </div>
                ) : (
                  docs.map((doc) => (
                    <DocumentRow
                      key={doc.id}
                      doc={doc}
                      deleting={deletingId === doc.id}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
