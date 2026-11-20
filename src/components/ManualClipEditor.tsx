import { Component, createSignal, createMemo, Show, For } from "solid-js";
import { projectSignals } from "../stores/project";
import { timelineSignals } from "../stores/timeline";

export const ManualClipEditor: Component = () => {
  const [newClipTitle, setNewClipTitle] = createSignal("");

  const isManual = projectSignals.isManualMode;
  const manualClips = createMemo(() => {
    const proj = projectSignals.currentProject();
    return proj?.clipSettings.mode === "manual" ? proj.clipSettings.clips : [];
  });

  function switchMode(mode: "automatic" | "manual") {
    projectSignals.setClippingMode(mode);
  }

  function handleAddFromSelection() {
    const inP = timelineSignals.inPoint();
    const outP = timelineSignals.outPoint();
    if (inP === null || outP === null) {
      const start = timelineSignals.currentTime();
      const end = Math.min(
        projectSignals.videoMetadata()?.durationSeconds || 120,
        start + 60
      );
      projectSignals.addManualClipRange(
        start,
        end,
        newClipTitle().trim() || undefined
      );
    } else {
      projectSignals.addManualClipRange(
        inP,
        outP,
        newClipTitle().trim() || undefined
      );
    }
    setNewClipTitle("");
    timelineSignals.clearMarkers();
  }

  function handleRemoveClip(index: number) {
    projectSignals.removeManualClipItem(index);
  }

  function handleToggleClip(index: number) {
    projectSignals.toggleManualClipItem(index);
  }

  function handleDuplicateClip(index: number) {
    const clips = manualClips();
    const clip = clips[index - 1];
    if (clip) {
      projectSignals.addManualClipRange(
        clip.start,
        clip.end,
        `${clip.title || "Clip"} (Copy)`
      );
    }
  }

  return (
    <div class="p-4 rounded-xl border border-zinc-800 bg-dark-900/60 flex flex-col gap-3">
      {/* Mode Header */}
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span
            class={`w-2 h-2 rounded-full ${isManual() ? "bg-amber-500" : "bg-blue-500"}`}
          ></span>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            {isManual() ? "Manual Clip Sequencer" : "Automatic Cadence Mode"}
          </h3>
        </div>

        <div class="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
          <button
            type="button"
            class={`px-2.5 py-1 text-xs rounded transition cursor-pointer ${
              !isManual()
                ? "bg-blue-600 text-white font-medium"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            onClick={() => switchMode("automatic")}
          >
            Auto Cadence
          </button>
          <button
            type="button"
            class={`px-2.5 py-1 text-xs rounded transition cursor-pointer ${
              isManual()
                ? "bg-amber-600 text-white font-medium"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            onClick={() => switchMode("manual")}
          >
            Manual Clips
          </button>
        </div>
      </div>

      {/* Manual Clips Action Bar */}
      <Show when={isManual()}>
        <div class="flex items-center gap-2 pt-1 border-t border-zinc-800/60">
          <input
            value={newClipTitle()}
            onInput={(e) => setNewClipTitle(e.currentTarget.value)}
            type="text"
            placeholder="Custom Clip Title (optional)..."
            class="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            onKeyUp={(e) => {
              if (e.key === "Enter") handleAddFromSelection();
            }}
          />
          <button
            type="button"
            onClick={handleAddFromSelection}
            class="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-medium cursor-pointer transition flex items-center gap-1"
          >
            <span>+ Add Clip</span>
            <Show when={timelineSignals.hasSelectionRange()}>
              <span class="font-mono text-[10px] text-amber-200">
                ({timelineSignals.selectionDuration().toFixed(1)}s)
              </span>
            </Show>
          </button>
        </div>

        {/* Manual Clips List */}
        <div class="max-h-48 overflow-y-auto space-y-1.5 pr-1">
          <Show
            when={manualClips().length > 0}
            fallback={
              <div class="text-zinc-500 text-xs py-4 text-center">
                No manual clips defined yet. Mark [ In ] and [ Out ] on the preview player and click "+ Add Clip".
              </div>
            }
          >
            <For each={manualClips()}>
              {(clip, idx) => (
                <div class="flex items-center justify-between p-2 rounded-lg bg-zinc-950/70 border border-zinc-800 text-xs font-mono">
                  <div class="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={clip.enabled ?? true}
                      onChange={() => handleToggleClip(idx() + 1)}
                      class="rounded bg-zinc-900 border-zinc-700 text-blue-600 cursor-pointer"
                    />
                    <span class="text-zinc-500 w-4">#{idx() + 1}</span>
                    <span class="font-medium text-zinc-200">
                      {clip.title || `Part ${String(idx() + 1).padStart(3, "0")}`}
                    </span>
                  </div>

                  <div class="flex items-center gap-3">
                    <span class="text-zinc-400">
                      {clip.start.toFixed(1)}s &rarr; {clip.end.toFixed(1)}s
                    </span>
                    <span class="text-amber-400/90 font-semibold">
                      ({(clip.end - clip.start).toFixed(1)}s)
                    </span>

                    <div class="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDuplicateClip(idx() + 1)}
                        class="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] cursor-pointer"
                        title="Duplicate Clip"
                      >
                        Dup
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveClip(idx() + 1)}
                        class="px-1.5 py-0.5 rounded bg-red-900/40 hover:bg-red-800/60 text-red-300 text-[10px] cursor-pointer"
                        title="Delete Clip"
                      >
                        Del
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </Show>
        </div>
      </Show>

      {/* Automatic Mode Explanation */}
      <Show when={!isManual()}>
        <div class="text-xs text-zinc-400 bg-zinc-950/50 p-2.5 rounded-lg border border-zinc-800/60">
          Clips are being automatically generated using fixed duration intervals. Switch to{" "}
          <strong class="text-amber-400 font-medium">Manual Clips</strong> mode if you want custom time ranges
          or selective clip extraction.
        </div>
      </Show>
    </div>
  );
};
