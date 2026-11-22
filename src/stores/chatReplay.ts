import { createSignal, createMemo } from "solid-js";
import {
  normalizeStreamProject,
  loadStreamChatIndex,
  loadTimelineSummary,
  calibrateChatOffset,
  type ChatIndex,
  type TimelineSummary,
  type NormalizedIndexedMessage,
  type ChatDensityBucket,
} from "../services/api";
import { timelineSignals } from "./timeline";

// State Signals
const [chatIndex, setChatIndex] = createSignal<ChatIndex | null>(null);
const [timelineSummary, setTimelineSummary] = createSignal<TimelineSummary | null>(null);
const [isDrawerOpen, setIsDrawerOpen] = createSignal<boolean>(false);
const [autoScroll, setAutoScroll] = createSignal<boolean>(true);
const [searchFilter, setSearchFilter] = createSignal<string>("");
const [chatOffsetSeconds, setChatOffsetSeconds] = createSignal<number>(0);
const [activeProjectDir, setActiveProjectDir] = createSignal<string | null>(null);
const [isLoading, setIsLoading] = createSignal<boolean>(false);
const [isCalibrating, setIsCalibrating] = createSignal<boolean>(false);
const [chatError, setChatError] = createSignal<string | null>(null);

// Memos
const hasChat = createMemo(() => Boolean(chatIndex() && (chatIndex()?.total_messages ?? 0) > 0));
const totalMessages = createMemo(() => chatIndex()?.total_messages ?? 0);
const peakVelocity = createMemo(() => chatIndex()?.peak_velocity_msg_per_sec ?? 0);
const averageVelocity = createMemo(() => chatIndex()?.average_velocity_msg_per_sec ?? 0);
const densityBuckets5s = createMemo<ChatDensityBucket[]>(() => chatIndex()?.density_buckets_5s ?? []);
const densityBuckets1s = createMemo<ChatDensityBucket[]>(() => chatIndex()?.density_buckets_1s ?? []);

const allMessages = createMemo<NormalizedIndexedMessage[]>(() => chatIndex()?.messages ?? []);

const filteredMessages = createMemo<NormalizedIndexedMessage[]>(() => {
  const query = searchFilter().trim().toLowerCase();
  const msgs = allMessages();
  if (!query) return msgs;
  return msgs.filter(
    (m) =>
      m.message.toLowerCase().includes(query) ||
      m.author.toLowerCase().includes(query)
  );
});

// Binary search for the active message index matching current playhead time
const activeMessageIndex = createMemo<number>(() => {
  const msgs = filteredMessages();
  if (msgs.length === 0) return -1;
  const curr = timelineSignals.currentTime();

  let low = 0;
  let high = msgs.length - 1;
  let candidate = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (msgs[mid].time_seconds <= curr) {
      candidate = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return candidate;
});

// Actions
async function loadProjectChat(projectDir: string): Promise<boolean> {
  setIsLoading(true);
  setChatError(null);
  setActiveProjectDir(projectDir);

  try {
    let summary: TimelineSummary;
    try {
      summary = await loadTimelineSummary(projectDir);
    } catch {
      // If not yet normalized, run normalization
      summary = await normalizeStreamProject(projectDir);
    }

    setTimelineSummary(summary);
    setChatOffsetSeconds(summary.chat_offset_seconds || 0);

    if (summary.chat_ready) {
      const index = await loadStreamChatIndex(projectDir);
      setChatIndex(index);
      setIsDrawerOpen(true);
      return true;
    } else {
      setChatIndex(null);
      return false;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    setChatError(`Failed to load chat replay: ${msg}`);
    return false;
  } finally {
    setIsLoading(false);
  }
}

async function normalizeProject(projectDir?: string, offsetSec?: number): Promise<boolean> {
  const dir = projectDir || activeProjectDir();
  if (!dir) return false;

  setIsLoading(true);
  setChatError(null);
  try {
    const summary = await normalizeStreamProject(dir, offsetSec);
    setTimelineSummary(summary);
    setChatOffsetSeconds(summary.chat_offset_seconds || 0);

    if (summary.chat_ready) {
      const index = await loadStreamChatIndex(dir);
      setChatIndex(index);
      setIsDrawerOpen(true);
      return true;
    }
    return false;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    setChatError(`Normalization failed: ${msg}`);
    return false;
  } finally {
    setIsLoading(false);
  }
}

async function calibrateOffset(newOffsetSec: number): Promise<boolean> {
  const dir = activeProjectDir();
  if (!dir) return false;

  setIsCalibrating(true);
  try {
    const summary = await calibrateChatOffset(dir, newOffsetSec);
    setTimelineSummary(summary);
    setChatOffsetSeconds(newOffsetSec);

    const index = await loadStreamChatIndex(dir);
    setChatIndex(index);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    setChatError(`Offset calibration failed: ${msg}`);
    return false;
  } finally {
    setIsCalibrating(false);
  }
}

function toggleDrawer() {
  setIsDrawerOpen((prev) => !prev);
}

function toggleAutoScroll() {
  setAutoScroll((prev) => !prev);
}

function jumpToMessage(timeSec: number) {
  timelineSignals.setCurrentTime(Math.max(0, timeSec));
}

function clearChat() {
  setChatIndex(null);
  setTimelineSummary(null);
  setIsDrawerOpen(false);
  setSearchFilter("");
  setChatOffsetSeconds(0);
  setActiveProjectDir(null);
  setChatError(null);
}

export const chatReplaySignals = {
  chatIndex,
  timelineSummary,
  isDrawerOpen,
  setIsDrawerOpen,
  autoScroll,
  setAutoScroll,
  searchFilter,
  setSearchFilter,
  chatOffsetSeconds,
  activeProjectDir,
  isLoading,
  isCalibrating,
  chatError,
  hasChat,
  totalMessages,
  peakVelocity,
  averageVelocity,
  densityBuckets5s,
  densityBuckets1s,
  allMessages,
  filteredMessages,
  activeMessageIndex,
  loadProjectChat,
  normalizeProject,
  calibrateOffset,
  toggleDrawer,
  toggleAutoScroll,
  jumpToMessage,
  clearChat,
};
