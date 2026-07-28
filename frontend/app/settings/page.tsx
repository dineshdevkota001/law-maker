"use client";

import { useEffect, useState } from "react";
import { Input, Radio, Typography } from "antd";
import AppTopbar from "@/components/AppTopbar";
import {
  PREF_KEYS,
  applyTheme,
  getStoredPreference,
  setStoredPreference,
  type ThemeMode,
} from "@/lib/preferences";

const { Title, Text } = Typography;

export default function SettingsPage() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [userId, setUserId] = useState("dinesh");
  const [defaultTopic, setDefaultTopic] = useState("general");
  const [backendUrl, setBackendUrl] = useState("http://localhost:8000");
  const [isHydrated, setIsHydrated] = useState(false);

  // Restore preferences from localStorage after hydration
  useEffect(() => {
    const storedTheme =
      (getStoredPreference(PREF_KEYS.theme, "light") as ThemeMode) || "light";
    const storedUserId = getStoredPreference(PREF_KEYS.userId, "dinesh");
    const storedDefaultTopic = getStoredPreference(
      PREF_KEYS.defaultTopic,
      "general",
    );
    const storedBackendUrl = getStoredPreference(
      PREF_KEYS.backendUrl,
      "http://localhost:8000",
    );

    setTheme(storedTheme);
    setUserId(storedUserId);
    setDefaultTopic(storedDefaultTopic);
    setBackendUrl(storedBackendUrl);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      applyTheme(theme === "dark" ? "dark" : "light");
    }
  }, [theme, isHydrated]);

  function onThemeChange(next: ThemeMode) {
    setTheme(next);
    setStoredPreference(PREF_KEYS.theme, next);
    applyTheme(next);
  }

  function onUserIdChange(next: string) {
    setUserId(next);
    setStoredPreference(PREF_KEYS.userId, next || "dinesh");
  }

  function onDefaultTopicChange(next: string) {
    setDefaultTopic(next);
    setStoredPreference(PREF_KEYS.defaultTopic, next || "general");
  }

  function onBackendUrlChange(next: string) {
    setBackendUrl(next);
    setStoredPreference(PREF_KEYS.backendUrl, next || "http://localhost:8000");
  }

  return (
    <div className="min-h-screen bg-[var(--surface-app)]">
      <AppTopbar active="settings" />

      <main className="mx-auto w-full max-w-[1200px] px-6 py-8">
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Title level={4} className="!mb-2">
            Appearance
          </Title>
          <Text className="mb-4 block text-base text-zinc-500 dark:text-zinc-400">
            Choose how LawMaker looks in your browser.
          </Text>
          <Radio.Group
            value={theme}
            onChange={(e) => onThemeChange(e.target.value as ThemeMode)}
            optionType="button"
            buttonStyle="solid"
            options={[
              { label: "Light", value: "light" },
              { label: "Dark", value: "dark" },
            ]}
          />
        </section>

        <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Title level={4} className="!mb-2">
            Upload Defaults
          </Title>
          <Text className="mb-5 block text-base text-zinc-500 dark:text-zinc-400">
            These defaults are used on the Documents upload page and in
            conversation metadata.
          </Text>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Text className="mb-1 block text-sm font-medium">
                Default User Id
              </Text>
              <Input
                size="large"
                value={userId}
                onChange={(e) => onUserIdChange(e.target.value)}
                placeholder="dinesh"
              />
            </div>

            <div>
              <Text className="mb-1 block text-sm font-medium">
                Default Topic
              </Text>
              <Input
                size="large"
                value={defaultTopic}
                onChange={(e) => onDefaultTopicChange(e.target.value)}
                placeholder="general"
              />
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Title level={4} className="!mb-2">
            Backend Configuration
          </Title>
          <Text className="mb-5 block text-base text-zinc-500 dark:text-zinc-400">
            Configure the backend server URL for API requests.
          </Text>

          <div>
            <Text className="mb-1 block text-sm font-medium">Backend URL</Text>
            <Input
              size="large"
              value={backendUrl}
              onChange={(e) => onBackendUrlChange(e.target.value)}
              placeholder="http://localhost:8000"
              type="url"
            />
            <Text className="mt-2 block text-xs text-zinc-400 dark:text-zinc-500">
              Example: http://localhost:8000 or https://api.example.com
            </Text>
          </div>
        </section>
      </main>
    </div>
  );
}
