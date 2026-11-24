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
  AlertCircle,
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

  const renderedCount = createMemo(
    () => clips().filter((c) => queueSignals.isClipRendered(c.id)).length
  );
  const unrenderedCount = createMemo(() => clips().length - renderedCount());

  const renderedShortsCount = createMemo(
    () => shortClips().filter((s) => queueSignals.isClipRendered(s.id)).length
  );

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
    <div class="rounded-xl border border-zinc-800/80 bg-zinc-950 flex flex-col h-full overflow-hidden select-none">
      {/* Header Bar */}
      <div class="px-4 py-2 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between shrink-0 gap-3">
        {/* Left: Tab Switcher (Stream Parts vs Vertical Shorts) */}
        <div class="flex items-center gap-2">
          <div class="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveTab("parts")}
              class={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeTab() === "parts"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50"
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
              class={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeTab() === "shorts"
                  ? "bg-amber-950/60 text-amber-200 shadow-sm border border-amber-800/60"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Film size={12} class="text-amber-400" />
              <span>9:16 Shorts</span>
              <span class="px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums bg-amber-950/80 border border-amber-800/50 text-amber-300">
                {shortClips().length}
              </span>
            </button>
          </div>
        </div>

        {/* Right: Controls based on active tab */}
        <Show
          when={activeTab() === "parts"}
          fallback={
            /* Shorts Controls */
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleAddQuickShort}
                class="px-2.5 py-1 bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 rounded text-xs font-medium cursor-pointer transition flex items-center gap-1.5 border border-amber-800/60 shadow-sm"
                title="Create custom short (uses timeline In/Out markers if set)"
              >
                <Plus size={12} class="text-amber-400" />
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
                  class="px-2.5 py-1 bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 rounded text-xs font-medium cursor-pointer transition flex items-center gap-1.5 border border-blue-800/60 shadow-sm"
                  title="Open Publishing Hub for rendered shorts"
                >
                  <Share size={12} />
                  <span>Publish Hub</span>
                </button>
              </Show>
            </div>
          }
        >
          {/* Episodic Parts Global Batch Render Controls */}
          <Show when={clips().length > 0}>
            <div class="flex items-center gap-1.5">
              <Show when={renderedCount() > 0}>
                <button
                  type="button"
                  onClick={() => {
                    const targetClip = clips().find((c) => queueSignals.isClipRendered(c.id)) || clips()[0];
                    if (targetClip) props.onPublishClip?.(targetClip);
                  }}
                  class="px-2.5 py-1 bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 rounded text-xs font-medium cursor-pointer transition flex items-center gap-1.5 border border-blue-800/60 shadow-sm"
                  title="Open Publishing Hub for rendered clips"
                >
                  <Share size={12} />
                  <span>Publish Hub</span>
                </button>
              </Show>

              <Show when={unrenderedCount() > 0 && renderedCount() > 0}>
                <button
                  type="button"
                  onClick={handleExportRemaining}
                  disabled={queueSignals.isExporting()}
                  class="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-medium cursor-pointer transition flex items-center gap-1.5 border border-zinc-700"
                >
                  <Download size={12} />
                  <span>Render Remaining ({unrenderedCount()})</span>
                </button>
              </Show>

              <button
                type="button"
                onClick={handleStartExport}
                disabled={queueSignals.isExporting()}
                class="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 shadow-sm"
              >
                <Download size={12} />
                <span>{queueSignals.isExporting() ? "Rendering..." : "Render All"}</span>
              </button>
            </div>
          </Show>
        </Show>
      </div>

      {/* Main Container */}
      <div class="flex-1 overflow-y-auto min-h-0 divide-y divide-zinc-900">
        <Show
          when={activeTab() === "parts"}
          fallback={
            /* Vertical Shorts List */
            <Show
              when={shortClips().length > 0}
              fallback={
                <div class="flex flex-col items-center justify-center h-full p-8 text-center text-zinc-500 text-xs gap-2">
                  <Film size={22} class="text-zinc-600" />
                  <span class="font-semibold text-zinc-400">No vertical shorts created yet</span>
                  <p class="text-[10px] text-zinc-500 max-w-sm">
                    Click <span class="text-amber-400 font-semibold">+ Create Short</span> above or use the Studio Preview selection tool to isolate viral moments and stack video frames into 9:16 vertical shorts.
                  </p>
                </div>
              }
            >
              <For each={shortClips()}>
                {(short, idx) => {
                  const clip = () => shortToClip(short, idx());
                  const queueItem = () => getActiveQueueItem(short.id);
                  const isRendered = () => queueSignals.isClipRendered(short.id);
                  const renderedInfo = () => queueSignals.getRenderedInfo(short.id);
                  const durationSec = short.end - short.start;
                  const isCurrentlyRendering = () =>
                    queueItem()?.status === "rendering" ||
                    queueSignals.singleRenderingClipId() === short.id;

                  const templateLabel = () => {
                    switch (short.framingTemplate) {
                      case "stacked_split":
                        return "Stacked Split: Cam+Game";
                      case "split_50_50":
                        return "50/50 Split";
                      case "pan_scan":
                        return "Pan & Scan 9:16 Crop";
                      case "blur_fill":
                      default:
                        return "Blur Fill";
                    }
                  };

                  return (
                    <div class="px-4 py-2.5 hover:bg-zinc-900/40 transition flex items-center justify-between gap-3 text-xs">
                      {/* Left: Short Label & Time Range */}
                      <div class="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => playClip(short.start)}
                          class="w-6 h-6 rounded bg-zinc-900 hover:bg-amber-600 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition shrink-0"
                          title="Preview from short start"
                        >
                          <Play size={10} />
                        </button>

                        <div class="min-w-0">
                          <div class="flex items-center gap-2">
                            <span class="font-bold text-amber-200">
                              {short.title || `Short #${idx() + 1}`}
                            </span>
                            <span class="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-800/50 text-amber-300">
                              {templateLabel()}
                            </span>
                          </div>
                          <div class="text-[11px] font-mono text-zinc-500 tabular-nums">
                            {formatTime(short.start)} → {formatTime(short.end)}{" "}
                            <span class="text-zinc-600">({durationSec.toFixed(1)}s)</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div class="flex items-center gap-2 shrink-0">
                        <Show when={isCurrentlyRendering()}>
                          <div class="flex items-center gap-2 text-[11px] font-mono text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded">
                            <RefreshCw size={11} class="animate-spin" />
                            <span>{queueItem()?.progress || 0}%</span>
                          </div>
                        </Show>

                        <Show when={isRendered() && !isCurrentlyRendering()}>
                          <div class="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                            <CheckCircle2 size={11} />
                            <span>Ready</span>
                            <Show when={renderedInfo()?.fileSizeBytes}>
                              <span class="text-emerald-500/80">
                                ({formatFileSize(renderedInfo()!.fileSizeBytes)})
                              </span>
                            </Show>
                          </div>
                        </Show>

                        <Show when={isRendered()}>
                          <button
                            type="button"
                            onClick={() => props.onPublishClip?.(clip())}
                            class="h-7 px-2.5 rounded bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 hover:text-white border border-blue-800/50 text-[11px] font-medium cursor-pointer transition flex items-center gap-1 shadow-sm"
                            title="Publish to YouTube Shorts, Reels, or TikTok"
                          >
                            <Share size={11} />
                            <span>Publish</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenFile(short.id)}
                            class="h-7 px-2.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-[11px] font-medium cursor-pointer transition flex items-center gap-1"
                            title="Show exported file in folder"
                          >
                            <ExternalLink size={11} />
                            <span>Open</span>
                          </button>
                        </Show>

                        <button
                          type="button"
                          disabled={isCurrentlyRendering()}
                          onClick={() => handleRenderSingleShort(short, idx())}
                          class={`h-7 px-2.5 rounded text-[11px] font-medium cursor-pointer transition flex items-center gap-1 ${
                            isRendered()
                              ? "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                              : "bg-amber-600/90 hover:bg-amber-500 text-white shadow-sm font-semibold"
                          }`}
                          title={isRendered() ? "Re-render this short" : "Render 9:16 vertical short"}
                        >
                          <Download size={11} />
                          <span>{isRendered() ? "Re-render" : "Render Short"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => projectSignals.removeShortClip(short.id)}
                          class="w-7 h-7 rounded hover:bg-red-950/50 text-zinc-500 hover:text-red-400 flex items-center justify-center transition cursor-pointer"
                          title="Delete short from timeline"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                }}
              </For>
            </Show>
          }
        >
          {/* Episodic Parts List */}
          <Show
            when={clips().length > 0}
            fallback={
              <div class="flex flex-col items-center justify-center h-full p-8 text-center text-zinc-500 text-xs gap-1.5">
                <span>No clips in manifest</span>
                <span class="text-[10px] text-zinc-600">
                  Load video in Media Pool or click "Divide into Parts" on the timeline
                </span>
              </div>
            }
          >
            <For each={clips()}>
              {(clip) => {
                const queueItem = () => getActiveQueueItem(clip.id);
                const isRendered = () => queueSignals.isClipRendered(clip.id);
                const renderedInfo = () => queueSignals.getRenderedInfo(clip.id);
                const durationSec = clip.sourceEndSeconds - clip.sourceStartSeconds;
                const isCurrentlyRendering = () =>
                  queueItem()?.status === "rendering" ||
                  queueSignals.singleRenderingClipId() === clip.id;

                return (
                  <div class="px-4 py-2.5 hover:bg-zinc-900/40 transition flex items-center justify-between gap-3 text-xs">
                    {/* Left: Part Label & Time Range */}
                    <div class="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => playClip(clip.sourceStartSeconds)}
                        class="w-6 h-6 rounded bg-zinc-900 hover:bg-blue-600 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition shrink-0"
                        title="Play from clip start"
                      >
                        <Play size={10} />
                      </button>

                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-zinc-200">{clip.title}</span>
                          <span class="text-[10px] font-mono text-zinc-500 truncate max-w-[220px]">
                            {clip.outputName}
                          </span>
                        </div>
                        <div class="text-[11px] font-mono text-zinc-500 tabular-nums">
                          {formatTime(clip.sourceStartSeconds)} → {formatTime(clip.sourceEndSeconds)}{" "}
                          <span class="text-zinc-600">({durationSec.toFixed(1)}s)</span>
                        </div>

                        {/* Publishing History Badges */}
                        {(() => {
                          const history = publishHistorySignals.getClipPublishHistory(clip.id);
                          const hasYT = history.some((r) => r.platform === "youtube");
                          const hasInsta = history.some((r) => r.platform === "instagram");
                          const hasTT = history.some((r) => r.platform === "tiktok");
                          const hasStudio = history.some((r) => r.platform === "youtube_studio");
                          const ytRecord = history.find((r) => r.platform === "youtube");

                          if (!hasYT && !hasInsta && !hasTT && !hasStudio) return null;

                          return (
                            <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span class="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">
                                Published:
                              </span>

                              <Show when={hasYT}>
                                <span
                                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950/50 text-red-300 border border-red-800/50 text-[10px] font-medium"
                                  title={`Uploaded to YouTube Shorts${ytRecord?.publishedAt ? ` on ${new Date(ytRecord.publishedAt).toLocaleDateString()}` : ""}`}
                                >
                                  <YouTubeIcon size={10} class="text-red-500" />
                                  <span>Shorts</span>
                                  <Show when={ytRecord?.url}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openBrowserUrl(ytRecord!.url!);
                                      }}
                                      class="hover:text-white ml-0.5 cursor-pointer text-red-400"
                                      title="View on YouTube"
                                    >
                                      <ExternalLink size={9} />
                                    </button>
                                  </Show>
                                </span>
                              </Show>

                              <Show when={hasInsta}>
                                <span
                                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-pink-950/50 text-pink-300 border border-pink-800/50 text-[10px] font-medium"
                                  title="Launched to Instagram Reels"
                                >
                                  <InstagramIcon size={10} class="text-pink-400" />
                                  <span>Reels</span>
                                </span>
                              </Show>

                              <Show when={hasTT}>
                                <span
                                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-950/50 text-cyan-300 border border-cyan-800/50 text-[10px] font-medium"
                                  title="Launched to TikTok Studio"
                                >
                                  <TikTokIcon size={10} class="text-cyan-400" />
                                  <span>TikTok</span>
                                </span>
                              </Show>

                              <Show when={hasStudio}>
                                <span
                                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/50 text-amber-300 border border-amber-800/50 text-[10px] font-medium"
                                  title="Launched to YouTube Studio Web"
                                >
                                  <YouTubeIcon size={10} class="text-amber-500" />
                                  <span>YT Studio</span>
                                </span>
                              </Show>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Right: Status Pill & Actions */}
                    <div class="flex items-center gap-2 shrink-0">
                      {/* Rendering In Progress */}
                      <Show when={isCurrentlyRendering()}>
                        <div class="flex items-center gap-2 text-[11px] font-mono text-blue-400 bg-blue-950/40 border border-blue-800/40 px-2 py-0.5 rounded">
                          <RefreshCw size={11} class="animate-spin" />
                          <span>{queueItem()?.progress || 0}%</span>
                          <Show when={queueItem()?.speed}>
                            <span class="text-zinc-500">({queueItem()?.speed})</span>
                          </Show>
                        </div>
                      </Show>

                      {/* Completed */}
                      <Show when={isRendered() && !isCurrentlyRendering()}>
                        <div class="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                          <CheckCircle2 size={11} />
                          <span>Ready</span>
                          <Show when={renderedInfo()?.fileSizeBytes}>
                            <span class="text-emerald-500/80">
                              ({formatFileSize(renderedInfo()!.fileSizeBytes)})
                            </span>
                          </Show>
                        </div>
                      </Show>

                      {/* Pending */}
                      <Show when={!isRendered() && !isCurrentlyRendering()}>
                        <span class="text-[10px] font-mono text-zinc-500 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                          Queued
                        </span>
                      </Show>

                      {/* Action Buttons */}
                      <Show when={isRendered()}>
                        <button
                          type="button"
                          onClick={() => props.onPublishClip?.(clip)}
                          class="h-7 px-2.5 rounded bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 hover:text-white border border-blue-800/50 text-[11px] font-medium cursor-pointer transition flex items-center gap-1 shadow-sm"
                          title="Publish to YouTube Shorts or launch Instagram/TikTok web uploader"
                        >
                          <Share size={11} />
                          <span>Publish</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenFile(clip.id)}
                          class="h-7 px-2.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-[11px] font-medium cursor-pointer transition flex items-center gap-1"
                          title="Show exported file in folder"
                        >
                          <ExternalLink size={11} />
                          <span>Open</span>
                        </button>
                      </Show>

                      <button
                        type="button"
                        disabled={isCurrentlyRendering()}
                        onClick={() => handleRenderSingleClip(clip)}
                        class={`h-7 px-2.5 rounded text-[11px] font-medium cursor-pointer transition flex items-center gap-1 ${
                          isRendered()
                            ? "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                            : "bg-blue-600/90 hover:bg-blue-600 text-white shadow-sm"
                        }`}
                        title={isRendered() ? "Re-render this clip" : "Render this clip now"}
                      >
                        <Download size={11} />
                        <span>{isRendered() ? "Re-render" : "Render"}</span>
                      </button>
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
