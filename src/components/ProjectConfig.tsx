import { Component, Show } from "solid-js";
import { projectSignals } from "../stores/project";
import { openDirectoryDialog } from "../services/api";

export const ProjectConfig: Component = () => {
  const project = projectSignals.currentProject;

  async function handleBrowseOutputDir() {
    const selected = await openDirectoryDialog("Select Export Output Directory");
    const proj = project();
    if (selected && proj) {
      projectSignals.updateExportSettings({ outputDirectory: selected });
    }
  }

  function onDurationChange(e: Event) {
    const val = Number((e.target as HTMLInputElement).value);
    if (val > 0) {
      projectSignals.updateClipSettings({ durationSeconds: val });
    }
  }

  function onOverlapChange(e: Event) {
    const val = Number((e.target as HTMLInputElement).value);
    if (val >= 0) {
      projectSignals.updateClipSettings({ overlapSeconds: val });
    }
  }

  function onBackgroundModeChange(mode: "blur" | "solid") {
    projectSignals.updateComposition({
      background: { mode, blurRadius: 25, color: "#000000" }
    });
  }

  function onGameplayModeChange(mode: "contain" | "crop") {
    projectSignals.updateComposition({
      gameplay: { mode }
    });
  }

  return (
    <Show when={project()}>
      {(proj) => (
        <div class="p-4 rounded-xl border border-zinc-800 bg-dark-900/50 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              Project & Composition Settings
            </h3>
            <span class="text-[11px] font-mono text-zinc-400">1080×1920 (9:16) Vertical</span>
          </div>

          {/* Project Name & Output Dir */}
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[11px] text-zinc-400 uppercase tracking-wider mb-1">
                Project Name
              </label>
              <input
                value={proj().name}
                onInput={(e) => {
                  const p = project();
                  if (p) projectSignals.setCurrentProject({ ...p, name: e.currentTarget.value });
                }}
                type="text"
                class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-medium focus:outline-none focus:border-blue-500"
                onChange={() => projectSignals.generatePlan()}
              />
            </div>
            <div>
              <label class="block text-[11px] text-zinc-400 uppercase tracking-wider mb-1">
                Output Directory
              </label>
              <div class="flex gap-1.5">
                <input
                  value={proj().export.outputDirectory}
                  onInput={(e) => {
                    const p = project();
                    if (p) {
                      projectSignals.setCurrentProject({
                        ...p,
                        export: { ...p.export, outputDirectory: e.currentTarget.value }
                      });
                    }
                  }}
                  type="text"
                  class="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleBrowseOutputDir}
                  class="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Folder
                </button>
              </div>
            </div>
          </div>

          {/* Clip Cadence Settings */}
          <div class="pt-2 border-t border-zinc-800/60">
            <div class="text-[11px] text-zinc-400 uppercase tracking-wider mb-2 font-medium">
              Automatic Clipping Cadence
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-[10px] text-zinc-500 uppercase mb-1">Duration (s)</label>
                <Show when={proj().clipSettings.mode === "automatic"}>
                  <input
                    value={(proj().clipSettings as any).durationSeconds}
                    type="number"
                    min="5"
                    max="300"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono"
                    onChange={onDurationChange}
                  />
                </Show>
              </div>
              <div>
                <label class="block text-[10px] text-zinc-500 uppercase mb-1">Overlap (s)</label>
                <Show when={proj().clipSettings.mode === "automatic"}>
                  <input
                    value={(proj().clipSettings as any).overlapSeconds}
                    type="number"
                    min="0"
                    max="30"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono"
                    onChange={onOverlapChange}
                  />
                </Show>
              </div>
              <div>
                <label class="block text-[10px] text-zinc-500 uppercase mb-1">Starting Ep #</label>
                <Show when={proj().clipSettings.mode === "automatic"}>
                  <input
                    value={(proj().clipSettings as any).startingEpisode || 1}
                    onInput={(e) => {
                      projectSignals.updateClipSettings({
                        startingEpisode: Number(e.currentTarget.value)
                      });
                    }}
                    type="number"
                    min="1"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono"
                    onChange={() => projectSignals.generatePlan()}
                  />
                </Show>
              </div>
            </div>
          </div>

          {/* Composition & Overlays */}
          <div class="pt-2 border-t border-zinc-800/60">
            <div class="text-[11px] text-zinc-400 uppercase tracking-wider mb-2 font-medium">
              Vertical Layout & Canvas Mode
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[10px] text-zinc-500 uppercase mb-1">Background Mode</label>
                <div class="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    class={`py-1 text-xs rounded font-medium transition cursor-pointer ${
                      proj().composition.background.mode === "blur"
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-950 text-zinc-400 border border-zinc-800"
                    }`}
                    onClick={() => onBackgroundModeChange("blur")}
                  >
                    Blurred Video
                  </button>
                  <button
                    type="button"
                    class={`py-1 text-xs rounded font-medium transition cursor-pointer ${
                      proj().composition.background.mode === "solid"
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-950 text-zinc-400 border border-zinc-800"
                    }`}
                    onClick={() => onBackgroundModeChange("solid")}
                  >
                    Solid Color
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-[10px] text-zinc-500 uppercase mb-1">Gameplay Layout</label>
                <div class="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    class={`py-1 text-xs rounded font-medium transition cursor-pointer ${
                      proj().composition.gameplay.mode === "contain"
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-950 text-zinc-400 border border-zinc-800"
                    }`}
                    onClick={() => onGameplayModeChange("contain")}
                  >
                    Contain (Pillar)
                  </button>
                  <button
                    type="button"
                    class={`py-1 text-xs rounded font-medium transition cursor-pointer ${
                      proj().composition.gameplay.mode === "crop"
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-950 text-zinc-400 border border-zinc-800"
                    }`}
                    onClick={() => onGameplayModeChange("crop")}
                  >
                    Full Crop
                  </button>
                </div>
              </div>
            </div>

            {/* Overlay Brand Text */}
            <div class="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label class="block text-[10px] text-zinc-500 uppercase mb-1">Top Brand Title</label>
                <Show when={proj().composition.overlay}>
                  <input
                    value={proj().composition.overlay?.brandTitle || ""}
                    onInput={(e) => {
                      projectSignals.updateComposition({
                        overlay: { brandTitle: e.currentTarget.value }
                      });
                    }}
                    type="text"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 font-mono"
                    onChange={() => projectSignals.generatePlan()}
                  />
                </Show>
              </div>
              <div>
                <label class="block text-[10px] text-zinc-500 uppercase mb-1">
                  Bottom Episode Label
                </label>
                <Show when={proj().composition.overlay}>
                  <input
                    value={proj().composition.overlay?.episodeLabel || ""}
                    onInput={(e) => {
                      projectSignals.updateComposition({
                        overlay: { episodeLabel: e.currentTarget.value }
                      });
                    }}
                    type="text"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 font-mono"
                    onChange={() => projectSignals.generatePlan()}
                  />
                </Show>
              </div>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};
