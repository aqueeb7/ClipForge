import { Component, createSignal, Show, For } from "solid-js";
import {
  inspectStreamUrl,
  initStreamProject,
  downloadStreamAssets,
  cancelStreamDownload,
  openFileDialog,
  type StreamUrlInspection,
  type StreamDownloadProgressPayload,
} from "../services/api";
import { projectSignals } from "../stores/project";
import { chatReplaySignals } from "../stores/chatReplay";
import {
  YouTubeIcon,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  FolderOpen,
  Film,
  Music,
} from "./Icons";

interface StreamIngestModalProps {
  open: boolean;
  onClose: () => void;
  onStreamLoaded?: () => void;
}

export const StreamIngestModal: Component<StreamIngestModalProps> = (props) => {
  const [url, setUrl] = createSignal("");
  const [isInspecting, setIsInspecting] = createSignal(false);
  const [inspectError, setInspectError] = createSignal<string | null>(null);
  const [inspection, setInspection] = createSignal<StreamUrlInspection | null>(null);

  // Selection state
  const [selectedVideoId, setSelectedVideoId] = createSignal("");
  const [selectedAudioId, setSelectedAudioId] = createSignal("");
  const [includeChat, setIncludeChat] = createSignal(true);
  const [projectName, setProjectName] = createSignal("");
  const [destinationDir, setDestinationDir] = createSignal("./Projects");

  // Download state
  const [isDownloading, setIsDownloading] = createSignal(false);
  const [downloadError, setDownloadError] = createSignal<string | null>(null);
  const [progress, setProgress] = createSignal<StreamDownloadProgressPayload>({
    stage: "idle",
    percentage: 0,
    speed: "--",
    eta: "--",
    message: "Ready",
  });

  async function handleInspect() {
    const raw = url().trim();
    if (!raw) {
      setInspectError("Please enter a valid YouTube livestream or video URL.");
      return;
    }

    setIsInspecting(true);
    setInspectError(null);
    setInspection(null);

    try {
      const res = await inspectStreamUrl(raw);
      setInspection(res);
      setSelectedVideoId(res.recommended_video_id);
      setSelectedAudioId(res.recommended_audio_id);
      setIncludeChat(res.has_chat_replay);

      // Sanitize project name
      const safe = res.title
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/\s+/g, "_")
        .substring(0, 48);
      setProjectName(safe);
    } catch (err: any) {
      setInspectError(err.message || String(err));
    } finally {
      setIsInspecting(false);
    }
  }

  async function handleBrowseDestination() {
    const selected = await openFileDialog({
      title: "Choose Stream Projects Directory",
    });
    if (selected) {
      setDestinationDir(selected);
    }
  }

  async function handleStartDownload() {
    const info = inspection();
    if (!info) return;

    const baseDir = destinationDir().trim() || "./Projects";
    const projName = projectName().trim() || "stream_analysis";

    setIsDownloading(true);
    setDownloadError(null);

    try {
      // 1. Initialize project directory structure
      const layout = await initStreamProject(baseDir, projName);

      // Attach download progress listener from Tauri
      let unlisten: (() => void) | null = null;
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen<StreamDownloadProgressPayload>("download-progress", (e) => {
          setProgress(e.payload);
        });
      } catch (err) {
        console.warn("Could not attach download progress listener:", err);
      }

      // 2. Start streaming download pipeline
      const res = await downloadStreamAssets({
        url: info.url,
        project_dir: layout.project_dir,
        video_format_id: selectedVideoId() || info.recommended_video_id,
        audio_format_id: selectedAudioId() || info.recommended_audio_id,
        download_chat: includeChat() && info.has_chat_replay,
      });

      if (unlisten) unlisten();

      if (res.success && res.video_path) {
        if (layout?.project_dir) {
          projectSignals.setStreamProjectDir(layout.project_dir);
        }

        // Load into ClipForge studio pipeline
        await projectSignals.loadVideoSource(res.video_path);
        if (res.audio_path) {
          await projectSignals.loadAudioSource(res.audio_path);
        }

        // Phase 2 Spec 005 & 006: Auto-normalize canonical timeline and load chat replay
        if (layout?.project_dir) {
          try {
            await chatReplaySignals.loadProjectChat(layout.project_dir);
          } catch (normErr) {
            console.warn("Auto-normalization of stream replay:", normErr);
          }
        }

        props.onStreamLoaded?.();
        props.onClose();
      } else {
        setDownloadError(res.error || "Failed to download stream assets.");
      }
    } catch (err: any) {
      setDownloadError(err.message || String(err));
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleCancel() {
    await cancelStreamDownload();
    setIsDownloading(false);
    setProgress({
      stage: "cancelled",
      percentage: 0,
      speed: "--",
      eta: "--",
      message: "Download cancelled by user",
    });
  }

  function formatDuration(sec: number): string {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${s}s`;
    }
    return `${mins}m ${s}s`;
  }

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
        <div class="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
          {/* Header */}
          <div class="px-5 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-900/60">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                <YouTubeIcon size={18} />
              </div>
              <div>
                <h2 class="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <span>Stream Intelligence Ingest</span>
                  <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
                    Clyptik 2.0
                  </span>
                </h2>
                <p class="text-xs text-zinc-400">
                  Analyze recorded livestreams with synchronized video, audio &amp; chat replay
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={props.onClose}
              disabled={isDownloading()}
              class="text-zinc-400 hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
            >
              <X size={16} />
            </button>
          </div>

          {/* Modal Body */}
          <div class="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Step 1: URL Input */}
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-zinc-300">
                YouTube Livestream / Video URL
              </label>
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  value={url()}
                  onInput={(e) => setUrl(e.currentTarget.value)}
                  disabled={isInspecting() || isDownloading()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isInspecting()) {
                      handleInspect();
                    }
                  }}
                  class="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-red-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleInspect}
                  disabled={isInspecting() || isDownloading()}
                  class="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 shadow-sm shrink-0"
                >
                  <Show when={isInspecting()} fallback={<RefreshCw size={13} />}>
                    <RefreshCw size={13} class="animate-spin" />
                  </Show>
                  <span>{isInspecting() ? "Inspecting..." : "Inspect Stream"}</span>
                </button>
              </div>
            </div>

            <Show when={inspectError()}>
              <div class="p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-xs text-red-300 flex items-start gap-2">
                <AlertCircle size={15} class="shrink-0 mt-0.5 text-red-400" />
                <span>{inspectError()}</span>
              </div>
            </Show>

            {/* Step 2: Stream Metadata & Format Discovery Card */}
            <Show when={inspection()}>
              {(() => {
                const info = inspection()!;
                return (
                  <div class="space-y-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
                    <div class="flex items-start gap-3">
                      <Show when={info.thumbnail_url}>
                        <img
                          src={info.thumbnail_url!}
                          alt={info.title}
                          class="w-28 h-16 object-cover rounded-lg border border-zinc-800 shrink-0"
                        />
                      </Show>
                      <div class="min-w-0 flex-1">
                        <h3 class="text-xs font-bold text-zinc-200 line-clamp-2">
                          {info.title}
                        </h3>
                        <div class="flex items-center gap-2 mt-1 text-[11px] text-zinc-400">
                          <span>{info.channel}</span>
                          <span>•</span>
                          <span class="font-mono">{formatDuration(info.duration_seconds)}</span>
                        </div>
                        <div class="mt-2 flex items-center gap-2">
                          <Show
                            when={info.has_chat_replay}
                            fallback={
                              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] font-medium border border-zinc-700">
                                <span>No Live Chat Replay</span>
                              </span>
                            }
                          >
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 text-[10px] font-medium border border-emerald-800/50">
                              <CheckCircle2 size={11} class="text-emerald-400" />
                              <span>Live Chat Replay Available</span>
                            </span>
                          </Show>
                        </div>
                      </div>
                    </div>

                    {/* Format Selection Dropdowns */}
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-zinc-800/80">
                      <div>
                        <label class="block text-[11px] font-semibold text-zinc-400 mb-1 flex items-center gap-1">
                          <Film size={12} class="text-blue-400" />
                          <span>Video Rendition (Target 2K / 1440p)</span>
                        </label>
                        <select
                          value={selectedVideoId()}
                          onChange={(e) => setSelectedVideoId(e.currentTarget.value)}
                          disabled={isDownloading()}
                          class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-mono"
                        >
                          <For each={info.video_formats}>
                            {(fmt) => (
                              <option value={fmt.format_id}>
                                {fmt.quality_label}
                              </option>
                            )}
                          </For>
                        </select>
                      </div>

                      <div>
                        <label class="block text-[11px] font-semibold text-zinc-400 mb-1 flex items-center gap-1">
                          <Music size={12} class="text-purple-400" />
                          <span>Dedicated Audio Track</span>
                        </label>
                        <select
                          value={selectedAudioId()}
                          onChange={(e) => setSelectedAudioId(e.currentTarget.value)}
                          disabled={isDownloading()}
                          class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-mono"
                        >
                          <For each={info.audio_formats}>
                            {(fmt) => (
                              <option value={fmt.format_id}>
                                {fmt.quality_label}
                              </option>
                            )}
                          </For>
                        </select>
                      </div>
                    </div>

                    {/* Chat Checkbox */}
                    <Show when={info.has_chat_replay}>
                      <div class="pt-2">
                        <label class="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                          <input
                            type="checkbox"
                            checked={includeChat()}
                            onChange={(e) => setIncludeChat(e.currentTarget.checked)}
                            disabled={isDownloading()}
                            class="rounded border-zinc-700 text-red-600 focus:ring-red-500"
                          />
                          <span>Extract historical live chat replay for audience reaction analysis</span>
                        </label>
                      </div>
                    </Show>

                    {/* Project Folder & Destination */}
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-zinc-800/80">
                      <div>
                        <label class="block text-[11px] font-medium text-zinc-400 mb-1">
                          Analysis Project Name
                        </label>
                        <input
                          type="text"
                          value={projectName()}
                          onInput={(e) => setProjectName(e.currentTarget.value)}
                          disabled={isDownloading()}
                          class="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label class="block text-[11px] font-medium text-zinc-400 mb-1">
                          Base Directory
                        </label>
                        <div class="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={destinationDir()}
                            onInput={(e) => setDestinationDir(e.currentTarget.value)}
                            disabled={isDownloading()}
                            class="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500 truncate"
                          />
                          <button
                            type="button"
                            onClick={handleBrowseDestination}
                            disabled={isDownloading()}
                            class="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer transition border border-zinc-700 shrink-0"
                            title="Browse folder"
                          >
                            <FolderOpen size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </Show>

            {/* Download Progress Card */}
            <Show when={isDownloading()}>
              <div class="p-4 rounded-xl border border-blue-900/40 bg-blue-950/20 space-y-2.5">
                <div class="flex items-center justify-between text-xs font-semibold text-blue-300">
                  <span class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                    <span>{progress().message}</span>
                  </span>
                  <span class="font-mono">{progress().percentage.toFixed(1)}%</span>
                </div>

                <div class="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
                  <div
                    class="bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${progress().percentage}%` }}
                  />
                </div>

                <div class="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span>Speed: {progress().speed}</span>
                  <span>ETA: {progress().eta}</span>
                </div>
              </div>
            </Show>

            <Show when={downloadError()}>
              <div class="p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-xs text-red-300 flex items-start gap-2">
                <AlertCircle size={15} class="shrink-0 mt-0.5 text-red-400" />
                <span>{downloadError()}</span>
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div class="px-5 py-3.5 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between shrink-0">
            <span class="text-[11px] text-zinc-500 font-mono">
              Local-first stream synchronization &amp; reaction analysis
            </span>

            <div class="flex items-center gap-2">
              <Show
                when={isDownloading()}
                fallback={
                  <>
                    <button
                      type="button"
                      onClick={props.onClose}
                      class="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleStartDownload}
                      disabled={!inspection()}
                      class="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Download size={13} />
                      <span>Download &amp; Ingest</span>
                    </button>
                  </>
                }
              >
                <button
                  type="button"
                  onClick={handleCancel}
                  class="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-red-400 border border-zinc-700 text-xs font-semibold cursor-pointer transition"
                >
                  Cancel Download
                </button>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};
