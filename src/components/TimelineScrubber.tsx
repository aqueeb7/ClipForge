import { Component, createSignal, createMemo, createEffect, onCleanup, Show, For } from "solid-js";
import { projectSignals } from "../stores/project";
import { timelineSignals } from "../stores/timeline";
import { chatReplaySignals } from "../stores/chatReplay";
import { intelligenceSignals } from "../stores/intelligence";
import {
  Film,
  Scissors,
  Trash2,
  RefreshCw,
  Plus,
  Split,
  Sliders,
  MessageSquare,
  Flame,
  Sparkles,
  Type,
  Layers,
  ChevronDown,
} from "./Icons";

export const TimelineScrubber: Component = () => {
  let timelineTrackRef: HTMLDivElement | undefined;
  let scrollContainerRef: HTMLDivElement | undefined;

  const [isDragging, setIsDragging] = createSignal(false);
  const [selectedShortId, setSelectedShortId] = createSignal<string | null>(null);
  const [showWorkflowMenu, setShowWorkflowMenu] = createSignal(false);

  const totalDuration = createMemo(() => projectSignals.videoMetadata()?.durationSeconds || 60);
  const clips = createMemo(() => projectSignals.currentManifest()?.clips ?? []);
  const shorts = createMemo(() => projectSignals.shortClips());
  const composition = createMemo(() => projectSignals.currentProject()?.composition);
  const workflowMode = projectSignals.workflowMode;
  const hasAudioTrack = createMemo(() => Boolean(projectSignals.audioMetadata()));
  const audioOffset = createMemo(() => projectSignals.currentProject()?.synchronization.audioOffsetMs || 0);

  const masterInPercent = createMemo(() => {
    const dur = totalDuration();
    if (dur <= 0) return 0;
    return Math.min(100, Math.max(0, (projectSignals.masterInSeconds() / dur) * 100));
  });

  const masterOutPercent = createMemo(() => {
    const dur = totalDuration();
    const masterOut = projectSignals.masterOutSeconds() || dur;
    if (dur <= 0) return 100;
    return Math.min(100, Math.max(0, (masterOut / dur) * 100));
  });

  const isIntroTrimmed = projectSignals.isIntroTrimmed;
  const isOutroTrimmed = projectSignals.isOutroTrimmed;

  function formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function formatPreciseTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
  }

  function calculateTimeFromEvent(e: MouseEvent): number {
    if (!timelineTrackRef) return 0;
    const rect = timelineTrackRef.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    return ratio * totalDuration();
  }

  function handleTrackClick(e: MouseEvent) {
    const time = calculateTimeFromEvent(e);
    timelineSignals.setCurrentTime(time);
  }

  function startDrag(e: MouseEvent) {
    setIsDragging(true);
    handleTrackClick(e);
    window.addEventListener("mousemove", onDrag);
    window.addEventListener("mouseup", stopDrag);
  }

  function onDrag(e: MouseEvent) {
    if (!isDragging()) return;
    const time = calculateTimeFromEvent(e);
    timelineSignals.setCurrentTime(time);
  }

  function stopDrag() {
    setIsDragging(false);
    window.removeEventListener("mousemove", onDrag);
    window.removeEventListener("mouseup", stopDrag);
  }

  function selectClip(clipId: string, start: number) {
    timelineSignals.selectClip(clipId);
    timelineSignals.setCurrentTime(start);
  }

  function handleCreateQuickShort() {
    const inp = timelineSignals.inPoint();
    const outp = timelineSignals.outPoint();
    const curr = timelineSignals.currentTime();

    const start = inp !== null ? inp : Math.max(0, curr - 5);
    const end = outp !== null && outp > start ? outp : Math.min(totalDuration(), start + 30);
    const dur = Math.round(end - start);
    const title = `Short #${shorts().length + 1} (${dur}s)`;

    projectSignals.addShortClip(start, end, {
      title,
      framingTemplate: composition()?.stacking?.template || "blur_fill",
      stacking: composition()?.stacking,
    });
    timelineSignals.clearMarkers();
  }

  createEffect(() => {
    const time = timelineSignals.currentTime();
    const zoom = timelineSignals.zoomLevel();
    const dur = totalDuration();
    if (zoom > 1 && scrollContainerRef && timelineTrackRef && !isDragging()) {
      const trackWidth = timelineTrackRef.clientWidth;
      const playheadPx = (time / dur) * trackWidth;
      const visibleLeft = scrollContainerRef.scrollLeft;
      const visibleRight = scrollContainerRef.scrollLeft + scrollContainerRef.clientWidth;
      if (playheadPx < visibleLeft + 60 || playheadPx > visibleRight - 60) {
        scrollContainerRef.scrollLeft = playheadPx - scrollContainerRef.clientWidth / 2;
      }
    }
  });

  onCleanup(() => {
    window.removeEventListener("mousemove", onDrag);
    window.removeEventListener("mouseup", stopDrag);
  });

  const playheadPositionPercent = createMemo(() => {
    const dur = totalDuration();
    if (dur <= 0) return 0;
    return Math.min(100, Math.max(0, (timelineSignals.currentTime() / dur) * 100));
  });

  const inPointPercent = createMemo(() => {
    const inp = timelineSignals.inPoint();
    const dur = totalDuration();
    if (inp === null || dur <= 0) return null;
    return Math.min(100, Math.max(0, (inp / dur) * 100));
  });

  const outPointPercent = createMemo(() => {
    const outp = timelineSignals.outPoint();
    const dur = totalDuration();
    if (outp === null || dur <= 0) return null;
    return Math.min(100, Math.max(0, (outp / dur) * 100));
  });

  const hasChat = createMemo(() => chatReplaySignals.hasChat());
  const hasIntelligence = createMemo(() => intelligenceSignals.hasMoments());

  // Dynamic layout offsets for stacked lanes:
  // Ruler: 0 to 18px
  // V1 Video / Parts: 18 to 46px (height 28)
  // S1 Shorts / Highlights: 46 to 74px (height 28)
  // T1 Titles & Brand: 74 to 96px (height 22)
  // F1 Framing & Stacking: 96 to 118px (height 22)
  // C1 Chat (if present): 118 to 142px (height 24)
  // A1 Audio: bottom track (height 20)
  const totalTrackHeight = createMemo(() => {
    let h = 18 + 28 + 28 + 22 + 22 + 20; // 138px base
    if (hasChat()) h += 24;
    if (hasIntelligence()) h += 20;
    return `${h}px`;
  });

  return (
    <div class="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950 flex flex-col gap-2.5 select-none shrink-0 shadow-lg">
      {/* Top Bar: Timeline Stage, Workflow Mode & Trimming Toolbar */}
      <div class="flex items-center justify-between text-xs gap-2 flex-wrap border-b border-zinc-800/80 pb-2">
        {/* Left: Workflow Mode Badge + Stage Selector (Master Stream vs Parts) */}
        <div class="flex items-center gap-2">
          {/* Workflow Mode Pill Selector */}
          <div class="relative">
            <button
              type="button"
              onClick={() => setShowWorkflowMenu(!showWorkflowMenu())}
              class="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:text-white font-mono text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition"
              title="Click to toggle Project Workflow Mode"
            >
              <span>Mode: {workflowMode().toUpperCase()}</span>
              <ChevronDown size={10} />
            </button>

            <Show when={showWorkflowMenu()}>
              <div class="absolute left-0 top-full mt-1 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 z-50 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    projectSignals.setWorkflowMode("hybrid");
                    setShowWorkflowMenu(false);
                  }}
                  class={`w-full px-3 py-1.5 text-left flex flex-col hover:bg-zinc-800 ${
                    workflowMode() === "hybrid" ? "text-blue-400 font-bold" : "text-zinc-300"
                  }`}
                >
                  <span>Hybrid Workstation</span>
                  <span class="text-[9px] text-zinc-500">Both sequential parts & 9:16 shorts</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    projectSignals.setWorkflowMode("episodic");
                    setShowWorkflowMenu(false);
                  }}
                  class={`w-full px-3 py-1.5 text-left flex flex-col hover:bg-zinc-800 ${
                    workflowMode() === "episodic" ? "text-blue-400 font-bold" : "text-zinc-300"
                  }`}
                >
                  <span>Episodic Stream Slicing</span>
                  <span class="text-[9px] text-zinc-500">Sequential Part 1, 2, 3 chapters</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    projectSignals.setWorkflowMode("shorts");
                    setShowWorkflowMenu(false);
                  }}
                  class={`w-full px-3 py-1.5 text-left flex flex-col hover:bg-zinc-800 ${
                    workflowMode() === "shorts" ? "text-blue-400 font-bold" : "text-zinc-300"
                  }`}
                >
                  <span>Highlight Shorts Studio</span>
                  <span class="text-[9px] text-zinc-500">Fast 15s–60s viral short clips</span>
                </button>
              </div>
            </Show>
          </div>

          <div class="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={projectSignals.returnToMasterStream}
              class={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 ${
                projectSignals.isMasterStage()
                  ? "bg-zinc-800 text-zinc-100 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Full stream master trimming and audio alignment"
            >
              <Film size={12} class={projectSignals.isMasterStage() ? "text-amber-400" : ""} />
              <span>1. Master Stream</span>
            </button>

            <button
              type="button"
              onClick={projectSignals.divideIntoParts}
              class={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 ${
                projectSignals.isPartsStage()
                  ? "bg-blue-600 text-white font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Stream sliced into individual part clips"
            >
              <Scissors size={12} />
              <span>2. Part Clips</span>
              <Show when={clips().length > 0}>
                <span class="font-mono text-[10px] opacity-80">({clips().length})</span>
              </Show>
            </button>
          </div>

          <span class="text-[11px] font-mono text-zinc-400 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 tabular-nums">
            Playhead: <strong class="text-zinc-100">{formatPreciseTime(timelineSignals.currentTime())}</strong>
          </span>
        </div>

        {/* Center: Trimming & Split Controls */}
        <div class="flex items-center gap-1.5">
          <Show
            when={projectSignals.isMasterStage()}
            fallback={
              <>
                <button
                  type="button"
                  onClick={() => projectSignals.splitClipAt(timelineSignals.currentTime())}
                  class="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                  title="Split active part clip at playhead (Ctrl+K)"
                >
                  <Scissors size={11} />
                  <span>Split Part</span>
                </button>

                <button
                  type="button"
                  onClick={() => projectSignals.deleteClipAt(timelineSignals.currentTime(), timelineSignals.selectedClipId())}
                  class="px-2.5 py-1 hover:bg-red-950/60 text-zinc-400 hover:text-red-300 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                  title="Delete clip under playhead"
                >
                  <Trash2 size={11} />
                  <span>Delete</span>
                </button>
              </>
            }
          >
            <button
              type="button"
              onClick={() => projectSignals.trimStreamHead(timelineSignals.currentTime())}
              class="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded text-[11px] font-medium transition cursor-pointer"
              title="Trim dead air before playhead (Cut Intro)"
            >
              [ Cut Intro
            </button>

            <button
              type="button"
              onClick={() => projectSignals.trimStreamTail(timelineSignals.currentTime())}
              class="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded text-[11px] font-medium transition cursor-pointer"
              title="Trim dead air after playhead (Cut Outro)"
            >
              Cut Outro ]
            </button>

            <Show when={isIntroTrimmed() || isOutroTrimmed()}>
              <button
                type="button"
                onClick={projectSignals.resetMasterTrim}
                class="px-2 py-1 text-zinc-500 hover:text-zinc-300 rounded text-[11px] font-medium transition cursor-pointer"
                title="Reset trim bounds"
              >
                Reset
              </button>
            </Show>

            <div class="h-3 w-px bg-zinc-800 mx-1" />

            <button
              type="button"
              onClick={projectSignals.divideIntoParts}
              class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold tracking-wide transition cursor-pointer flex items-center gap-1 shadow-sm"
              title="Divide stream into parts"
            >
              <span>Divide into Parts &rarr;</span>
            </button>
          </Show>

          {/* Quick Create Short button on toolbar */}
          <button
            type="button"
            onClick={handleCreateQuickShort}
            class="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shadow-sm"
            title="Create a 30s short on the dedicated S1 track"
          >
            <Plus size={11} />
            <span>+ 30s Short</span>
          </button>
        </div>

        {/* Right Section: Multi-Modal Intelligence, Chat & Zoom Controls */}
        <div class="flex items-center gap-2">
          {/* Multi-Modal Highlight Intelligence */}
          <Show
            when={intelligenceSignals.isAnalyzing()}
            fallback={
              <Show
                when={intelligenceSignals.hasMoments()}
                fallback={
                  <Show when={projectSignals.streamProjectDir()}>
                    <button
                      type="button"
                      onClick={() => intelligenceSignals.runIntelligence()}
                      class="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-amber-300 rounded text-[11px] font-medium border border-zinc-800 transition cursor-pointer flex items-center gap-1.5"
                      title="Run offline multi-modal intelligence"
                    >
                      <Sparkles size={11} class="text-amber-400" />
                      <span>AI Highlights</span>
                    </button>
                  </Show>
                }
              >
                <button
                  type="button"
                  onClick={() => intelligenceSignals.toggleCandidatesDrawer()}
                  class={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 shadow-sm ${
                    intelligenceSignals.isCandidatesDrawerOpen()
                      ? "bg-amber-500 text-black font-semibold shadow-amber-500/20"
                      : "bg-amber-950/60 border border-amber-700/60 text-amber-300 hover:text-white"
                  }`}
                  title="Toggle Ranked Highlight Candidates Drawer"
                >
                  <Sparkles size={11} class={intelligenceSignals.isCandidatesDrawerOpen() ? "text-black" : "text-amber-400"} />
                  <span>{intelligenceSignals.totalCandidates() || intelligenceSignals.totalMoments()} Highlights</span>
                </button>
              </Show>
            }
          >
            <div class="px-2.5 py-1 rounded text-[11px] font-medium bg-zinc-900 border border-zinc-800 text-amber-300 flex items-center gap-1.5">
              <RefreshCw size={11} class="animate-spin text-amber-400" />
              <span>Analyzing... {intelligenceSignals.analysisProgress()?.percent ?? 0}%</span>
            </div>
          </Show>

          {/* Synchronized Chat Intelligence Button */}
          <Show when={chatReplaySignals.hasChat()}>
            <button
              type="button"
              onClick={() => chatReplaySignals.toggleDrawer()}
              class={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 ${
                chatReplaySignals.isDrawerOpen()
                  ? "bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 font-semibold shadow-sm"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100"
              }`}
              title="Toggle Live Chat Replay Drawer"
            >
              <MessageSquare size={12} class={chatReplaySignals.isDrawerOpen() ? "text-emerald-400" : "text-zinc-400"} />
              <span>Chat Replay</span>
              <span class="font-mono text-[10px] opacity-80">({chatReplaySignals.totalMessages().toLocaleString()})</span>
            </button>
          </Show>

          {/* Zoom Control */}
          <div class="flex items-center gap-1.5 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
            <span class="text-[10px] uppercase font-mono text-zinc-500">Zoom</span>
            <button
              type="button"
              onClick={timelineSignals.zoomOut}
              class="w-4 h-4 text-zinc-400 hover:text-zinc-200 text-xs font-mono cursor-pointer"
              title="Zoom Out"
            >
              -
            </button>
            <input
              type="range"
              min="1"
              max="15"
              step="0.5"
              value={timelineSignals.zoomLevel()}
              onInput={(e) => timelineSignals.setZoomLevel(Number((e.target as HTMLInputElement).value))}
              class="w-16 h-1 bg-zinc-800 rounded accent-blue-500 cursor-pointer"
            />
            <button
              type="button"
              onClick={timelineSignals.zoomIn}
              class="w-4 h-4 text-zinc-400 hover:text-zinc-200 text-xs font-mono cursor-pointer"
              title="Zoom In"
            >
              +
            </button>
            <span class="text-[10px] font-mono text-zinc-400 w-6 text-center tabular-nums">
              {timelineSignals.zoomLevel().toFixed(0)}x
            </span>
            <Show when={timelineSignals.zoomLevel() > 1}>
              <button
                type="button"
                onClick={timelineSignals.resetZoom}
                class="text-[10px] font-mono text-blue-400 hover:text-blue-300 ml-1 cursor-pointer"
              >
                Fit
              </button>
            </Show>
          </div>
        </div>
      </div>

      {/* Horizontal Multi-Track Timeline Scroll Area */}
      <div
        ref={scrollContainerRef}
        class="w-full overflow-x-auto overflow-y-hidden rounded-lg border border-zinc-800/80 bg-zinc-950"
      >
        <div
          ref={timelineTrackRef}
          class="relative cursor-pointer select-none"
          style={{
            width: `${timelineSignals.zoomLevel() * 100}%`,
            "min-width": "100%",
            height: totalTrackHeight(),
          }}
          onMouseDown={startDrag}
        >
          {/* ===================== ROW 0: TIME RULER ===================== */}
          <div class="absolute inset-x-0 top-0 h-[18px] bg-zinc-900/90 border-b border-zinc-800/80 flex justify-between px-2 text-[9px] font-mono text-zinc-500 pointer-events-none z-10">
            <span>0:00</span>
            <span>{formatTime(totalDuration() * 0.2)}</span>
            <span>{formatTime(totalDuration() * 0.4)}</span>
            <span>{formatTime(totalDuration() * 0.6)}</span>
            <span>{formatTime(totalDuration() * 0.8)}</span>
            <span>{formatTime(totalDuration())}</span>
          </div>

          {/* ===================== ROW 1: TRACK V1 (VIDEO & PARTS) ===================== */}
          <div
            class="absolute inset-x-0 h-[28px] bg-zinc-950/40 border-b border-zinc-800/80 overflow-hidden"
            style={{ top: "18px" }}
          >
            {/* Sticky Track Label */}
            <div class="sticky left-1 top-1 text-[8px] font-mono uppercase tracking-wider text-blue-400 bg-blue-950/90 px-1 rounded border border-blue-800/60 inline-flex items-center gap-1 z-15 pointer-events-none">
              <Film size={9} />
              <span>V1 Video / Parts</span>
            </div>

            {/* Hatched Dead Air Trim Zones */}
            <Show when={isIntroTrimmed() && masterInPercent() > 0}>
              <div
                class="absolute top-0 bottom-0 left-0 bg-red-950/40 border-r border-red-500/60 pointer-events-none z-10 flex items-center justify-center overflow-hidden"
                style={{ width: `${masterInPercent()}%` }}
              >
                <span class="text-[8px] font-mono text-red-400 font-semibold px-1 py-0.2 bg-black/80 rounded">
                  Trimmed Intro
                </span>
              </div>
            </Show>

            <Show when={isOutroTrimmed() && masterOutPercent() < 100}>
              <div
                class="absolute top-0 bottom-0 right-0 bg-red-950/40 border-l border-red-500/60 pointer-events-none z-10 flex items-center justify-center overflow-hidden"
                style={{ left: `${masterOutPercent()}%`, width: `${100 - masterOutPercent()}%` }}
              >
                <span class="text-[8px] font-mono text-red-400 font-semibold px-1 py-0.2 bg-black/80 rounded">
                  Trimmed Outro
                </span>
              </div>
            </Show>

            {/* Master Stream / Sequential Part Clips */}
            <Show
              when={projectSignals.isPartsStage()}
              fallback={
                <div
                  class="absolute top-1 rounded bg-blue-950/60 border border-blue-600/60 h-6 flex items-center justify-between px-2 text-[10px] font-mono text-blue-200 overflow-hidden"
                  style={{
                    left: `${masterInPercent()}%`,
                    width: `${Math.max(1, masterOutPercent() - masterInPercent())}%`,
                  }}
                >
                  <span class="font-semibold text-zinc-100 truncate">Full Stream Master</span>
                  <span class="text-[9px] text-zinc-400">{formatTime(projectSignals.activeStreamDuration())}</span>
                </div>
              }
            >
              <For each={clips()}>
                {(clip, index) => {
                  const isSelected = () => clip.id === timelineSignals.selectedClipId();
                  return (
                    <div
                      class={`absolute top-1 rounded border transition-all flex items-center justify-between px-2 overflow-hidden text-[10px] font-mono cursor-pointer h-6 ${
                        isSelected()
                          ? "bg-blue-600 border-blue-300 text-white font-semibold shadow-md z-20"
                          : index() % 2 === 0
                          ? "bg-zinc-800 border-zinc-700/80 text-zinc-200 hover:bg-zinc-700/80"
                          : "bg-zinc-850 border-zinc-700/70 text-zinc-300 hover:bg-zinc-700/80"
                      }`}
                      style={{
                        left: `${(clip.sourceStartSeconds / totalDuration()) * 100}%`,
                        width: `${Math.max(
                          0.6,
                          ((clip.sourceEndSeconds - clip.sourceStartSeconds) / totalDuration()) * 100
                        )}%`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectClip(clip.id, clip.sourceStartSeconds);
                      }}
                      title={`${clip.title}: ${formatTime(clip.sourceStartSeconds)} - ${formatTime(clip.sourceEndSeconds)}`}
                    >
                      <span class="truncate">{clip.title}</span>
                      <span class="text-[9px] opacity-75 ml-1">
                        {formatTime(clip.sourceEndSeconds - clip.sourceStartSeconds)}
                      </span>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>

          {/* ===================== ROW 2: TRACK S1 (9:16 SHORTS & HIGHLIGHTS) ===================== */}
          <div
            class="absolute inset-x-0 h-[28px] bg-amber-950/10 border-b border-zinc-800/80 overflow-hidden"
            style={{ top: "46px" }}
          >
            {/* Sticky Track Label + Quick Action */}
            <div class="sticky left-1 top-1 text-[8px] font-mono uppercase tracking-wider text-amber-300 bg-amber-950/90 px-1 rounded border border-amber-800/60 inline-flex items-center gap-1 z-15 pointer-events-none">
              <Scissors size={9} />
              <span>S1 9:16 Shorts ({shorts().length})</span>
            </div>

            {/* Shorts Lane Content */}
            <Show
              when={shorts().length > 0}
              fallback={
                <div class="absolute inset-x-0 top-1.5 flex items-center justify-center text-[9px] font-mono text-zinc-600 border border-dashed border-zinc-800/60 rounded h-5 mx-24 pointer-events-none">
                  <span>+ Create Short (30s vertical clips will populate this dedicated lane)</span>
                </div>
              }
            >
              <For each={shorts()}>
                {(short) => {
                  const isSelected = () => short.id === selectedShortId();
                  const leftPct = () => (short.start / totalDuration()) * 100;
                  const widthPct = () => Math.max(0.8, ((short.end - short.start) / totalDuration()) * 100);

                  return (
                    <div
                      class={`absolute top-1 rounded border flex items-center justify-between px-2 overflow-hidden text-[10px] font-mono cursor-pointer h-6 transition-all z-20 ${
                        isSelected()
                          ? "bg-amber-500 text-black border-white font-bold shadow-lg shadow-amber-500/40"
                          : "bg-amber-950/80 border-amber-600/70 text-amber-200 hover:bg-amber-900/80"
                      }`}
                      style={{
                        left: `${leftPct()}%`,
                        width: `${widthPct()}%`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        timelineSignals.setCurrentTime(short.start);
                        setSelectedShortId(short.id);
                        timelineSignals.setViewMode("vertical");
                      }}
                      title={`${short.title}: ${formatTime(short.start)} - ${formatTime(short.end)} • Template: ${short.framingTemplate}`}
                    >
                      <div class="flex items-center gap-1 truncate">
                        <span class="truncate">✂️ {short.title}</span>
                      </div>
                      <div class="flex items-center gap-1 shrink-0 ml-1">
                        <span class="text-[9px] px-1 rounded bg-black/40 text-amber-300 font-mono">
                          {short.duration.toFixed(0)}s
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            projectSignals.removeShortClip(short.id);
                          }}
                          class="hover:text-red-400 p-0.5"
                          title="Remove short"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>

          {/* ===================== ROW 3: TRACK T1 (TITLES & TEXT OVERLAYS) ===================== */}
          <div
            class="absolute inset-x-0 h-[22px] bg-sky-950/15 border-b border-zinc-800/80 overflow-hidden"
            style={{ top: "74px" }}
          >
            <div class="sticky left-1 top-0.5 text-[8px] font-mono uppercase tracking-wider text-sky-400 bg-sky-950/90 px-1 rounded border border-sky-800/60 inline-flex items-center gap-1 z-15 pointer-events-none">
              <Type size={9} />
              <span>T1 Titles</span>
            </div>

            <Show when={composition()?.overlay?.enabled}>
              <div
                class="absolute top-1 h-4 rounded bg-sky-950/80 border border-sky-700/60 flex items-center px-2 text-[9px] font-mono text-sky-200 truncate pointer-events-none"
                style={{
                  left: `${masterInPercent()}%`,
                  width: `${Math.max(2, masterOutPercent() - masterInPercent())}%`,
                }}
              >
                <span class="truncate">🏷️ {composition()?.overlay?.brandTitle || "CLIPFORGE"} • {composition()?.overlay?.episodeLabel || "PART"} #Shorts</span>
              </div>
            </Show>
          </div>

          {/* ===================== ROW 4: TRACK F1 (FRAMING & STACKING STYLE) ===================== */}
          <div
            class="absolute inset-x-0 h-[22px] bg-purple-950/15 border-b border-zinc-800/80 overflow-hidden"
            style={{ top: "96px" }}
          >
            <div class="sticky left-1 top-0.5 text-[8px] font-mono uppercase tracking-wider text-purple-400 bg-purple-950/90 px-1 rounded border border-purple-800/60 inline-flex items-center gap-1 z-15 pointer-events-none">
              <Layers size={9} />
              <span>F1 Framing</span>
            </div>

            <div
              class="absolute top-1 h-4 rounded bg-purple-950/80 border border-purple-700/60 flex items-center px-2 text-[9px] font-mono text-purple-200 truncate pointer-events-none"
              style={{
                left: `${masterInPercent()}%`,
                width: `${Math.max(2, masterOutPercent() - masterInPercent())}%`,
              }}
            >
              <span class="truncate">
                📐 {composition()?.stacking?.template === "stacked_split"
                  ? `Stacked Split (Cam ${composition()?.stacking?.topHeightPercent || 35}% + Game ${100 - (composition()?.stacking?.topHeightPercent || 35)}%)`
                  : composition()?.stacking?.template === "split_50_50"
                  ? "50/50 Dual Zone Split"
                  : composition()?.stacking?.template === "pan_scan"
                  ? `Pan & Scan 9:16 Crop (${((composition()?.stacking?.cropRegion?.x ?? 21.875) + 28.125).toFixed(0)}%)`
                  : "Blur Fill (9:16 Letterbox)"}
              </span>
            </div>
          </div>

          {/* ===================== ROW 5: TRACK C1 (LIVE CHAT HEATMAP) ===================== */}
          <Show when={hasChat()}>
            <div
              class="absolute inset-x-0 h-[24px] bg-zinc-950/80 border-b border-zinc-800/80 overflow-hidden"
              style={{ top: "118px" }}
            >
              <div class="sticky left-1 top-0.5 text-[8px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-950/90 px-1 rounded border border-emerald-800/60 inline-flex items-center gap-1 z-15 pointer-events-none">
                <MessageSquare size={9} />
                <span>C1 Chat Spikes</span>
              </div>

              {/* Bucket Bars */}
              <div class="absolute inset-0 flex items-end">
                <For each={chatReplaySignals.densityBuckets5s()}>
                  {(b) => {
                    const peak = () => chatReplaySignals.peakVelocity() || 1;
                    const ratio = () => Math.min(1, b.velocity / peak());
                    const heightPx = () => Math.max(2, Math.round(ratio() * 18));
                    const isHigh = () => ratio() >= 0.65;
                    const isMed = () => ratio() >= 0.35 && ratio() < 0.65;

                    return (
                      <div
                        class={`transition-opacity hover:opacity-100 cursor-pointer ${
                          isHigh()
                            ? "bg-red-500 opacity-90 shadow-sm shadow-red-500/50"
                            : isMed()
                            ? "bg-amber-400 opacity-80"
                            : "bg-sky-500/60 opacity-60"
                        }`}
                        style={{
                          position: "absolute",
                          left: `${(b.bin_start / totalDuration()) * 100}%`,
                          width: `${Math.max(0.15, (5.0 / totalDuration()) * 100)}%`,
                          height: `${heightPx()}px`,
                          bottom: "1px",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          timelineSignals.setCurrentTime(b.bin_start);
                        }}
                        title={`${formatTime(b.bin_start)} • ${b.count} msgs (${b.velocity.toFixed(1)} msg/s)`}
                      />
                    );
                  }}
                </For>
              </div>
            </div>
          </Show>

          {/* ===================== ROW 6: TRACK A1 (AUDIO LANE) ===================== */}
          <div
            class="absolute inset-x-0 bottom-0 bg-zinc-900/60 border-t border-zinc-800/80 flex items-center justify-between px-2 text-[9px] font-mono text-zinc-500 pointer-events-none h-[20px]"
          >
            <span class="text-zinc-400 flex items-center gap-1">
              <span>[A1] Audio Track</span>
              <Show when={hasAudioTrack()}>
                <span class="text-emerald-400">
                  • Dedicated Stream ({audioOffset() >= 0 ? "+" : ""}{audioOffset()}ms)
                </span>
              </Show>
            </span>
            <span class="text-zinc-500">{formatTime(totalDuration())}</span>
          </div>

          {/* In/Out Selection Range Overlay */}
          <Show
            when={
              inPointPercent() !== null &&
              outPointPercent() !== null &&
              outPointPercent()! > inPointPercent()!
            }
          >
            <div
              class="absolute top-4 bottom-0 bg-blue-500/15 border-l-2 border-r-2 border-blue-400 pointer-events-none z-25"
              style={{
                left: `${inPointPercent()}%`,
                width: `${outPointPercent()! - inPointPercent()!}%`,
              }}
            />
          </Show>

          {/* Red Playhead Line Sweeping Across All Tracks */}
          <div
            class="absolute top-0 bottom-0 w-[2px] bg-red-500 pointer-events-none z-30 shadow-md"
            style={{ left: `${playheadPositionPercent()}%` }}
          >
            <div class="w-3 h-3 bg-red-500 rounded-full -ml-[5px] -mt-[2px] border-2 border-white shadow-sm" />
          </div>
        </div>
      </div>
    </div>
  );
};
