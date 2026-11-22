import { Component, createSignal, createMemo, createEffect, onCleanup, Show, For } from "solid-js";
import { chatReplaySignals } from "../stores/chatReplay";
import { timelineSignals } from "../stores/timeline";
import { projectSignals } from "../stores/project";
import {
  MessageSquare,
  Flame,
  Search,
  Lock,
  Unlock,
  Sliders,
  X,
  ChevronDown,
  RefreshCw,
  Clock,
  Sparkles,
} from "./Icons";

// Generate deterministic avatar color from author string
function getAuthorColor(author: string): string {
  const colors = [
    "text-amber-400",
    "text-emerald-400",
    "text-sky-400",
    "text-purple-400",
    "text-pink-400",
    "text-rose-400",
    "text-cyan-400",
    "text-indigo-400",
    "text-lime-400",
    "text-orange-400",
  ];
  let hash = 0;
  for (let i = 0; i < author.length; i++) {
    hash = author.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

function formatOffset(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.floor(Math.max(0, seconds) % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export const ChatReplayDrawer: Component = () => {
  let scrollContainerRef: HTMLDivElement | undefined;
  let activeItemRef: HTMLDivElement | undefined;

  const [showOffsetCalibration, setShowOffsetCalibration] = createSignal(false);
  const [offsetInput, setOffsetInput] = createSignal<number>(
    chatReplaySignals.chatOffsetSeconds()
  );
  const [userHasScrolled, setUserHasScrolled] = createSignal(false);

  const activeIdx = () => chatReplaySignals.activeMessageIndex();
  const messages = () => chatReplaySignals.filteredMessages();
  const peak = () => chatReplaySignals.peakVelocity();
  const total = () => chatReplaySignals.totalMessages();

  // Keep local offset input synced with store
  createEffect(() => {
    setOffsetInput(chatReplaySignals.chatOffsetSeconds());
  });

  // Auto-scroll effect: when activeMessageIndex changes and autoScroll is enabled
  createEffect(() => {
    const idx = activeIdx();
    const canAutoScroll = chatReplaySignals.autoScroll() && !userHasScrolled();

    if (canAutoScroll && scrollContainerRef && idx >= 0) {
      // Find element with data-index
      const targetEl = scrollContainerRef.querySelector(`[data-msg-index="${idx}"]`) as HTMLElement;
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  });

  function handleScroll() {
    if (!scrollContainerRef) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    if (!isAtBottom && chatReplaySignals.autoScroll()) {
      setUserHasScrolled(true);
    } else if (isAtBottom) {
      setUserHasScrolled(false);
    }
  }

  function resumeAutoScroll() {
    setUserHasScrolled(false);
    chatReplaySignals.setAutoScroll(true);
    const idx = activeIdx();
    if (scrollContainerRef && idx >= 0) {
      const targetEl = scrollContainerRef.querySelector(`[data-msg-index="${idx}"]`) as HTMLElement;
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  async function applyCalibration() {
    await chatReplaySignals.calibrateOffset(offsetInput());
    setShowOffsetCalibration(false);
  }

  return (
    <div class="h-full flex flex-col rounded-xl border border-zinc-800 bg-zinc-950/90 shadow-xl overflow-hidden select-none">
      {/* Header */}
      <div class="px-3 py-2 bg-zinc-900/90 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <div class="relative flex items-center justify-center">
            <div class="w-2 h-2 rounded-full bg-emerald-500" />
            <div class="absolute w-3.5 h-3.5 rounded-full bg-emerald-500/30 animate-ping" />
          </div>
          <div>
            <h3 class="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <span>Synchronized Chat</span>
              <Show when={peak() > 0}>
                <span class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-800/50 text-amber-300 text-[10px] font-mono">
                  <Flame size={10} class="text-amber-400" />
                  <span>{peak().toFixed(1)}/s</span>
                </span>
              </Show>
            </h3>
            <div class="text-[10px] text-zinc-400 font-mono">
              {total().toLocaleString()} msgs • {formatOffset(timelineSignals.currentTime())}
            </div>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div class="flex items-center gap-1">
          <button
            type="button"
            onClick={() => chatReplaySignals.toggleAutoScroll()}
            class={`p-1.5 rounded text-xs transition cursor-pointer ${
              chatReplaySignals.autoScroll()
                ? "bg-blue-600/30 text-blue-300 border border-blue-500/40"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
            title={
              chatReplaySignals.autoScroll()
                ? "Lock playhead auto-scroll (Enabled)"
                : "Lock playhead auto-scroll (Disabled)"
            }
          >
            <Show when={chatReplaySignals.autoScroll()} fallback={<Unlock size={12} />}>
              <Lock size={12} />
            </Show>
          </button>

          <button
            type="button"
            onClick={() => setShowOffsetCalibration((prev) => !prev)}
            class={`p-1.5 rounded text-xs transition cursor-pointer ${
              showOffsetCalibration()
                ? "bg-amber-600/30 text-amber-300 border border-amber-500/40"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
            title="Calibrate Chat Timestamp Offset"
          >
            <Sliders size={12} />
          </button>

          <button
            type="button"
            onClick={() => chatReplaySignals.setIsDrawerOpen(false)}
            class="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            title="Close Chat Drawer"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Offset Calibration Popup */}
      <Show when={showOffsetCalibration()}>
        <div class="p-2.5 bg-zinc-900 border-b border-zinc-800 space-y-2 text-xs">
          <div class="flex items-center justify-between text-[11px] text-zinc-300 font-medium">
            <span>Chat Sync Offset:</span>
            <span class="font-mono text-amber-400">{offsetInput().toFixed(2)}s</span>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOffsetInput((v) => Math.round((v - 0.5) * 100) / 100)}
              class="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono cursor-pointer"
            >
              -0.5s
            </button>
            <button
              type="button"
              onClick={() => setOffsetInput((v) => Math.round((v - 0.1) * 100) / 100)}
              class="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono cursor-pointer"
            >
              -0.1s
            </button>
            <input
              type="number"
              step="0.1"
              value={offsetInput()}
              onInput={(e) => setOffsetInput(parseFloat(e.currentTarget.value) || 0)}
              class="flex-1 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-[11px] font-mono text-zinc-100 text-center"
            />
            <button
              type="button"
              onClick={() => setOffsetInput((v) => Math.round((v + 0.1) * 100) / 100)}
              class="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono cursor-pointer"
            >
              +0.1s
            </button>
            <button
              type="button"
              onClick={() => setOffsetInput((v) => Math.round((v + 0.5) * 100) / 100)}
              class="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono cursor-pointer"
            >
              +0.5s
            </button>
          </div>
          <div class="flex justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setShowOffsetCalibration(false)}
              class="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyCalibration}
              disabled={chatReplaySignals.isCalibrating()}
              class="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Show when={chatReplaySignals.isCalibrating()}>
                <RefreshCw size={10} class="animate-spin" />
              </Show>
              <span>Apply Offset</span>
            </button>
          </div>
        </div>
      </Show>

      {/* Filter / Search Bar */}
      <div class="p-2 border-b border-zinc-800/80 bg-zinc-900/40">
        <div class="relative flex items-center">
          <Search size={12} class="absolute left-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search chat keywords (e.g. W, CLIP, LOL)..."
            value={chatReplaySignals.searchFilter()}
            onInput={(e) => chatReplaySignals.setSearchFilter(e.currentTarget.value)}
            class="w-full pl-7 pr-7 py-1 text-[11px] rounded bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          />
          <Show when={chatReplaySignals.searchFilter()}>
            <button
              type="button"
              onClick={() => chatReplaySignals.setSearchFilter("")}
              class="absolute right-2 text-zinc-500 hover:text-zinc-300 cursor-pointer text-xs"
            >
              &times;
            </button>
          </Show>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        class="flex-1 overflow-y-auto p-2 space-y-1 font-sans text-xs min-h-0 divide-y divide-zinc-900/60"
      >
        <Show
          when={chatReplaySignals.hasChat()}
          fallback={
            <div class="h-full flex flex-col items-center justify-center p-4 text-center text-zinc-500 text-xs">
              <MessageSquare size={24} class="mb-2 opacity-40 text-zinc-400" />
              <p class="font-medium text-zinc-400">No Chat Replay Loaded</p>
              <p class="text-[11px] text-zinc-500 mt-1 max-w-[200px]">
                Download a stream with chat enabled or load a project containing source/chat.json
              </p>
            </div>
          }
        >
          <For each={messages()}>
            {(m, idx) => {
              const isActive = () => idx() === activeIdx();
              const isPast = () => m.time_seconds < timelineSignals.currentTime();

              return (
                <div
                  data-msg-index={idx()}
                  onClick={() => chatReplaySignals.jumpToMessage(m.time_seconds)}
                  class={`pt-1.5 pb-1 px-2 rounded-lg transition-colors cursor-pointer group flex flex-col gap-0.5 ${
                    isActive()
                      ? "bg-blue-600/20 border border-blue-500/40 shadow-sm"
                      : isPast()
                      ? "hover:bg-zinc-900/60 text-zinc-300"
                      : "opacity-60 hover:opacity-90 hover:bg-zinc-900/40 text-zinc-400"
                  }`}
                >
                  <div class="flex items-center justify-between text-[10px] gap-2">
                    <span
                      class={`font-semibold truncate ${getAuthorColor(m.author)}`}
                      title={m.author}
                    >
                      {m.author}
                    </span>
                    <button
                      type="button"
                      class="shrink-0 font-mono text-[9px] px-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700"
                      title="Jump playhead to this chat timestamp"
                    >
                      {formatOffset(m.time_seconds)}
                    </button>
                  </div>

                  <p class="text-[11px] leading-relaxed break-words text-zinc-200">
                    {m.message}
                  </p>
                </div>
              );
            }}
          </For>
        </Show>
      </div>

      {/* Floating Resume Auto-Scroll Button */}
      <Show when={userHasScrolled() && chatReplaySignals.hasChat()}>
        <div class="p-2 border-t border-zinc-800 bg-zinc-900/95 flex justify-center">
          <button
            type="button"
            onClick={resumeAutoScroll}
            class="px-3 py-1 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold flex items-center gap-1.5 shadow-md transition cursor-pointer"
          >
            <ChevronDown size={11} />
            <span>Resume Auto-Scroll</span>
          </button>
        </div>
      </Show>
    </div>
  );
};
export default ChatReplayDrawer;
