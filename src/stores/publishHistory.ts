import { createStore, reconcile } from "solid-js/store";

export type PublishPlatform = "youtube" | "instagram" | "tiktok" | "youtube_studio";

export interface PublishRecord {
  id: string;
  platform: PublishPlatform;
  publishedAt: string;
  url?: string;
  clipTitle?: string;
}

function loadPersistedPublishHistory(): Record<string, PublishRecord[]> {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("clipforge_publish_history_v1");
      return raw ? JSON.parse(raw) : {};
    }
  } catch (err) {
    console.warn("Failed to load publish history from localStorage:", err);
  }
  return {};
}

function savePersistedPublishHistory(history: Record<string, PublishRecord[]>): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("clipforge_publish_history_v1", JSON.stringify(history));
    }
  } catch (err) {
    console.warn("Failed to persist publish history:", err);
  }
}

export const [publishHistory, setPublishHistory] = createStore<Record<string, PublishRecord[]>>(
  loadPersistedPublishHistory()
);

export function recordPublish(
  clipId: string,
  platform: PublishPlatform,
  url?: string,
  clipTitle?: string
): void {
  const existing = publishHistory[clipId] || [];
  const record: PublishRecord = {
    id: `pub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    platform,
    publishedAt: new Date().toISOString(),
    url,
    clipTitle,
  };

  // Avoid duplicate records if published in the last 10 seconds to the same platform
  const filtered = existing.filter(
    (r) => !(r.platform === platform && Date.now() - new Date(r.publishedAt).getTime() < 10000)
  );

  const updatedList = [record, ...filtered];
  setPublishHistory(clipId, updatedList);
  savePersistedPublishHistory(publishHistory);
}

export function getClipPublishHistory(clipId: string): PublishRecord[] {
  return publishHistory[clipId] || [];
}

export function hasPublishedTo(clipId: string, platform: PublishPlatform): boolean {
  const records = publishHistory[clipId];
  return Boolean(records && records.some((r) => r.platform === platform));
}

export function clearPublishHistory(clipId?: string): void {
  if (clipId) {
    setPublishHistory(clipId, []);
  } else {
    setPublishHistory(reconcile({}));
  }
  savePersistedPublishHistory(publishHistory);
}

export const publishHistorySignals = {
  history: publishHistory,
  recordPublish,
  getClipPublishHistory,
  hasPublishedTo,
  clearPublishHistory,
};
