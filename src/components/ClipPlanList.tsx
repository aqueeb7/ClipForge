import { Component, createSignal, createMemo, Show, For } from "solid-js";
import type { Clip, ShortClipItem } from "../types/index.js";
import { projectSignals } from "../stores/project";
import { timelineSignals } from "../stores/timeline";
import { queueSignals } from "../stores/queue";
import { publishHistorySignals } from "../stores/publishHistory";
import { openInExplorer, openBrowserUrl } from "../services/api";
import {
  Play,
  Download,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Share,
  YouTubeIcon,
  InstagramIcon,
  TikTokIcon,
  Plus,
  Trash2,
  Scissors,
  Film
} from "./Icons";

interface ClipPlanListProps {
  onPublishClip?: (clip: Clip) => void;
}

export const ClipPlanList: Component<ClipPlanListProps> = (props) => {
  const manifest = projectSignals.currentManifest;
  const clips = createMemo(() => manifest()?.clips ?? []);
  const project = projectSignals.currentProject;
  const shortClips = projectSignals.shortClips;

  const [activeTab, setActiveTab] = createSignal<"parts" | "shorts">(
    projectSignals.workflowMode() === "shorts" ? "shorts" : "parts"
  );
  const [filter, setFilter] = createSignal<"all" | "ready" | "queued">("all");

  const renderedCount = createMemo(
    () => clips().filter((c) => queueSignals.isClipRendered(c.id)).length
  );
  const unrenderedCount = createMemo(() => clips().length - renderedCount());

  const renderedShortsCount = createMemo(
    () => shortClips().filter((s) => queueSignals.isClipRendered(s.id)).length
  );
  const unrenderedShortsCount = createMemo(() => shortClips().length - renderedShortsCount());

  const filteredClips = createMemo(() => {
    const list = clips();
    if (filter() === "ready") return list.filter((c) => queueSignals.isClipRendered(c.id));
    if (filter() === "queued") return list.filter((c) => !queueSignals.isClipRendered(c.id));
    return list;
  });

  const filteredShorts = createMemo(() => {
    const list = shortClips();
    if (filter() === "ready") return list.filter((s) => queueSignals.isClipRendered(s.id));
    if (filter() === "queued") return list.filter((s) => !queueSignals.isClipRendered(s.id));
    return list;
  });

  // Fast single-pass active clip memo to eliminate 100+ reactive evaluations per frame
  const activeClipId = createMemo(() => {
    const t = timelineSignals.currentTime();
    if (activeTab() === "parts") {
      const found = clips().find((c) => t >= c.sourceStartSeconds && t < c.sourceEndSeconds);
      return found ? found.id : null;
    } else {
      const found = shortClips().find((s) => t >= s.start && t < s.end);
      return found ? found.id : null;
    }
  });

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  function formatFileSize(bytes: number): string {
    if (bytes <= 0) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function playClip(start: number) {
    timelineSignals.setCurrentTime(start);
    timelineSignals.play();
  }

  function shortToClip(short: ShortClipItem, index: number): Clip {
    const projName = project()?.name || "short";
    return {
      id: short.id,
      index: index + 1,
      sourceStartSeconds: short.start,
      sourceEndSeconds: short.end,
      outputName: `${projName.replace(/\s+/g, "_")}_Short_${index + 1}.mp4`,
      title: short.title || `Short #${index + 1}`,
      enabled: true,
      status: "pending"
    };
  }

  async function handleRenderSingleClip(clip: Clip) {
    const proj = project();
    if (!proj) return;
    await queueSignals.renderSingleClip(clip, proj);
  }

  async function handleRenderSingleShort(short: ShortClipItem, index: number) {
    const proj = project();
    if (!proj) return;
    const clip = shortToClip(short, index);
    await queueSignals.renderSingleClip(clip, proj);
  }

  function handleOpenFile(clipId: string) {
    const info = queueSignals.getRenderedInfo(clipId);
    if (info?.outputPath) {
      openInExplorer(info.outputPath);
    }
  }

  function handleStartExport() {
    const proj = project();
    if (!proj || clips().length === 0) return;
    queueSignals.initQueueFromManifest(clips(), proj);
    queueSignals.runExportQueue(proj);
  }

  async function handleExportRemaining() {
    const proj = project();
    if (!proj) return;
    await queueSignals.exportRemainingClips(clips(), proj);
  }

  function handleAddQuickShort() {
    const inp = timelineSignals.inPoint();
    const outp = timelineSignals.outPoint();
    const cur = timelineSignals.currentTime();
    const max = projectSignals.videoMetadata()?.durationSeconds || projectSignals.currentProject()?.sources.video?.durationSeconds || cur + 30;
    const start = inp !== null ? inp : cur;
    const end = outp !== null && outp > start ? outp : Math.min(cur + 30, max);
    const dur = Math.round((end - start) * 10) / 10;
    projectSignals.addShortClip(start, end, {
      title: `Short #${shortClips().length + 1} (${dur}s)`,
      framingTemplate: "stacked_split",
      stacking: { template: "stacked_split", topHeightPercent: 35 }
    });
    timelineSignals.clearMarkers();
  }

  function getActiveQueueItem(clipId: string) {
    return queueSignals.queueItems().find((q) => q.id === clipId);
  }

  return (
    <div class="flex flex-col h-full overflow-hidden select-none bg-zinc-950">
      {/* ===================== CONTROL HEADER HUB ===================== */}
      <div class="p-2.5 pb-2 border-b border-zinc-800/80 bg-zinc-900/60 flex flex-col gap-2 shrink-0">
        {/* Tier 1: Mode Switcher (50 / 50 Balanced Grid) */}
        <div class="grid grid-cols-2 p-0.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("parts")}
            class={`py-1.5 px-3 rounded-md transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab() === "parts"
                ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Scissors size={12} class="text-blue-400" />
            <span>Stream Parts</span>
            <span class="px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums bg-zinc-900 border border-zinc-800 text-zinc-300">
              {clips().length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("shorts")}
            class={`py-1.5 px-3 rounded-md transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab() === "shorts"
                ? "bg-amber-950/70 text-amber-200 shadow-sm border border-amber-800/60 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Film size={12} class="text-amber-400" />
            <span>9:16 Shorts</span>
            <span class="px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums bg-amber-950 border border-amber-800/50 text-amber-300">
              {shortClips().length}
            </span>
          </button>
        </div>

        {/* Tier 2: Filter Pills & Batch Action Toolbar */}
        <div class="flex items-center justify-between gap-1.5 text-xs">
          {/* Filter Pills */}
          <div class="flex items-center gap-0.5 bg-zinc-950 p-0.5 rounded-md border border-zinc-800 text-[10px] shrink-0">
            <button
              type="button"
              onClick={() => setFilter("all")}
              class={`px-2 py-0.5 rounded transition cursor-pointer font-medium whitespace-nowrap ${
                filter() === "all"
                  ? "bg-zinc-800 text-zinc-100 font-semibold"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("ready")}
              class={`px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                filter() === "ready"
                  ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-semibold"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span>Ready</span>
              <span class="font-mono tabular-nums font-bold">
                {activeTab() === "parts" ? renderedCount() : renderedShortsCount()}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilter("queued")}
              class={`px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                filter() === "queued"
                  ? "bg-zinc-800 text-zinc-200 font-semibold"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span>Queued</span>
              <span class="font-mono tabular-nums">
                {activeTab() === "parts" ? unrenderedCount() : unrenderedShortsCount()}
              </span>
            </button>
          </div>

          {/* Action Buttons */}
          <div class="flex items-center gap-1 shrink-0">
            <Show when={activeTab() === "parts"}>
              <Show when={renderedCount() > 0}>
                <button
                  type="button"
                  onClick={() => {
                    const targetClip = clips().find((c) => queueSignals.isClipRendered(c.id)) || clips()[0];
                    if (targetClip) props.onPublishClip?.(targetClip);
                  }}
                  class="px-2 py-1 bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 rounded text-[11px] font-medium cursor-pointer transition flex items-center gap-1 border border-blue-800/60 whitespace-nowrap shrink-0"
                  title="Open Publishing Hub for rendered parts"
                >
                  <Share size={11} />
                  <span>Publish Hub</span>
                </button>
              </Show>

              <Show
                when={unrenderedCount() > 0 && renderedCount() > 0}
                fallback={
                  <button
                    type="button"
                    onClick={handleStartExport}
                    disabled={queueSignals.isExporting() || clips().length === 0}
                    class="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-[11px] font-semibold cursor-pointer transition flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0"
                  >
                    <Download size={11} />
                    <span>{queueSignals.isExporting() ? "Rendering..." : "Render All"}</span>
                  </button>
                }
              >
                <button
                  type="button"
                  onClick={handleExportRemaining}
                  disabled={queueSignals.isExporting()}
                  class="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-[11px] font-semibold cursor-pointer transition flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0"
                  title="Render remaining unrendered clips in background"
                >
                  <Download size={11} />
                  <span>{queueSignals.isExporting() ? "Rendering..." : `Render (${unrenderedCount()})`}</span>
                </button>
              </Show>
            </Show>

            <Show when={activeTab() === "shorts"}>
              <button
                type="button"
                onClick={handleAddQuickShort}
                class="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-semibold cursor-pointer transition flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0"
                title="Create custom vertical short from marked range or playhead"
              >
                <Plus size={11} />
                <span>+ Create Short</span>
              </button>

              <Show when={renderedShortsCount() > 0}>
                <button
                  type="button"
                  onClick={() => {
                    const rendered = shortClips().find((s) => queueSignals.isClipRendered(s.id));
                    if (rendered) {
                      const idx = shortClips().indexOf(rendered);
                      props.onPublishClip?.(shortToClip(rendered, idx));
                    }
                  }}
                  class="px-2 py-1 bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 rounded text-[11px] font-medium cursor-pointer transition flex items-center gap-1 border border-blue-800/60 whitespace-nowrap shrink-0"
                  title="Open Publishing Hub for rendered shorts"
                >
                  <Share size={11} />
                  <span>Publish Hub</span>
                </button>
              </Show>
            </Show>
          </div>
        </div>
      </div>

      {/* ===================== CARDS SCROLL LIST ===================== */}
      <div class="flex-1 overflow-y-auto min-h-0 p-2 space-y-2">
        <Show
          when={activeTab() === "parts"}
          fallback={
            /* ===================== SHORTS CARDS ===================== */
            <Show
              when={filteredShorts().length > 0}
              fallback={
                <div class="flex flex-col items-center justify-center h-48 p-6 text-center text-zinc-500 text-xs gap-2">
                  <Film size={24} class="text-zinc-600" />
                  <span class="font-semibold text-zinc-300">
                    {filter() !== "all" ? `No ${filter()} vertical shorts` : "No vertical shorts created yet"}
                  </span>
                  <p class="text-[11px] text-zinc-500 max-w-xs">
                    {filter() !== "all"
                      ? "Switch filter to 'All' or create shorts from the studio timeline."
                      : "Click '+ Create Short' or mark In/Out points on the timeline to stack video into viral 9:16 clips."}
                  </p>
                </div>
              }
            >
              <For each={filteredShorts()}>
                {(short, idx) => {
                  const clip = () => shortToClip(short, idx());
                  const queueItem = () => getActiveQueueItem(short.id);
                  const isRendered = () => queueSignals.isClipRendered(short.id);
                  const renderedInfo = () => queueSignals.getRenderedInfo(short.id);
                  const durationSec = short.end - short.start;
                  const isCurrentlyRendering = () =>
                    queueItem()?.status === "rendering" ||
                    queueSignals.singleRenderingClipId() === short.id;
                  const isPlayingCurrent = () => activeClipId() === short.id;

                  const templateLabel = () => {
                    switch (short.framingTemplate) {
                      case "stacked_split":
                        return "Cam+Game Split";
                      case "split_50_50":
                        return "50/50 Split";
                      case "pan_scan":
                        return "Pan & Scan";
                      case "blur_fill":
                      default:
                        return "Blur Fill";
                    }
                  };

                  return (
                    <div
                      class={`p-2.5 rounded-lg border transition flex flex-col gap-1.5 ${
                        isPlayingCurrent()
                          ? "bg-amber-950/30 border-amber-500/60 ring-1 ring-amber-500/40 shadow-sm"
                          : "bg-zinc-900/50 hover:bg-zinc-900/90 border-zinc-800/80 hover:border-zinc-700/80"
                      }`}
                    >
                      {/* Row 1: Header - Play + Title + Time + Status */}
                      <div class="flex items-center justify-between gap-2 min-w-0">
                        <div class="flex items-center gap-2 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => playClip(short.start)}
                            class={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition shrink-0 ${
                              isPlayingCurrent()
                                ? "bg-amber-600 text-white shadow-sm"
                                : "bg-zinc-800 hover:bg-amber-600 text-zinc-400 hover:text-white"
                            }`}
                            title="Preview short in studio player"
                          >
                            <Play size={10} />
                          </button>

                          <span class="font-bold font-mono text-amber-200 text-xs px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/50 shrink-0 whitespace-nowrap">
                            {short.title || `Short #${idx() + 1}`}
                          </span>

                          <span class="text-[11px] font-mono text-zinc-400 tabular-nums truncate whitespace-nowrap">
                            {formatTime(short.start)} → {formatTime(short.end)}
                            <span class="text-zinc-500 ml-1">({durationSec.toFixed(1)}s)</span>
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div class="shrink-0">
                          <Show when={isCurrentlyRendering()}>
                            <div class="flex items-center gap-1.5 text-[10px] font-mono text-amber-400 bg-amber-950/70 border border-amber-800/60 px-2 py-0.5 rounded-full">
                              <RefreshCw size={10} class="animate-spin" />
                              <span>{queueItem()?.progress || 0}%</span>
                            </div>
                          </Show>

                          <Show when={isRendered() && !isCurrentlyRendering()}>
                            <div class="flex items-center gap-1 text-[10px] font-mono text-emerald-300 bg-emerald-950/80 border border-emerald-800/70 px-2 py-0.5 rounded-full">
                              <CheckCircle2 size={10} />
                              <span>Ready</span>
                              <Show when={renderedInfo()?.fileSizeBytes}>
                                <span class="opacity-80 font-normal">({formatFileSize(renderedInfo()!.fileSizeBytes)})</span>
                              </Show>
                            </div>
                          </Show>

                          <Show when={!isRendered() && !isCurrentlyRendering()}>
                            <span class="text-[10px] font-mono text-zinc-400 px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700/50">
                              Queued
                            </span>
                          </Show>
                        </div>
                      </div>

                      {/* Row 2: Template Tag + Filename */}
                      <div class="flex items-center gap-2 pl-8 text-[10px] min-w-0">
                        <span class="font-mono uppercase px-1.5 py-0.2 rounded bg-amber-950/50 border border-amber-800/40 text-amber-300 shrink-0 whitespace-nowrap">
                          {templateLabel()}
                        </span>
                        <span class="font-mono text-zinc-500 truncate" title={clip().outputName}>
                          {clip().outputName}
                        </span>
                      </div>

                      {/* Row 3: Action Buttons & Delete */}
                      <div class="flex items-center justify-between gap-2 pt-0.5 pl-8">
                        <div class="flex items-center gap-1 text-[10px] text-zinc-500 font-mono shrink-0 whitespace-nowrap">
                          <span>9:16 Vertical</span>
                        </div>

                        <div class="flex items-center gap-1.5 shrink-0 ml-auto">
                          <Show
                            when={isRendered()}
                            fallback={
                              <button
                                type="button"
                                disabled={isCurrentlyRendering()}
                                onClick={() => handleRenderSingleShort(short, idx())}
                                class="h-6 px-2.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-semibold flex items-center gap-1 transition shadow-sm cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
                                title="Render 9:16 vertical short"
                              >
                                <Download size={10} />
                                <span>Render</span>
                              </button>
                            }
                          >
                            <button
                              type="button"
                              onClick={() => handleOpenFile(short.id)}
                              class="h-6 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-medium flex items-center gap-1 transition cursor-pointer border border-zinc-700/60 shrink-0 whitespace-nowrap"
                              title="Show exported file in folder"
                            >
                              <ExternalLink size={10} />
                              <span>Open</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => props.onPublishClip?.(clip())}
                              class="h-6 px-2.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold flex items-center gap-1 transition shadow-sm cursor-pointer shrink-0 whitespace-nowrap"
                              title="Publish to YouTube Shorts, Reels, or TikTok"
                            >
                              <Share size={10} />
                              <span>Publish</span>
                            </button>

                            <button
                              type="button"
                              disabled={isCurrentlyRendering()}
                              onClick={() => handleRenderSingleShort(short, idx())}
                              class="h-6 px-1.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-[10px] flex items-center gap-1 transition cursor-pointer shrink-0"
                              title="Re-render this short"
                            >
                              <RefreshCw size={10} />
                            </button>
                          </Show>

                          <button
                            type="button"
                            onClick={() => projectSignals.removeShortClip(short.id)}
                            class="w-6 h-6 rounded hover:bg-red-950/50 text-zinc-500 hover:text-red-400 flex items-center justify-center transition cursor-pointer shrink-0"
                            title="Delete short from timeline"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }}
              </For>
            </Show>
          }
        >
          {/* ===================== PARTS CARDS ===================== */}
          <Show
            when={filteredClips().length > 0}
            fallback={
              <div class="flex flex-col items-center justify-center h-48 p-6 text-center text-zinc-500 text-xs gap-2">
                <Scissors size={24} class="text-zinc-600" />
                <span class="font-semibold text-zinc-300">
                  {filter() !== "all" ? `No ${filter()} part clips` : "No clips in manifest"}
                </span>
                <p class="text-[11px] text-zinc-500 max-w-xs">
                  {filter() !== "all"
                    ? "Try switching to 'All' or render clips using the batch render button above."
                    : "Load a stream in the Media Pool or click 'Divide into Parts' on the timeline."}
                </p>
              </div>
            }
          >
            <For each={filteredClips()}>
              {(clip) => {
                const queueItem = () => getActiveQueueItem(clip.id);
                const isRendered = () => queueSignals.isClipRendered(clip.id);
                const renderedInfo = () => queueSignals.getRenderedInfo(clip.id);
                const durationSec = clip.sourceEndSeconds - clip.sourceStartSeconds;
                const isCurrentlyRendering = () =>
                  queueItem()?.status === "rendering" ||
                  queueSignals.singleRenderingClipId() === clip.id;
                const isPlayingCurrent = () => activeClipId() === clip.id;

                return (
                  <div
                    class={`p-2.5 rounded-lg border transition flex flex-col gap-1.5 ${
                      isPlayingCurrent()
                        ? "bg-blue-950/30 border-blue-500/60 ring-1 ring-blue-500/40 shadow-sm"
                        : "bg-zinc-900/50 hover:bg-zinc-900/90 border-zinc-800/80 hover:border-zinc-700/80"
                    }`}
                  >
                    {/* Row 1: Header - Play button + Title + Timecode + Status Badge */}
                    <div class="flex items-center justify-between gap-2 min-w-0">
                      <div class="flex items-center gap-2 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => playClip(clip.sourceStartSeconds)}
                          class={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition shrink-0 ${
                            isPlayingCurrent()
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-zinc-800 hover:bg-blue-600 text-zinc-400 hover:text-white"
                          }`}
                          title="Play from clip start"
                        >
                          <Play size={10} />
                        </button>

                        <span class="font-bold font-mono text-zinc-100 text-xs px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/60 shrink-0 whitespace-nowrap">
                          {clip.title}
                        </span>

                        <span class="text-[11px] font-mono text-zinc-400 tabular-nums truncate whitespace-nowrap">
                          {formatTime(clip.sourceStartSeconds)} → {formatTime(clip.sourceEndSeconds)}
                          <span class="text-zinc-500 ml-1">({durationSec.toFixed(1)}s)</span>
                        </span>
                      </div>

                      {/* Status Badge */}
                      <div class="shrink-0">
                        <Show when={isCurrentlyRendering()}>
                          <div class="flex items-center gap-1.5 text-[10px] font-mono text-blue-400 bg-blue-950/70 border border-blue-800/60 px-2 py-0.5 rounded-full">
                            <RefreshCw size={10} class="animate-spin" />
                            <span>{queueItem()?.progress || 0}%</span>
                          </div>
                        </Show>

                        <Show when={isRendered() && !isCurrentlyRendering()}>
                          <div class="flex items-center gap-1 text-[10px] font-mono text-emerald-300 bg-emerald-950/80 border border-emerald-800/70 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={10} />
                            <span>Ready</span>
                            <Show when={renderedInfo()?.fileSizeBytes}>
                              <span class="opacity-80 font-normal">({formatFileSize(renderedInfo()!.fileSizeBytes)})</span>
                            </Show>
                          </div>
                        </Show>

                        <Show when={!isRendered() && !isCurrentlyRendering()}>
                          <span class="text-[10px] font-mono text-zinc-400 px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700/50">
                            Queued
                          </span>
                        </Show>
                      </div>
                    </div>

                    {/* Row 2: Clean Filename */}
                    <div class="text-[10px] font-mono text-zinc-500 truncate pl-8" title={clip.outputName}>
                      {clip.outputName}
                    </div>

                    {/* Row 3: Action Buttons & Published History */}
                    <div class="flex items-center justify-between gap-2 pt-0.5 pl-8">
                      {/* Left: Published Badges */}
                      <div class="flex items-center gap-1 flex-wrap min-w-0">
                        {(() => {
                          const history = publishHistorySignals.getClipPublishHistory(clip.id);
                          const hasYT = history.some((r) => r.platform === "youtube");
                          const hasInsta = history.some((r) => r.platform === "instagram");
                          const hasTT = history.some((r) => r.platform === "tiktok");
                          const ytRecord = history.find((r) => r.platform === "youtube");

                          if (!hasYT && !hasInsta && !hasTT) return null;

                          return (
                            <div class="flex items-center gap-1 flex-wrap">
                              <Show when={hasYT}>
                                <span
                                  class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-red-950/60 text-red-300 border border-red-800/50 text-[9px] font-medium shrink-0 whitespace-nowrap"
                                  title="Uploaded to YouTube Shorts"
                                >
                                  <YouTubeIcon size={9} class="text-red-500" />
                                  <span>Shorts</span>
                                  <Show when={ytRecord?.url}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openBrowserUrl(ytRecord!.url!);
                                      }}
                                      class="hover:text-white cursor-pointer text-red-400"
                                      title="View on YouTube"
                                    >
                                      <ExternalLink size={8} />
                                    </button>
                                  </Show>
                                </span>
                              </Show>

                              <Show when={hasInsta}>
                                <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-pink-950/60 text-pink-300 border border-pink-800/50 text-[9px] font-medium shrink-0 whitespace-nowrap">
                                  <InstagramIcon size={9} class="text-pink-400" />
                                  <span>Reels</span>
                                </span>
                              </Show>

                              <Show when={hasTT}>
                                <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 text-[9px] font-medium shrink-0 whitespace-nowrap">
                                  <TikTokIcon size={9} class="text-cyan-400" />
                                  <span>TikTok</span>
                                </span>
                              </Show>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Right: Actions */}
                      <div class="flex items-center gap-1.5 shrink-0 ml-auto">
                        <Show
                          when={isRendered()}
                          fallback={
                            <button
                              type="button"
                              disabled={isCurrentlyRendering()}
                              onClick={() => handleRenderSingleClip(clip)}
                              class="h-6 px-2.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold flex items-center gap-1 transition shadow-sm cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
                              title="Render this clip now"
                            >
                              <Download size={10} />
                              <span>Render</span>
                            </button>
                          }
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenFile(clip.id)}
                            class="h-6 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-medium flex items-center gap-1 transition cursor-pointer border border-zinc-700/60 shrink-0 whitespace-nowrap"
                            title="Show exported file in folder"
                          >
                            <ExternalLink size={10} />
                            <span>Open</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => props.onPublishClip?.(clip)}
                            class="h-6 px-2.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold flex items-center gap-1 transition shadow-sm cursor-pointer shrink-0 whitespace-nowrap"
                            title="Publish to YouTube Shorts, Reels, or TikTok"
                          >
                            <Share size={10} />
                            <span>Publish</span>
                          </button>

                          <button
                            type="button"
                            disabled={isCurrentlyRendering()}
                            onClick={() => handleRenderSingleClip(clip)}
                            class="h-6 px-1.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-[10px] flex items-center gap-1 transition cursor-pointer shrink-0"
                            title="Re-render this clip"
                          >
                            <RefreshCw size={10} />
                          </button>
                        </Show>
                      </div>
                    </div>
                  </div>
                );
              }}
            </For>
          </Show>
        </Show>
      </div>
    </div>
  );
};
