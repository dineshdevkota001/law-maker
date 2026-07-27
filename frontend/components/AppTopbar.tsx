"use client";

import Link from "next/link";
import {
  FileTextOutlined,
  MessageOutlined,
  SettingOutlined,
} from "@ant-design/icons";

interface AppTopbarProps {
  active: "chat" | "documents" | "settings";
  documentCounts?: {
    global: number;
    perSubject: number;
    personal: number;
  };
}

function navClass(isActive: boolean): string {
  return isActive
    ? "inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
    : "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";
}

export default function AppTopbar({ active, documentCounts }: AppTopbarProps) {
  const hasCounts = !!documentCounts;
  return (
    <header className="border-b border-zinc-200/80 bg-white/85 px-5 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
      <div className="mx-auto flex w-full max-w-[1680px] items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          LawMaker
        </h1>

        <nav className="flex items-center gap-2 rounded-2xl bg-zinc-100 p-1.5 dark:bg-zinc-900">
          <Link href="/" className={navClass(active === "chat")}>
            <MessageOutlined /> Chat
          </Link>
          <Link href="/documents" className={navClass(active === "documents")}>
            <FileTextOutlined />
            <span className="hidden sm:inline">
              {hasCounts
                ? `Global ${documentCounts.global} | Per Subject ${documentCounts.perSubject} | Personal ${documentCounts.personal}`
                : "Documents"}
            </span>
            <span className="sm:hidden">Document</span>
          </Link>
          <Link href="/settings" className={navClass(active === "settings")}>
            <SettingOutlined /> Settings
          </Link>
        </nav>
      </div>
    </header>
  );
}
