import { Component, createSignal, createMemo, createEffect, onCleanup, Show, For } from "solid-js";
import { projectSignals } from "../stores/project";
import { timelineSignals } from "../stores/timeline";
import { chatReplaySignals } from "../stores/chatReplay";
import { intelligenceSignals } from "../stores/intelligence";
import { Film, Scissors, Trash2, RefreshCw, Plus, Split, Sliders, MessageSquare, Flame, Sparkles } from "./Icons";

export const TimelineScrubber: Component = () => {
  let timelineTrackRef: HTMLDivElement | undefined;
  let scrollContainerRef: HTMLDivElement | undefined;

  const [isDragging, setIsDragging] = createSignal(false);

  const totalDuration = createMemo(() => projectSignals.videoMetadata()?.durationSeconds || 60);
  const clips = createMemo(() => projectSignals.currentManifest()?.clips ?? []);
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

  return (
    <div class="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950 flex flex-col gap-2.5 select-none shrink-0">
      {/* Top Bar: Timeline Stage & Trimming Toolbar */}
      <div class="flex items-center justify-between text-xs gap-2 flex-wrap border-b border-zinc-800/80 pb-2">
        {/* Left: Stage Selector (Master Stream vs Parts) */}
        <div class="flex items-center gap-2">
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

        {/* Center: Trimming Controls */}
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
                  <span>Split</span>
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
        </div>

        {/* Right Section: Multi-Modal Intelligence, Chat Replay Status & Zoom Controls */}
        <div class="flex items-center gap-2">
          {/* Multi-Modal Highlight Intelligence (Specs 007 - 010) */}
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
                      title="Run offline multi-modal intelligence (chat velocity, audio energy, visual cuts)"
                    >
                      <Sparkles size={11} class="text-amber-400" />
                      <span>AI Highlights</span>
                    </button>
                  </Show>
                }
              >
                <button
                  type="button"
                  onClick={() => {
                    const first = intelligenceSignals.momentsChronological()[0];
                    if (first) intelligenceSignals.selectMoment(first);
                  }}
                  class="px-2.5 py-1 rounded text-[11px] font-medium bg-amber-950/60 border border-amber-700/60 text-amber-300 hover:text-white transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title="Jump to detected multi-modal highlight moments"
                >
                  <Sparkles size={11} class="text-amber-400" />
                  <span>{intelligenceSignals.totalMoments()} Highlights</span>
                </button>
              </Show>
            }
          >
            <div class="px-2.5 py-1 rounded text-[11px] font-medium bg-zinc-900 border border-zinc-800 text-amber-300 flex items-center gap-1.5">
              <RefreshCw size={11} class="animate-spin text-amber-400" />
              <span>
                {intelligenceSignals.analysisProgress()?.stage === "audio"
                  ? "Analyzing Audio..."
                  : intelligenceSignals.analysisProgress()?.stage === "video"
                  ? "Detecting Scenes..."
                  : intelligenceSignals.analysisProgress()?.stage === "chat"
                  ? "Analyzing Chat..."
                  : "Correlating Highlights..."}
                {" "}
                {intelligenceSignals.analysisProgress()?.percent ?? 0}%
              </span>
            </div>
          </Show>

          {/* Synchronized Chat Intelligence Button */}
          <Show
            when={chatReplaySignals.hasChat()}
            fallback={
              <Show when={projectSignals.streamProjectDir()}>
                <button
                  type="button"
                  onClick={() => chatReplaySignals.loadProjectChat(projectSignals.streamProjectDir()!)}
                  disabled={chatReplaySignals.isLoading()}
                  class="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-[11px] font-medium border border-zinc-800 transition cursor-pointer flex items-center gap-1.5"
                  title="Normalize canonical timeline & load chat replay"
                >
                  <RefreshCw size={11} class={chatReplaySignals.isLoading() ? "animate-spin text-blue-400" : "text-zinc-400"} />
                  <span>Sync Chat</span>
                </button>
              </Show>
            }
          >
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
              <Show when={chatReplaySignals.peakVelocity() > 0}>
                <span class="flex items-center gap-0.5 text-[10px] text-amber-400 font-mono ml-0.5">
                  <Flame size={10} />
                  <span>{chatReplaySignals.peakVelocity().toFixed(1)}/s</span>
                </span>
              </Show>
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
            height: intelligenceSignals.hasMoments() && chatReplaySignals.hasChat()
              ? "118px"
              : intelligenceSignals.hasMoments() || chatReplaySignals.hasChat()
              ? "96px"
              : "76px",
          }}
          onMouseDown={startDrag}
        >
          {/* Time Ruler */}
          <div class="absolute inset-x-0 top-0 h-4 bg-zinc-900/90 border-b border-zinc-800/80 flex justify-between px-2 text-[9px] font-mono text-zinc-500 pointer-events-none z-10">
            <span>0:00</span>
            <span>{formatTime(totalDuration() * 0.25)}</span>
            <span>{formatTime(totalDuration() * 0.5)}</span>
            <span>{formatTime(totalDuration() * 0.75)}</span>
            <span>{formatTime(totalDuration())}</span>
          </div>

          {/* Track: Multi-Modal Highlight Moments (Spec 010) */}
          <Show when={intelligenceSignals.hasMoments()}>
            <div
              class="absolute inset-x-0 h-[20px] bg-amber-950/20 border-b border-amber-900/30 overflow-hidden pointer-events-none z-12"
              style={{ top: "16px" }}
            >
              <div class="absolute left-2 top-0.5 text-[8px] font-mono text-amber-400/80 uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={9} class="text-amber-400" />
                <span>H1 Highlights ({intelligenceSignals.totalMoments()})</span>
              </div>
            </div>

            {/* Highlight Pins & Clip Intervals */}
            <For each={intelligenceSignals.momentsChronological()}>
              {(moment) => {
                const isSelected = () => intelligenceSignals.selectedMomentId() === moment.id;
                const leftPct = () => (moment.timestamp / totalDuration()) * 100;
                const leadInPct = () => (moment.lead_in / totalDuration()) * 100;
                const widthPct = () => Math.max(0.5, ((moment.lead_out - moment.lead_in) / totalDuration()) * 100);

                return (
                  <>
                    {/* Interval Range Ribbon */}
                    <div
                      class={`absolute h-[18px] pointer-events-none rounded transition-opacity z-15 ${
                        isSelected()
                          ? "bg-amber-400/25 border-l-2 border-r-2 border-amber-400"
                          : "bg-amber-500/10 hover:bg-amber-500/20"
                      }`}
                      style={{
                        top: "17px",
                        left: `${leadInPct()}%`,
                        width: `${widthPct()}%`,
                      }}
                    />

                    {/* Diamond Anchor Marker */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        intelligenceSignals.selectMoment(moment);
                      }}
                      class={`absolute w-3 h-3 -ml-1.5 top-[19px] rotate-45 transition-transform hover:scale-125 cursor-pointer z-25 ${
                        isSelected()
                          ? "bg-amber-300 border-2 border-white shadow-lg shadow-amber-400/50 scale-125"
                          : moment.confidence >= 0.8
                          ? "bg-amber-400 border border-amber-200 shadow-sm"
                          : "bg-yellow-500 border border-yellow-300 opacity-80"
                      }`}
                      style={{ left: `${leftPct()}%` }}
                      title={`${moment.headline} • ${(moment.confidence * 100).toFixed(0)}% Conf • ${moment.sentiment}`}
                    />
                  </>
                );
              }}
            </For>
          </Show>

          {/* Hatched Dead Air Trim Zones */}
          <Show when={isIntroTrimmed() && masterInPercent() > 0}>
            <div
              class="absolute top-4 bottom-0 left-0 bg-red-950/30 border-r border-red-500/60 pointer-events-none z-15 flex items-center justify-center overflow-hidden"
              style={{ width: `${masterInPercent()}%` }}
            >
              <span class="text-[9px] font-mono text-red-400 font-semibold px-1 py-0.5 bg-black/80 rounded border border-red-900/40">
                Trimmed Intro
              </span>
            </div>
          </Show>

          <Show when={isOutroTrimmed() && masterOutPercent() < 100}>
            <div
              class="absolute top-4 bottom-0 right-0 bg-red-950/30 border-l border-red-500/60 pointer-events-none z-15 flex items-center justify-center overflow-hidden"
              style={{ left: `${masterOutPercent()}%`, width: `${100 - masterOutPercent()}%` }}
            >
              <span class="text-[9px] font-mono text-red-400 font-semibold px-1 py-0.5 bg-black/80 rounded border border-red-900/40">
                Trimmed Outro
              </span>
            </div>
          </Show>

          {/* In/Out Selection Range Overlay */}
          <Show
            when={
              inPointPercent() !== null &&
              outPointPercent() !== null &&
              outPointPercent()! > inPointPercent()!
            }
          >
            <div
              class="absolute top-4 bottom-0 bg-blue-500/15 border-l border-r border-blue-400 pointer-events-none z-20"
              style={{
                left: `${inPointPercent()}%`,
                width: `${outPointPercent()! - inPointPercent()!}%`
              }}
            />
          </Show>

          {/* Track 1: Video Lane Content */}
          <div
            class="absolute inset-x-0 flex items-center px-0.5"
            style={{
              top: intelligenceSignals.hasMoments() ? "37px" : "16px",
              height: chatReplaySignals.hasChat() ? "26px" : "28px",
            }}
          >
            <Show
              when={projectSignals.isPartsStage()}
              fallback={
                <div
                  class="absolute rounded bg-blue-950/60 border border-blue-600/60 h-6 flex items-center justify-between px-2 text-[10px] font-mono text-blue-200 transition-all overflow-hidden"
                  style={{
                    left: `${masterInPercent()}%`,
                    width: `${Math.max(1, masterOutPercent() - masterInPercent())}%`
                  }}
                >
                  <span class="font-semibold text-zinc-100">Full Stream Master</span>
                  <span class="text-[9px] text-zinc-400">{formatTime(projectSignals.activeStreamDuration())}</span>
                </div>
              }
            >
              <For each={clips()}>
                {(clip, index) => {
                  const isSelected = () => clip.id === timelineSignals.selectedClipId();
                  return (
                    <div
                      class={`absolute rounded border transition-all flex items-center justify-between px-2 overflow-hidden text-[10px] font-mono cursor-pointer h-6 ${
                        isSelected()
                          ? "bg-blue-600 border-blue-300 text-white font-semibold shadow-md z-25"
                          : index() % 2 === 0
                          ? "bg-zinc-800 border-zinc-700/80 text-zinc-200 hover:bg-zinc-700/80"
                          : "bg-zinc-850 border-zinc-700/70 text-zinc-300 hover:bg-zinc-700/80"
                      }`}
                      style={{
                        left: `${(clip.sourceStartSeconds / totalDuration()) * 100}%`,
                        width: `${Math.max(
                          0.6,
                          ((clip.sourceEndSeconds - clip.sourceStartSeconds) / totalDuration()) * 100
                        )}%`
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

          {/* Track 2: Chat Density Heatbar / Waveform (Spec 006) */}
          <Show when={chatReplaySignals.hasChat()}>
            <div
              class="absolute inset-x-0 h-[26px] bg-zinc-950/80 border-t border-b border-zinc-800/60 overflow-hidden"
              style={{ top: intelligenceSignals.hasMoments() ? "64px" : "43px" }}
            >
              <div class="absolute left-2 top-0.5 text-[9px] font-mono text-zinc-500 uppercase tracking-wider pointer-events-none z-10 flex items-center gap-1">
                <span>C1 Chat Replay Heatmap</span>
                <Show when={chatReplaySignals.peakVelocity() > 0}>
                  <span class="text-amber-400 font-semibold">• Peak {chatReplaySignals.peakVelocity().toFixed(1)}/s</span>
                </Show>
              </div>

              {/* Bucket Bars */}
              <div class="absolute inset-0 flex items-end">
                <For each={chatReplaySignals.densityBuckets5s()}>
                  {(b) => {
                    const peak = () => chatReplaySignals.peakVelocity() || 1;
                    const ratio = () => Math.min(1, b.velocity / peak());
                    const heightPx = () => Math.max(2, Math.round(ratio() * 20));
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

          {/* Track 3: Audio Lane */}
          <div
            class="absolute inset-x-0 bottom-0 bg-zinc-900/60 border-t border-zinc-800/80 flex items-center justify-between px-2 text-[9px] font-mono text-zinc-500 pointer-events-none"
            style={{
              height: chatReplaySignals.hasChat() ? "24px" : "18px",
            }}
          >
            <span class="text-zinc-400">A1 Audio Track</span>
            <Show when={hasAudioTrack()}>
              <span class="text-emerald-400">
                Dedicated Stream ({audioOffset() >= 0 ? "+" : ""}{audioOffset()}ms)
              </span>
            </Show>
          </div>

          {/* Playhead Line */}
          <div
            class="absolute top-0 bottom-0 w-[2px] bg-red-500 pointer-events-none z-30 shadow"
            style={{ left: `${playheadPositionPercent()}%` }}
          >
            <div class="w-2.5 h-2.5 bg-red-500 rounded-full -ml-[4px] -mt-[1px] border border-white" />
          </div>
        </div>
      </div>
    </div>
  );
};
