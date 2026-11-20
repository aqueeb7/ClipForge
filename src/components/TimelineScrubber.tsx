import { Component, createSignal, createMemo, createEffect, onCleanup, Show, For } from "solid-js";
import { projectSignals } from "../stores/project";
import { timelineSignals } from "../stores/timeline";
import { Film, Scissors, Trash2, RefreshCw, Plus, Split, Sliders } from "./Icons";

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

        {/* Right: Zoom Control */}
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
            height: "76px"
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
          <div class="absolute inset-x-0 top-5 h-7 flex items-center px-0.5">
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

          {/* Track 2: Audio Lane */}
          <div class="absolute inset-x-0 bottom-1 h-4 bg-zinc-900/60 border-t border-zinc-800/80 flex items-center justify-between px-2 text-[9px] font-mono text-zinc-500 pointer-events-none">
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
