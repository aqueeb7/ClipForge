import { Component, Show, For } from "solid-js";
import { projectSignals } from "../../stores/project";
import type { VideoPreset } from "../../types/index.js";
import { Settings, X } from "../Icons";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsModal: Component<SettingsModalProps> = (props) => {
  const project = projectSignals.currentProject;
  const presets: VideoPreset[] = [
    "ultrafast",
    "superfast",
    "veryfast",
    "faster",
    "fast",
    "medium",
    "slow"
  ];

  function onSave() {
    projectSignals.generatePlan();
    props.onClose();
  }

  return (
    <Show when={props.open && project()}>
      {(proj) => (
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 select-none">
          <div class="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div class="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Settings size={15} class="text-blue-500" />
                <h2 class="text-xs font-bold uppercase tracking-wider text-zinc-100">
                  Export & Encoder Settings
                </h2>
              </div>
              <button
                type="button"
                onClick={props.onClose}
                class="text-zinc-500 hover:text-zinc-200 cursor-pointer p-1"
              >
                <X size={15} />
              </button>
            </div>

            {/* Settings Content */}
            <div class="p-5 space-y-4 text-xs">
              {/* CRF Quality */}
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Quality Level (CRF): {proj().export.crf}
                  </label>
                  <span class="text-[10px] text-zinc-500 font-mono">
                    {proj().export.crf <= 18
                      ? "Near Lossless"
                      : proj().export.crf <= 23
                      ? "High Quality / Balanced"
                      : "Compressed"}
                  </span>
                </div>
                <input
                  value={proj().export.crf}
                  onInput={(e) =>
                    projectSignals.updateExportSettings({ crf: Number(e.currentTarget.value) })
                  }
                  type="range"
                  min="15"
                  max="30"
                  step="1"
                  class="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* Encoding Preset */}
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  CPU Software Preset (When Hardware is Disabled)
                </label>
                <select
                  value={proj().export.preset}
                  onChange={(e) =>
                    projectSignals.updateExportSettings({ preset: e.currentTarget.value as VideoPreset })
                  }
                  class="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-zinc-200 font-mono focus:outline-none focus:border-zinc-700"
                >
                  <For each={presets}>
                    {(p) => <option value={p}>{p}</option>}
                  </For>
                </select>
              </div>

              {/* Framerate */}
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Export Framerate
                </label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    class={`py-1.5 rounded font-mono font-medium transition cursor-pointer ${
                      proj().export.frameRate === 30
                        ? "bg-blue-600 text-white font-semibold shadow-sm"
                        : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                    }`}
                    onClick={() => projectSignals.updateExportSettings({ frameRate: 30 })}
                  >
                    30 FPS
                  </button>
                  <button
                    type="button"
                    class={`py-1.5 rounded font-mono font-medium transition cursor-pointer ${
                      proj().export.frameRate === 60
                        ? "bg-blue-600 text-white font-semibold shadow-sm"
                        : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                    }`}
                    onClick={() => projectSignals.updateExportSettings({ frameRate: 60 })}
                  >
                    60 FPS
                  </button>
                </div>
              </div>

              {/* Directory Structure */}
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Output Organization
                </label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    class={`py-1.5 rounded font-mono font-medium transition cursor-pointer ${
                      proj().export.structure === "flat"
                        ? "bg-blue-600 text-white font-semibold shadow-sm"
                        : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                    }`}
                    onClick={() => projectSignals.updateExportSettings({ structure: "flat" })}
                  >
                    Flat Files
                  </button>
                  <button
                    type="button"
                    class={`py-1.5 rounded font-mono font-medium transition cursor-pointer ${
                      proj().export.structure === "nested"
                        ? "bg-blue-600 text-white font-semibold shadow-sm"
                        : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                    }`}
                    onClick={() => projectSignals.updateExportSettings({ structure: "nested" })}
                  >
                    Nested Folders
                  </button>
                </div>
              </div>

              {/* Naming Pattern */}
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Filename Template
                </label>
                <input
                  value={proj().export.namingPattern}
                  onInput={(e) =>
                    projectSignals.updateExportSettings({ namingPattern: e.currentTarget.value })
                  }
                  type="text"
                  class="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-zinc-200 font-mono focus:outline-none focus:border-zinc-700"
                />
                <span class="text-[10px] font-mono text-zinc-600 mt-1 block">
                  Variables: {"{project}"}, {"{episode}"}, {"{title}"}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div class="px-5 py-3.5 bg-zinc-950 border-t border-zinc-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={props.onClose}
                class="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-medium cursor-pointer transition border border-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};
