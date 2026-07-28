export type ThemeMode = "light" | "dark";

export const PREF_KEYS = {
  theme: "law-maker-theme",
  userId: "law-maker-user-id",
  defaultTopic: "law-maker-default-topic",
  backendUrl: "law-maker-backend-url",
  chatSessionId: "law-maker-chat-session-id",
} as const;

export function getStoredPreference(key: string, fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }
  return window.localStorage.getItem(key) || fallback;
}

export function setStoredPreference(key: string, value: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(key, value);
}

export function getOrCreateStoredPreference(
  key: string,
  fallbackFactory: () => string,
): string {
  if (typeof window === "undefined") {
    return fallbackFactory();
  }

  const existing = window.localStorage.getItem(key);
  if (existing) {
    return existing;
  }

  const nextValue = fallbackFactory();
  window.localStorage.setItem(key, nextValue);
  return nextValue;
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.setAttribute("data-theme", mode);
}
