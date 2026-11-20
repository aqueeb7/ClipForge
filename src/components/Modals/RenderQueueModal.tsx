import { Component, Show, For } from "solid-js";
import { queueSignals } from "../../stores/queue";
import { ExternalLink, X, RefreshCw } from "../Icons";

export const RenderQueueModal: Component = () => {
  const show = queueSignals.showQueueModal;
  const isExporting = queueSignals.isExporting;
  const activeItem = queueSignals.activeItem;

  function formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return "";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }

  return (
    <Show when={show()}>
      <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 select-none">
        <div class="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Modal Header */}
          <div class="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class={`w-2.5 h-2.5 rounded-full ${
                  isExporting() ? "bg-blue-500 animate-pulse" : "bg-emerald-500"
                }`}
              />
              <div>
                <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-100">
                  {isExporting() ? "Rendering Clips..." : "Batch Export Completed"}
                </h2>
                <p class="text-xs text-zinc-400 mt-0.5">
                  {queueSignals.completedItems()} of {queueSignals.totalItems()} clips exported to:{" "}
                  <span class="font-mono text-zinc-300 font-medium">
                    {queueSignals.exportDirectory()}
                  </span>
                </p>
              </div>
            </div>

            <Show when={!isExporting()}>
              <button
                type="button"
                onClick={queueSignals.closeModal}
                class="text-zinc-500 hover:text-zinc-200 cursor-pointer p-1"
              >
                <X size={16} />
              </button>
            </Show>
          </div>

          {/* Overall Queue Progress */}
          <div class="p-4 border-b border-zinc-800/80 bg-zinc-900/40 flex flex-col gap-2">
            <div class="flex items-center justify-between text-xs font-mono">
              <span class="text-zinc-400 uppercase tracking-wider text-[10px]">
                Overall Batch Progress
              </span>
              <span class="text-blue-400 font-bold tabular-nums">{queueSignals.overallProgress()}%</span>
            </div>
            <div class="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
              <div
                class="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${queueSignals.overallProgress()}%` }}
              />
            </div>

            {/* Active Item Metrics (FPS, Speed, ETA) */}
            <Show when={isExporting() && activeItem()}>
              {(item) => (
                <div class="mt-2 grid grid-cols-4 gap-2 text-xs">
                  <div class="bg-zinc-900 p-2 rounded border border-zinc-800/80">
                    <div class="text-[9px] text-zinc-500 uppercase">Active Clip</div>
                    <div class="font-mono text-zinc-200 truncate font-medium text-[11px]">
                      {item().title}
                    </div>
                  </div>
                  <div class="bg-zinc-900 p-2 rounded border border-zinc-800/80">
                    <div class="text-[9px] text-zinc-500 uppercase">Encoding FPS</div>
                    <div class="font-mono text-emerald-400 font-medium text-[11px]">
                      {item().fps} fps
                    </div>
                  </div>
                  <div class="bg-zinc-900 p-2 rounded border border-zinc-800/80">
                    <div class="text-[9px] text-zinc-500 uppercase">Speed Multiplier</div>
                    <div class="font-mono text-blue-400 font-medium text-[11px]">{item().speed}</div>
                  </div>
                  <div class="bg-zinc-900 p-2 rounded border border-zinc-800/80">
                    <div class="text-[9px] text-zinc-500 uppercase">Estimated ETA</div>
                    <div class="font-mono text-amber-400 font-medium text-[11px]">{item().eta}</div>
                  </div>
                </div>
              )}
            </Show>
          </div>

          {/* Queue List */}
          <div class="max-h-60 overflow-y-auto p-4 space-y-1.5">
            <For each={queueSignals.queueItems()}>
              {(item, index) => (
                <div class="p-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between text-xs font-mono">
                  <div class="flex flex-col truncate max-w-[340px]">
                    <div class="flex items-center gap-2">
                      <span class="text-zinc-500 w-4 font-semibold">#{index() + 1}</span>
                      <span class="font-medium text-zinc-200 truncate">{item.outputName}</span>
                      <Show when={item.fileSizeBytes > 0}>
                        <span class="text-emerald-400 text-[10px]">
                          ({formatBytes(item.fileSizeBytes)})
                        </span>
                      </Show>
                    </div>
                    <span class="text-[10px] text-zinc-500 truncate pl-6 font-mono">
                      {item.outputPath}
                    </span>
                    <Show when={item.error}>
                      <span class="text-[10px] text-red-400 pl-6">{item.error}</span>
                    </Show>
                  </div>

                  <div class="flex items-center gap-3 shrink-0">
                    <Show when={item.status === "rendering"}>
                      <span class="text-blue-400 font-bold tabular-nums">{item.progress}%</span>
                    </Show>

                    <span
                      class={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        item.status === "queued"
                          ? "bg-zinc-900 text-zinc-500 border border-zinc-800"
                          : item.status === "rendering"
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                          : item.status === "completed"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          : item.status === "error"
                          ? "bg-red-500/20 text-red-400 border border-red-500/40"
                          : "bg-zinc-900 text-zinc-600"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>
              )}
            </For>
          </div>

          {/* Footer Buttons */}
          <div class="p-3.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
            <button
              type="button"
              onClick={queueSignals.openFolder}
              class="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-medium cursor-pointer transition flex items-center gap-1.5"
            >
              <ExternalLink size={12} />
              <span>Open in Explorer</span>
            </button>

            <div class="flex gap-2">
              <Show
                when={isExporting()}
                fallback={
                  <button
                    type="button"
                    onClick={queueSignals.closeModal}
                    class="px-5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-sm"
                  >
                    Done
                  </button>
                }
              >
                <button
                  type="button"
                  onClick={queueSignals.cancelExport}
                  class="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition"
                >
                  Cancel Export
                </button>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};
