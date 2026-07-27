"use client";

import { useEffect } from "react";
import {
  PREF_KEYS,
  applyTheme,
  getStoredPreference,
  type ThemeMode,
} from "@/lib/preferences";

export default function ThemeInitializer() {
  useEffect(() => {
    const mode =
      (getStoredPreference(PREF_KEYS.theme, "light") as ThemeMode) || "light";
    applyTheme(mode === "dark" ? "dark" : "light");
  }, []);

  return null;
}
