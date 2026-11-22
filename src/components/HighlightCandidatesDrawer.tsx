import { Component, createSignal, Show, For } from "solid-js";
import { intelligenceSignals } from "../stores/intelligence";
import { projectSignals } from "../stores/project";
import { openInExplorer } from "../services/api";
import {
  Sparkles,
  Flame,
  Search,
  Scissors,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Download,
  X,
  Play,
  Clock,
  Layers,
} from "./Icons";

function formatTime(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.floor(Math.max(0, seconds) % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export const HighlightCandidatesDrawer: Component = () => {
  const [showSettings, setShowSettings] = createSignal(false);

  const candidates = () => intelligenceSignals.filteredCandidates();
  const total = () => intelligenceSignals.totalCandidates();
  const isGenerating = () => intelligenceSignals.isGeneratingCandidates();
  const isExporting = () => intelligenceSignals.isExportingCandidate();
  const exportingId = () => intelligenceSignals.activeExportingCandidateId();

  function handleSetTargetDuration(dur: number) {
    intelligenceSignals.setCandidateSettings((prev) => ({
      ...prev,
      target_duration_seconds: dur,
      max_duration_seconds: dur === 15 ? 20 : dur === 30 ? 45 : 60,
    }));
    intelligenceSignals.generateCandidates();
  }

  async function handleOpenOutputFolder(filePath?: string | null) {
    if (filePath) {
      await openInExplorer(filePath);
    } else {
      const projDir = projectSignals.streamProjectDir();
      if (projDir) {
        await openInExplorer(`${projDir}/highlights/clips`);
      }
    }
  }

  return (
    <div class="h-full flex flex-col bg-zinc-950 border-l border-zinc-800/80 text-zinc-100 select-none shadow-xl z-20">
      {/* Header */}
      <div class="p-3 border-b border-zinc-800/80 flex items-center justify-between gap-2 shrink-0 bg-zinc-900/40">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Sparkles size={13} />
          </div>
          <div>
            <div class="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
              <span>Ranked Highlights</span>
              <span class="px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-700/60 text-amber-300 text-[10px] font-mono">
                {total()}
              </span>
            </div>
            <div class="text-[10px] font-mono text-zinc-500">
              Specs 011 & 012 • 9:16 Shorts
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings())}
            class={`p-1.5 rounded text-xs transition cursor-pointer ${
              showSettings()
                ? "bg-amber-950/60 text-amber-300 border border-amber-700/60"
                : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
            }`}
            title="Configure target clip duration & padding"
          >
            <Clock size={12} />
          </button>

          <button
            type="button"
            onClick={() => intelligenceSignals.closeCandidatesDrawer()}
            class="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-zinc-800 text-xs transition cursor-pointer"
            title="Close Drawer"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Target Duration & Generation Toolbar */}
      <Show when={showSettings()}>
        <div class="p-2.5 bg-zinc-900/60 border-b border-zinc-800/80 text-[11px] space-y-2 shrink-0">
          <div class="flex items-center justify-between">
            <span class="text-zinc-400 font-mono text-[10px] uppercase">Target Duration:</span>
            <div class="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleSetTargetDuration(15)}
                class={`px-2 py-0.5 rounded font-mono text-[10px] cursor-pointer transition ${
                  intelligenceSignals.candidateSettings().target_duration_seconds === 15
                    ? "bg-amber-600 text-white font-semibold"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                15s
              </button>
              <button
                type="button"
                onClick={() => handleSetTargetDuration(30)}
                class={`px-2 py-0.5 rounded font-mono text-[10px] cursor-pointer transition ${
                  intelligenceSignals.candidateSettings().target_duration_seconds === 30
                    ? "bg-amber-600 text-white font-semibold"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                30s
              </button>
              <button
                type="button"
                onClick={() => handleSetTargetDuration(60)}
                class={`px-2 py-0.5 rounded font-mono text-[10px] cursor-pointer transition ${
                  intelligenceSignals.candidateSettings().target_duration_seconds === 60
                    ? "bg-amber-600 text-white font-semibold"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                60s
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between pt-1">
            <button
              type="button"
              disabled={isGenerating()}
              onClick={() => intelligenceSignals.generateCandidates()}
              class="w-full py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-[10px] transition cursor-pointer flex items-center justify-center gap-1 border border-zinc-700"
            >
              <RefreshCw size={10} class={isGenerating() ? "animate-spin text-amber-400" : ""} />
              <span>{isGenerating() ? "Re-clustering..." : "Re-generate Candidates"}</span>
            </button>
          </div>
        </div>
      </Show>

      {/* Quick Action Bar */}
      <div class="p-2 border-b border-zinc-800/80 bg-zinc-950 flex items-center justify-between gap-1.5 shrink-0 text-[10px] font-mono">
        <button
          type="button"
          disabled={isExporting() || total() === 0}
          onClick={() => intelligenceSignals.batchExportTopCandidates(3)}
          class="flex-1 py-1 rounded bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 hover:text-white transition cursor-pointer flex items-center justify-center gap-1 shadow-sm"
          title="Render top 3 ranked highlights into vertical 9:16 MP4s"
        >
          <Download size={10} />
          <span>Batch Render Top 3</span>
        </button>

        <button
          type="button"
          disabled={total() === 0}
          onClick={() => intelligenceSignals.addAllCandidatesToProjectPlan()}
          class="py-1 px-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition cursor-pointer flex items-center justify-center gap-1"
          title="Import all candidate intervals into the project trimming plan"
        >
          <Layers size={10} />
          <span>+ All to Plan</span>
        </button>
      </div>

      {/* Search / Filter Input */}
      <div class="p-2 border-b border-zinc-800/80 bg-zinc-950 shrink-0">
        <div class="relative">
          <input
            type="text"
            placeholder="Filter by keyword or sentiment..."
            value={intelligenceSignals.candidateFilter()}
            onInput={(e) => intelligenceSignals.setCandidateFilter(e.currentTarget.value)}
            class="w-full pl-7 pr-6 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 font-mono"
          />
          <Search size={12} class="absolute left-2 top-2 text-zinc-600" />
          <Show when={intelligenceSignals.candidateFilter()}>
            <button
              type="button"
              onClick={() => intelligenceSignals.setCandidateFilter("")}
              class="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
            >
              <X size={11} />
            </button>
          </Show>
        </div>
      </div>

      {/* Candidate List */}
      <div class="flex-1 overflow-y-auto p-2 space-y-2">
        <Show
          when={candidates().length > 0}
          fallback={
            <div class="py-12 px-4 text-center text-xs text-zinc-600 space-y-2">
              <Sparkles size={20} class="mx-auto text-zinc-700" />
              <p>No candidates available yet.</p>
              <button
                type="button"
                onClick={() => intelligenceSignals.runIntelligence()}
                class="px-3 py-1 rounded bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-600/30 text-[11px] font-mono cursor-pointer transition"
              >
                Run AI Intelligence
              </button>
            </div>
          }
        >
          <For each={candidates()}>
            {(candidate) => {
              const isSelected = () => intelligenceSignals.selectedCandidateId() === candidate.id;
              const isRenderingThis = () => exportingId() === candidate.id;
              const isCompleted = () => candidate.status === "completed";

              return (
                <div
                  class={`p-2.5 rounded-lg border transition-all space-y-2 ${
                    isSelected()
                      ? "bg-amber-950/30 border-amber-500/60 shadow-md"
                      : "bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800/80"
                  }`}
                >
                  {/* Top Row: Rank, Title, Confidence Badge */}
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span
                        class={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                          candidate.rank === 1
                            ? "bg-amber-400 text-black shadow-sm"
                            : candidate.rank === 2
                            ? "bg-zinc-200 text-black"
                            : candidate.rank === 3
                            ? "bg-amber-700/80 text-white"
                            : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                        }`}
                      >
                        #{String(candidate.rank).padStart(2, "0")}
                      </span>

                      <span class="text-xs font-semibold text-zinc-100 truncate" title={candidate.title}>
                        {candidate.title}
                      </span>
                    </div>

                    <span class="px-1.5 py-0.5 rounded bg-zinc-800/90 border border-zinc-700 text-amber-300 text-[10px] font-mono shrink-0 font-medium">
                      {(candidate.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  {/* Metadata Chips: Duration, Hook Indicator, Sentiment */}
                  <div class="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
                    <span class="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                      {formatTime(candidate.start_seconds)} - {formatTime(candidate.end_seconds)} ({candidate.duration_seconds.toFixed(0)}s)
                    </span>

                    <span class="px-1.5 py-0.2 rounded bg-purple-950/60 border border-purple-800/40 text-purple-300">
                      {candidate.sentiment}
                    </span>

                    <Show when={candidate.has_immediate_hook}>
                      <span class="px-1.5 py-0.2 rounded bg-red-950/60 border border-red-800/40 text-red-300 flex items-center gap-0.5">
                        <Flame size={9} class="text-red-400" />
                        <span>Hook</span>
                      </span>
                    </Show>

                    <For each={candidate.top_keywords.slice(0, 3)}>
                      {(kw) => (
                        <span class="px-1 py-0.2 rounded bg-zinc-800/60 text-zinc-400">
                          {kw}
                        </span>
                      )}
                    </For>
                  </div>

                  {/* Action Buttons */}
                  <div class="flex items-center justify-between pt-1 border-t border-zinc-800/60 gap-1.5">
                    <div class="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => intelligenceSignals.previewCandidate(candidate)}
                        class="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-mono cursor-pointer transition flex items-center gap-1"
                        title="Seek playhead to candidate and set In/Out bounds"
                      >
                        <Play size={9} />
                        <span>Preview</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => intelligenceSignals.addCandidateToProjectPlan(candidate)}
                        class="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-mono cursor-pointer transition flex items-center gap-1"
                        title="Add this highlight candidate directly to the project clip plan"
                      >
                        <Scissors size={9} />
                        <span>+ Plan</span>
                      </button>
                    </div>

                    <div>
                      <Show
                        when={isCompleted()}
                        fallback={
                          <button
                            type="button"
                            disabled={isExporting()}
                            onClick={() => intelligenceSignals.exportCandidate(candidate)}
                            class={`px-2.5 py-1 rounded text-[10px] font-mono font-medium cursor-pointer transition flex items-center gap-1 ${
                              isRenderingThis()
                                ? "bg-amber-600/40 text-amber-200 border border-amber-500/50"
                                : "bg-amber-600 hover:bg-amber-500 text-white shadow-sm"
                            }`}
                            title="Render 9:16 vertical short using GPU/FFmpeg"
                          >
                            <Show
                              when={isRenderingThis()}
                              fallback={
                                <>
                                  <Download size={10} />
                                  <span>Render 9:16</span>
                                </>
                              }
                            >
                              <RefreshCw size={10} class="animate-spin" />
                              <span>Rendering...</span>
                            </Show>
                          </button>
                        }
                      >
                        <div class="flex items-center gap-1">
                          <span class="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 text-[10px] font-mono flex items-center gap-1">
                            <CheckCircle2 size={10} />
                            <span>Exported</span>
                          </span>

                          <button
                            type="button"
                            onClick={() => handleOpenOutputFolder(candidate.rendered_path)}
                            class="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] transition cursor-pointer"
                            title="Open exported short in folder"
                          >
                            <ExternalLink size={10} />
                          </button>
                        </div>
                      </Show>
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
        </Show>
      </div>
    </div>
  );
};
