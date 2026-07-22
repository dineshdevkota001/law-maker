/**
 * Legacy entry point — delegates to the canonical API client in lib/api.ts.
 * This file is kept for backward compatibility. Prefer importing from
 * "@/lib/api" directly in new code.
 */
export {
  uploadDocument as uploadDocuments,
  sendMessage as getChatResponse,
  getDocuments,
  deleteDocument,
} from "@/lib/api";