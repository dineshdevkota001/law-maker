"use client";

import { useState } from "react";
import { InboxOutlined, UploadOutlined, LoadingOutlined } from "@ant-design/icons";
import { Typography, Alert } from "antd";

const { Text } = Typography;

const UPLOAD_INPUT_ID = "pdf-upload-input";

interface PDFUploadProps {
  onUpload: (files: File[]) => void;
  isUploading: boolean;
  /** Current scope level selected for upload */
  level: string;
  /** Current scope subject selected for upload */
  subject: string;
  onLevelChange: (level: string) => void;
  onSubjectChange: (subject: string) => void;
}

const LEVEL_OPTIONS = [
  { value: "global", label: "Global" },
  { value: "per_subject", label: "Per Subject" },
  { value: "personal", label: "Personal" },
];

function isPDF(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

export default function PDFUpload({
  onUpload,
  isUploading,
  level,
  subject,
  onLevelChange,
  onSubjectChange,
}: PDFUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(isPDF);
    if (files.length > 0) {
      console.log('Selected files:', files.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type
      })));
      onUpload(files);
      setUploadError(null); // Clear previous errors
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).filter(isPDF);
    if (files.length > 0) {
      console.log('Selected files:', files.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type
      })));
      onUpload(files);
      setUploadError(null); // Clear previous errors
    }
    // reset so the same file can be re-selected
    e.target.value = "";
  }

  if (isUploading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 px-4 py-3 dark:border-blue-700 dark:bg-blue-950/20">
        <LoadingOutlined className="text-blue-600" />
        <Text className="text-sm text-blue-600 dark:text-blue-400">
          Uploading...
        </Text>
      </div>
    );
  }

  return (
    <>
      {/* Scope selector — level + subject for upload categorization */}
      <div className="mb-2 flex flex-col gap-1.5">
        <select
          value={level}
          onChange={(e) => onLevelChange(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {LEVEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="Subject (optional)"
          className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs placeholder-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        />
      </div>

      {/* Native file input — linked to the label below via id */}
      <input
        id={UPLOAD_INPUT_ID}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />

      {/* label acts as the click target — no JS needed to open picker */}
      <label
        htmlFor={UPLOAD_INPUT_ID}
        className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-4 transition-colors ${isDragging
          ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
          : "border-zinc-300 hover:border-blue-400 hover:bg-zinc-100/50 dark:border-zinc-700 dark:hover:border-blue-600 dark:hover:bg-zinc-800/50"
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging ? (
          <InboxOutlined className="text-2xl text-blue-500" />
        ) : (
          <UploadOutlined className="text-lg text-zinc-400" />
        )}
        <Text type="secondary" className="pointer-events-none text-center text-xs dark:!text-zinc-400">
          {isDragging ? "Drop PDFs here" : "Click or drag PDFs to upload"}
        </Text>
      </label>
      {uploadError && (
        <Alert
          message="Upload Error"
          description={uploadError}
          type="error"
          showIcon
          className="mt-2"
        />
      )}
    </>
  );
}
