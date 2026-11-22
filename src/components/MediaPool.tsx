import { Component, createSignal, createMemo, Show, For } from "solid-js";
import { projectSignals } from "../stores/project";
import { chatReplaySignals } from "../stores/chatReplay";
import { intelligenceSignals } from "../stores/intelligence";
import { openFileDialog, isTauriEnvironment } from "../services/api";
import { getRecentProjects, type RecentProjectItem } from "../services/persistence";
import { Film, Music, Plus, ExternalLink, CheckCircle2, Scissors, ArrowRight, YouTubeIcon, MessageSquare, Flame, Sparkles, RefreshCw } from "./Icons";
import { StreamIngestModal } from "./StreamIngestModal";

export const MediaPool: Component = () => {
  let fileInputRef: HTMLInputElement | undefined;
  let audioFileInputRef: HTMLInputElement | undefined;

  const [isDraggingOver, setIsDraggingOver] = createSignal(false);
  const [showStreamModal, setShowStreamModal] = createSignal(false);
  const recents = createMemo(() => getRecentProjects());

  const videoMeta = projectSignals.videoMetadata;
  const audioMeta = projectSignals.audioMetadata;
  const project = projectSignals.currentProject;

  function formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  async function handleBrowseVideo() {
    if (isTauriEnvironment()) {
      const selected = await openFileDialog({
        title: "Select Gameplay Video File",
        filters: [{ name: "Video Files", extensions: ["mp4", "mkv", "mov", "webm", "avi"] }]
      });
      if (selected) {
        await projectSignals.loadVideoSource(selected);
      }
    } else {
      fileInputRef?.click();
    }
  }

  function handleFileInputChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const blobUrl = URL.createObjectURL(file);
      projectSignals.loadVideoSource(file.name, blobUrl);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      const filePath = (file as unknown as { path?: string }).path || file.name;
      const blobUrl = URL.createObjectURL(file);
      projectSignals.loadVideoSource(filePath, blobUrl);
    }
  }

  async function handleBrowseAudio() {
    if (isTauriEnvironment()) {
      const selected = await openFileDialog({
        title: "Select Dedicated Audio Track",
        filters: [{ name: "Audio Files", extensions: ["weba", "wav", "mp3", "aac", "m4a", "flac", "ogg"] }]
      });
      if (selected) {
        await projectSignals.loadAudioSource(selected);
      }
    } else {
      audioFileInputRef?.click();
    }
  }

  function handleAudioFileInputChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      projectSignals.loadAudioSource(file.name);
    }
  }

  return (
    <div class="h-full flex flex-col gap-4 overflow-y-auto max-w-5xl mx-auto p-4 select-none">
      {/* Hidden File Inputs for Web Fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mkv,.mp4,.mov,.webm"
        class="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={audioFileInputRef}
        type="file"
        accept="audio/*,.weba,.wav,.mp3,.aac,.m4a"
        class="hidden"
        onChange={handleAudioFileInputChange}
      />

      {/* Main Drag & Drop / Active Ingest Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        class={`p-8 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 text-center ${
          isDraggingOver()
            ? "border-blue-500 bg-blue-500/10 scale-[0.99]"
            : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/80"
        }`}
      >
        <div class="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 shadow-sm">
          <Film size={22} />
        </div>

        <div>
          <h2 class="text-sm font-bold text-zinc-100">
            {videoMeta() ? "Source Video Ingested" : "Drag and Drop Gameplay Footage"}
          </h2>
          <p class="text-xs text-zinc-400 mt-1 max-w-md">
            Directly handles 4K, 2K, and 1080p gameplay streams. Accelerated by Intel QuickSync & hardware encoders.
          </p>
        </div>

        <div class="flex items-center gap-2 mt-2 flex-wrap justify-center">
          <button
            type="button"
            onClick={handleBrowseVideo}
            class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer shadow-sm transition flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>{videoMeta() ? "Replace Video File" : "Browse Video File"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowStreamModal(true)}
            class="px-4 py-2 rounded-lg bg-red-600/90 hover:bg-red-600 text-white text-xs font-semibold cursor-pointer shadow-sm transition flex items-center gap-1.5"
            title="Download YouTube livestream with separate audio and historical chat replay"
          >
            <YouTubeIcon size={14} />
            <span>Analyze YouTube Stream</span>
          </button>

          <button
            type="button"
            onClick={handleBrowseAudio}
            class="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium cursor-pointer transition flex items-center gap-1.5"
          >
            <Music size={14} />
            <span>Attach Dedicated Audio (.weba, .wav)</span>
          </button>
        </div>
      </div>

      {/* Ingested Source Cards (Grid) */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Primary Video Card */}
        <div class="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Film size={15} class="text-blue-400" />
              <span class="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Primary Video Stream
              </span>
            </div>
            <Show when={videoMeta()}>
              <span class="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 text-[10px] font-mono font-medium">
                Active
              </span>
            </Show>
          </div>

          <Show
            when={videoMeta()}
            fallback={
              <div class="py-6 text-center text-xs text-zinc-600">
                No video stream loaded
              </div>
            }
          >
            <div class="space-y-2 text-xs">
              <div class="font-medium text-zinc-200 truncate">
                {project()?.sources.video.path.split(/[/\\]/).pop()}
              </div>

              <div class="grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400 pt-2 border-t border-zinc-900">
                <div>
                  <span class="text-zinc-600 block text-[9px] uppercase">Duration</span>
                  <span class="text-zinc-200">{formatTime(videoMeta()?.durationSeconds || 0)}</span>
                </div>
                <div>
                  <span class="text-zinc-600 block text-[9px] uppercase">Resolution</span>
                  <span class="text-zinc-200">{videoMeta()?.width} × {videoMeta()?.height}</span>
                </div>
                <div>
                  <span class="text-zinc-600 block text-[9px] uppercase">Framerate</span>
                  <span class="text-zinc-200">{videoMeta()?.fps || 60} fps</span>
                </div>
                <div>
                  <span class="text-zinc-600 block text-[9px] uppercase">Codec</span>
                  <span class="text-zinc-200">{videoMeta()?.codec}</span>
                </div>
              </div>
            </div>
          </Show>
        </div>

        {/* Dedicated Audio Card */}
        <div class="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Music size={15} class="text-emerald-400" />
              <span class="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Dedicated Audio Track
              </span>
            </div>
            <Show when={project()?.sources.audio}>
              <span class="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 text-[10px] font-mono font-medium">
                Attached
              </span>
            </Show>
          </div>

          <Show
            when={project()?.sources.audio}
            fallback={
              <div class="py-6 text-center text-xs text-zinc-600">
                Optional separate track not loaded (using video embedded audio)
              </div>
            }
          >
            <div class="space-y-2 text-xs">
              <div class="font-medium text-zinc-200 truncate">
                {project()?.sources.audio?.path.split(/[/\\]/).pop()}
              </div>

              <div class="grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400 pt-2 border-t border-zinc-900">
                <div>
                  <span class="text-zinc-600 block text-[9px] uppercase">Duration</span>
                  <span class="text-zinc-200">{formatTime(audioMeta()?.durationSeconds || 0)}</span>
                </div>
                <div>
                  <span class="text-zinc-600 block text-[9px] uppercase">Sync Offset</span>
                  <span class="text-blue-400 font-semibold">{project()?.synchronization.audioOffsetMs || 0} ms</span>
                </div>
              </div>
            </div>
          </Show>
        </div>

        {/* Card 3: Live Chat Replay Stream (Spec 006) */}
        <Show when={chatReplaySignals.hasChat()}>
          <div class="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950 flex flex-col justify-between">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <MessageSquare size={14} />
                </div>
                <span class="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Live Chat Replay
                </span>
              </div>
              <span class="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 text-[10px] font-mono font-medium">
                Synchronized
              </span>
            </div>

            <div class="space-y-2 text-xs pt-3">
              <div class="grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400">
                <div>
                  <span class="text-zinc-600 block text-[9px] uppercase">Total Chat</span>
                  <span class="text-zinc-200">{chatReplaySignals.totalMessages().toLocaleString()} msgs</span>
                </div>
                <div>
                  <span class="text-zinc-600 block text-[9px] uppercase">Peak Velocity</span>
                  <span class="text-amber-400 font-semibold flex items-center gap-1">
                    <Flame size={11} />
                    <span>{chatReplaySignals.peakVelocity().toFixed(1)}/s</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Show>

        {/* Card 4: Offline Multi-Modal Intelligence Highlights (Specs 007 - 010) */}
        <Show when={projectSignals.streamProjectDir()}>
          <div class="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950 flex flex-col justify-between">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Sparkles size={14} />
                </div>
                <span class="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  AI Highlight Intelligence
                </span>
              </div>
              <Show
                when={intelligenceSignals.hasMoments()}
                fallback={
                  <Show when={intelligenceSignals.isAnalyzing()}>
                    <span class="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/40 text-amber-400 text-[10px] font-mono font-medium animate-pulse">
                      Analyzing...
                    </span>
                  </Show>
                }
              >
                <span class="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/40 text-amber-400 text-[10px] font-mono font-medium">
                  {intelligenceSignals.totalMoments()} Moments
                </span>
              </Show>
            </div>

            <div class="space-y-3 text-xs pt-3">
              <Show
                when={intelligenceSignals.hasMoments()}
                fallback={
                  <div class="space-y-2">
                    <p class="text-[11px] text-zinc-500">
                      Fuse chat reaction bursts, audio transients (screams/shouts), and visual scene cuts into synchronized highlight moments.
                    </p>
                    <button
                      type="button"
                      disabled={intelligenceSignals.isAnalyzing()}
                      onClick={() => intelligenceSignals.runIntelligence()}
                      class="w-full py-1.5 px-3 rounded bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 hover:text-white text-xs font-medium cursor-pointer transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Show
                        when={intelligenceSignals.isAnalyzing()}
                        fallback={
                          <>
                            <Sparkles size={12} class="text-amber-400" />
                            <span>Run Multi-Modal Analysis</span>
                          </>
                        }
                      >
                        <RefreshCw size={12} class="animate-spin text-amber-400" />
                        <span>
                          {intelligenceSignals.analysisProgress()?.stage.toUpperCase()}: {intelligenceSignals.analysisProgress()?.percent}%
                        </span>
                      </Show>
                    </button>
                  </div>
                }
              >
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-[11px] font-mono">
                    <span class="text-zinc-500">
                      Top Ranked Shorts ({intelligenceSignals.totalCandidates() || intelligenceSignals.totalMoments()}):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        intelligenceSignals.openCandidatesDrawer();
                        projectSignals.setWorkspaceTab("edit");
                      }}
                      class="text-[10px] text-amber-400 hover:text-amber-300 underline cursor-pointer"
                    >
                      View All Shorts &rarr;
                    </button>
                  </div>
                  <div class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    <Show
                      when={intelligenceSignals.hasCandidates()}
                      fallback={
                        <For each={intelligenceSignals.moments().slice(0, 3)}>
                          {(m) => (
                            <div class="p-1.5 rounded bg-zinc-900/60 border border-zinc-800/60 flex items-center justify-between text-[11px]">
                              <div class="truncate mr-2">
                                <span class="text-amber-300 font-semibold mr-1.5 font-mono text-[10px]">
                                  {(m.confidence * 100).toFixed(0)}%
                                </span>
                                <span class="text-zinc-200">{m.headline}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  intelligenceSignals.addMomentAsClip(m);
                                  projectSignals.setWorkspaceTab("edit");
                                }}
                                class="px-2 py-0.5 rounded bg-zinc-800 hover:bg-amber-600/30 text-zinc-300 hover:text-amber-200 border border-zinc-700 text-[10px] font-mono shrink-0 cursor-pointer transition"
                                title="Add as manual clip to timeline"
                              >
                                + Clip
                              </button>
                            </div>
                          )}
                        </For>
                      }
                    >
                      <For each={intelligenceSignals.candidates().slice(0, 3)}>
                        {(c) => (
                          <div class="p-1.5 rounded bg-zinc-900/60 border border-zinc-800/60 flex items-center justify-between text-[11px]">
                            <div class="truncate mr-2 flex items-center gap-1.5">
                              <span class="px-1 py-0.2 rounded bg-amber-400 text-black font-bold font-mono text-[9px]">
                                #{c.rank}
                              </span>
                              <span class="text-zinc-200 truncate">{c.title}</span>
                              <span class="text-zinc-500 font-mono text-[9px] shrink-0">
                                {c.duration_seconds.toFixed(0)}s
                              </span>
                            </div>
                            <div class="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  intelligenceSignals.addCandidateToProjectPlan(c);
                                  projectSignals.setWorkspaceTab("edit");
                                }}
                                class="px-2 py-0.5 rounded bg-zinc-800 hover:bg-amber-600/30 text-zinc-300 hover:text-amber-200 border border-zinc-700 text-[10px] font-mono cursor-pointer transition"
                                title="Add candidate to project plan"
                              >
                                + Plan
                              </button>
                              <button
                                type="button"
                                onClick={() => intelligenceSignals.exportCandidate(c)}
                                class="px-2 py-0.5 rounded bg-amber-600/30 hover:bg-amber-600 text-amber-200 hover:text-white border border-amber-500/40 text-[10px] font-mono cursor-pointer transition"
                                title="Render 9:16 vertical short"
                              >
                                9:16
                              </button>
                            </div>
                          </div>
                        )}
                      </For>
                    </Show>
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </div>

      {/* Open in Studio Action Bar */}
      <Show when={videoMeta()}>
        <div class="p-4 rounded-xl border border-blue-900/40 bg-blue-950/20 flex items-center justify-between">
          <div>
            <div class="text-xs font-bold text-zinc-200">Media Ingest Ready</div>
            <div class="text-[11px] text-zinc-400">Head to the Studio workspace to trim fluff and slice into vertical parts.</div>
          </div>

          <button
            type="button"
            onClick={() => projectSignals.setWorkspaceTab("edit")}
            class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer shadow-md transition flex items-center gap-1.5"
          >
            <span>Open Studio</span>
            <span class="text-sm">&rarr;</span>
          </button>
        </div>
      </Show>

      {/* Recent Projects Table */}
      <Show when={recents().length > 0}>
        <div class="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Recent Projects
            </span>
            <span class="text-[10px] font-mono text-zinc-600">{recents().length} projects</span>
          </div>

          <div class="divide-y divide-zinc-900 text-xs">
            <For each={recents()}>
              {(item) => (
                <div class="py-2 flex items-center justify-between hover:bg-zinc-900/30 px-2 rounded transition">
                  <div>
                    <div class="font-medium text-zinc-200">{item.name}</div>
                    <div class="text-[10px] font-mono text-zinc-500 truncate max-w-md">
                      {item.filePath}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => projectSignals.openProject(item.filePath)}
                    class="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-medium text-zinc-300 hover:text-white cursor-pointer transition"
                  >
                    Open
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Stream Ingest Modal (ClipForge 2.0 Offline Intelligence Foundation) */}
      <StreamIngestModal
        open={showStreamModal()}
        onClose={() => setShowStreamModal(false)}
        onStreamLoaded={() => {
          projectSignals.setWorkspaceTab("edit");
        }}
      />
    </div>
  );
};
