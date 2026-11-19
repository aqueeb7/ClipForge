import type { ClipForgeProject, ClipManifest } from "@clipforge/shared";
import type { MediaMetadata } from "./api";
import { getMediaAssetUrl } from "./api";

const SESSION_STORAGE_KEY = "clipforge_active_session_v1";
const RECENTS_STORAGE_KEY = "clipforge_recent_projects_v1";
const QUEUE_STORAGE_KEY = "clipforge_persisted_queue_v1";

export interface RecentProjectItem {
  id: string;
  name: string;
  filePath: string;
  videoPath?: string;
  audioPath?: string;
  clipsCount?: number;
  lastOpened: string;
}

export interface SessionSnapshot {
  version: number;
  savedAt: string;
  project: ClipForgeProject | null;
  videoMetadata: MediaMetadata | null;
  audioMetadata: MediaMetadata | null;
  masterInSeconds: number;
  masterOutSeconds: number;
  isMasterPatched: boolean;
  timelineStage: "master" | "parts";
  activeWorkspaceTab: "media" | "edit" | "deliver";
  isVideoAudioMuted: boolean;
  isDedicatedAudioMuted: boolean;
  projectFilePath: string | null;
  currentTime: number;
  zoomLevel: number;
  isTimelineExpanded: boolean;
}

/**
 * Saves current application & project state to local storage.
 */
export function saveSessionState(snapshot: SessionSnapshot): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot));
    }
  } catch (err) {
    console.warn("Failed to persist session to localStorage:", err);
  }
}

/**
 * Loads the last persisted session state.
 */
export function loadSessionState(): SessionSnapshot | null {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as SessionSnapshot;
      }
    }
  } catch (err) {
    console.warn("Failed to read persisted session:", err);
  }
  return null;
}

/**
 * Clears the active session state (e.g. on New Project).
 */
export function clearSessionState(): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(QUEUE_STORAGE_KEY);
    }
  } catch (err) {
    console.warn("Failed to clear session:", err);
  }
}

/**
 * Retrieves the list of recent projects.
 */
export function getRecentProjects(): RecentProjectItem[] {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(RECENTS_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as RecentProjectItem[];
      }
    }
  } catch (err) {
    console.warn("Failed to read recent projects:", err);
  }
  return [];
}

/**
 * Adds or updates a recent project entry.
 */
export function addRecentProject(item: Omit<RecentProjectItem, "id" | "lastOpened">): void {
  try {
    if (typeof localStorage === "undefined") return;
    const recents = getRecentProjects();
    const existingIdx = recents.findIndex((r) => r.filePath === item.filePath || r.name === item.name);

    const updatedItem: RecentProjectItem = {
      id: existingIdx !== -1 ? recents[existingIdx].id : `rec_${Date.now()}`,
      name: item.name,
      filePath: item.filePath,
      videoPath: item.videoPath,
      audioPath: item.audioPath,
      clipsCount: item.clipsCount,
      lastOpened: new Date().toISOString()
    };

    if (existingIdx !== -1) {
      recents.splice(existingIdx, 1);
    }
    recents.unshift(updatedItem);

    // Keep top 8 recent projects
    const trimmed = recents.slice(0, 8);
    localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn("Failed to add recent project:", err);
  }
}

/**
 * Clears the list of recent projects.
 */
export function clearRecentProjects(): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(RECENTS_STORAGE_KEY);
    }
  } catch (err) {
    console.warn("Failed to clear recent projects:", err);
  }
}

/**
 * Sets up OS sleep, wake, tab suspend, and window unload listeners.
 */
export function setupSleepAndLifecycleWatchers(
  onSave: () => void,
  onResume: () => void
): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      onSave();
    } else if (document.visibilityState === "visible") {
      onResume();
    }
  };

  const handlePageHide = () => {
    onSave();
  };

  const handlePageShow = () => {
    onResume();
  };

  const handleBeforeUnload = () => {
    onSave();
  };

  const handleFreeze = () => {
    onSave();
  };

  const handleResume = () => {
    onResume();
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("pageshow", handlePageShow);
  window.addEventListener("beforeunload", handleBeforeUnload);
  document.addEventListener("freeze", handleFreeze);
  document.addEventListener("resume", handleResume);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("pagehide", handlePageHide);
    window.removeEventListener("pageshow", handlePageShow);
    window.removeEventListener("beforeunload", handleBeforeUnload);
    document.removeEventListener("freeze", handleFreeze);
    document.removeEventListener("resume", handleResume);
  };
}
