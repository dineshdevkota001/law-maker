"use client";

import { useRef, useState } from "react";
import { InboxOutlined, UploadOutlined, LoadingOutlined } from "@ant-design/icons";
import { Typography } from "antd";

const { Text } = Typography;

interface PDFUploadProps {
  onUpload: (file: File) => void;
  isUploading: boolean;
}

export default function PDFUpload({ onUpload, isUploading }: PDFUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      onUpload(file);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
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
    <div
      className={`relative cursor-pointer rounded-lg border-2 border-dashed transition-colors ${
        isDragging
          ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
          : "border-zinc-300 hover:border-blue-400 hover:bg-zinc-100/50 dark:border-zinc-700 dark:hover:border-blue-600 dark:hover:bg-zinc-800/50"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileSelect}
      />
      <div className="flex flex-col items-center gap-1.5 px-4 py-4">
        {isDragging ? (
          <InboxOutlined className="text-2xl text-blue-500" />
        ) : (
          <UploadOutlined className="text-lg text-zinc-400" />
        )}
        <Text
          type="secondary"
          className="text-center text-xs"
        >
          {isDragging
            ? "Drop PDF here"
            : "Click or drag PDF to upload"}
        </Text>
      </div>
    </div>
  );
}
