import { Component, createSignal, Show, For } from "solid-js";
import { projectSignals } from "../../stores/project";
import type { VideoPreset } from "../../types/index.js";
import { Settings, X, Cpu, Sparkles, Sliders, CheckCircle2, Film, Layers } from "../Icons";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: "tri_engine" | "export_quality";
}

export const SettingsModal: Component<SettingsModalProps> = (props) => {
  const project = projectSignals.currentProject;
  const profile = projectSignals.triEngineProfile;
  const [activeTab, setActiveTab] = createSignal<"tri_engine" | "export_quality">(
    props.initialTab || "tri_engine"
  );

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
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 select-none overflow-y-auto">
          <div class="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
            {/* Header */}
            <div class="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-900/60">
              <div class="flex items-center gap-2.5">
                <div class="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  <Settings size={15} class="text-blue-400" />
                </div>
                <div>
                  <h2 class="text-xs font-bold uppercase tracking-wider text-zinc-100">
                    Clyptik Studio Settings
                  </h2>
                  <p class="text-[10px] text-zinc-500 font-mono">
                    Tri-Engine Decoupled Hardware & Export Architecture
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={props.onClose}
                class="text-zinc-400 hover:text-zinc-100 cursor-pointer p-1.5 rounded-lg hover:bg-zinc-800 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div class="flex items-center border-b border-zinc-800 px-5 pt-2 bg-zinc-900/30 gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("tri_engine")}
                class={`pb-2.5 px-3 text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 border-b-2 -mb-px ${
                  activeTab() === "tri_engine"
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Cpu size={13} />
                <span>Tri-Engine Hardware & AI</span>
                <span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-blue-950 border border-blue-800/60 text-blue-300">
                  Decoupled
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("export_quality")}
                class={`pb-2.5 px-3 text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 border-b-2 -mb-px ${
                  activeTab() === "export_quality"
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Sliders size={13} />
                <span>Export & Quality Presets</span>
              </button>
            </div>

            {/* Content Area */}
            <div class="p-5 overflow-y-auto space-y-5 text-xs flex-1 min-h-0">
              {/* ===================== TAB 1: TRI-ENGINE HARDWARE & AI ===================== */}
              <Show when={activeTab() === "tri_engine"}>
                <div class="space-y-4">
                  {/* Visual Topology Diagram Card */}
                  <div class="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2.5 shadow-sm">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                        <Layers size={13} class="text-amber-400" />
                        <span>Tri-Engine Decoupled Topology</span>
                      </div>
                      <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/80 border border-emerald-800/60 text-emerald-300">
                        Zero Resource Conflicts
                      </span>
                    </div>

                    <p class="text-[11px] text-zinc-400 leading-relaxed">
                      Video decoding, AI & RAG inference, and video encoding operate as three separate, dedicated resource pipelines. This guarantees smooth 60 FPS 2K/4K playback while running Whisper AI transcription and QuickSync exports simultaneously.
                    </p>

                    {/* 3-Tier Grid Visualizer */}
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-mono">
                      {/* Tier 1 Box */}
                      <div class="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col justify-between gap-1">
                        <div class="flex items-center justify-between text-[10px]">
                          <span class="text-zinc-500 uppercase font-bold">Tier 1: Decode</span>
                          <Film size={11} class="text-blue-400" />
                        </div>
                        <div class="font-bold text-zinc-200 text-[11px] truncate">
                          {profile()?.active_decoder.name.split("(")[0] || "D3D11VA"}
                        </div>
                        <div class="text-[9px] text-zinc-500 truncate">
                          {profile()?.active_decoder.device_name}
                        </div>
                      </div>

                      {/* Tier 3 Box (AI) */}
                      <div class="p-2.5 rounded-lg bg-zinc-950 border border-amber-500/30 flex flex-col justify-between gap-1">
                        <div class="flex items-center justify-between text-[10px]">
                          <span class="text-amber-400 uppercase font-bold">Tier 2: AI & RAG</span>
                          <Sparkles size={11} class="text-amber-400" />
                        </div>
                        <div class="font-bold text-amber-200 text-[11px] truncate">
                          {profile()?.active_inference.name.split("(")[0] || "CUDA (MX350)"}
                        </div>
                        <div class="text-[9px] text-zinc-500 truncate">
                          {profile()?.active_inference.device_name}
                        </div>
                      </div>

                      {/* Tier 2 Box (Encode) */}
                      <div class="p-2.5 rounded-lg bg-zinc-950 border border-blue-500/30 flex flex-col justify-between gap-1">
                        <div class="flex items-center justify-between text-[10px]">
                          <span class="text-blue-400 uppercase font-bold">Tier 3: Export</span>
                          <Cpu size={11} class="text-blue-400" />
                        </div>
                        <div class="font-bold text-blue-200 text-[11px] truncate">
                          {profile()?.active_encoder.name.split("(")[0] || "Intel QuickSync"}
                        </div>
                        <div class="text-[9px] text-zinc-500 truncate">
                          {profile()?.active_encoder.device_name}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Physical Devices Card */}
                  <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                      Detected Physical Accelerators ({profile()?.devices.length || 0})
                    </label>
                    <div class="space-y-1.5">
                      <For each={profile()?.devices || []}>
                        {(dev) => (
                          <div class="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                            <div class="flex items-center gap-2.5">
                              <div class={`w-2.5 h-2.5 rounded-full ${dev.is_discrete ? "bg-amber-400" : "bg-blue-400"}`} />
                              <div>
                                <span class="font-bold text-zinc-200 block text-[11px]">{dev.name}</span>
                                <span class="text-[10px] text-zinc-500 font-mono">
                                  {dev.vendor} • {dev.is_discrete ? "Dedicated GPU" : "Integrated System GPU"}
                                  {dev.memory_mb > 0 ? ` • ${dev.memory_mb} MB VRAM` : ""}
                                  {dev.driver_version ? ` • Driver ${dev.driver_version}` : ""}
                                </span>
                              </div>
                            </div>
                            <Show when={dev.cuda_supported}>
                              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                                {dev.cuda_version || "CUDA Ready"}
                              </span>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>

                  {/* Tier 1: Decoder Selection */}
                  <div class="pt-1">
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Tier 1: Video Decoding Engine
                    </label>
                    <div class="space-y-1.5">
                      <For each={profile()?.available_decoders || []}>
                        {(opt) => {
                          const isSelected = () => profile()?.active_decoder.id === opt.id;
                          return (
                            <button
                              type="button"
                              onClick={() => projectSignals.updateTriEnginePreference({ decoder: opt.id })}
                              class={`w-full p-2.5 rounded-lg border text-left transition cursor-pointer flex items-center justify-between gap-3 ${
                                isSelected()
                                  ? "bg-blue-950/30 border-blue-500 text-zinc-100 ring-1 ring-blue-500/30"
                                  : "bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800/80 text-zinc-400"
                              }`}
                            >
                              <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                  <span class="font-bold text-zinc-200 text-xs">{opt.name}</span>
                                  <Show when={opt.is_recommended}>
                                    <span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-blue-950 border border-blue-800 text-blue-300 font-bold uppercase">
                                      Optimal
                                    </span>
                                  </Show>
                                </div>
                                <p class="text-[10px] text-zinc-500 mt-0.5">{opt.description}</p>
                              </div>
                              <Show when={isSelected()}>
                                <CheckCircle2 size={15} class="text-blue-400 shrink-0" />
                              </Show>
                            </button>
                          );
                        }}
                      </For>
                    </div>
                  </div>

                  {/* Tier 2: AI & RAG Inference Selection */}
                  <div class="pt-1">
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Tier 2: AI Inference & RAG Acceleration (Whisper, Tracking, Embeddings)
                    </label>
                    <div class="space-y-1.5">
                      <For each={profile()?.available_inference || []}>
                        {(opt) => {
                          const isSelected = () => profile()?.active_inference.id === opt.id;
                          return (
                            <button
                              type="button"
                              onClick={() => projectSignals.updateTriEnginePreference({ inference: opt.id })}
                              class={`w-full p-2.5 rounded-lg border text-left transition cursor-pointer flex items-center justify-between gap-3 ${
                                isSelected()
                                  ? "bg-amber-950/25 border-amber-500 text-zinc-100 ring-1 ring-amber-500/30"
                                  : "bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800/80 text-zinc-400"
                              }`}
                            >
                              <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                  <span class="font-bold text-zinc-200 text-xs">{opt.name}</span>
                                  <Show when={opt.is_recommended}>
                                    <span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-950 border border-amber-800 text-amber-300 font-bold uppercase">
                                      Recommended
                                    </span>
                                  </Show>
                                </div>
                                <p class="text-[10px] text-zinc-500 mt-0.5">{opt.description}</p>
                              </div>
                              <Show when={isSelected()}>
                                <CheckCircle2 size={15} class="text-amber-400 shrink-0" />
                              </Show>
                            </button>
                          );
                        }}
                      </For>
                    </div>
                  </div>

                  {/* Tier 3: Video Encoder Selection */}
                  <div class="pt-1">
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Tier 3: Video Export & Rendering Encoder
                    </label>
                    <div class="space-y-1.5">
                      <For each={profile()?.available_encoders || []}>
                        {(opt) => {
                          const isSelected = () => profile()?.active_encoder.id === opt.id;
                          return (
                            <button
                              type="button"
                              disabled={!opt.is_available}
                              onClick={() => {
                                if (opt.is_available) {
                                  projectSignals.updateTriEnginePreference({ encoder: opt.id });
                                }
                              }}
                              class={`w-full p-2.5 rounded-lg border text-left transition flex items-center justify-between gap-3 ${
                                !opt.is_available
                                  ? "opacity-50 cursor-not-allowed bg-zinc-950/60 border-zinc-900"
                                  : isSelected()
                                  ? "bg-blue-950/30 border-blue-500 text-zinc-100 ring-1 ring-blue-500/30 cursor-pointer"
                                  : "bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800/80 text-zinc-400 cursor-pointer"
                              }`}
                            >
                              <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                  <span class="font-bold text-zinc-200 text-xs">{opt.name}</span>
                                  <Show when={opt.is_recommended && opt.is_available}>
                                    <span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-blue-950 border border-blue-800 text-blue-300 font-bold uppercase">
                                      Active Default
                                    </span>
                                  </Show>
                                  <Show when={!opt.is_available}>
                                    <span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-500 uppercase">
                                      Hardware Unavailable
                                    </span>
                                  </Show>
                                </div>
                                <p class="text-[10px] text-zinc-500 mt-0.5">{opt.description}</p>
                              </div>
                              <Show when={isSelected()}>
                                <CheckCircle2 size={15} class="text-blue-400 shrink-0" />
                              </Show>
                            </button>
                          );
                        }}
                      </For>
                    </div>
                  </div>
                </div>
              </Show>

              {/* ===================== TAB 2: EXPORT & QUALITY ===================== */}
              <Show when={activeTab() === "export_quality"}>
                <div class="space-y-4">
                  {/* CRF Quality */}
                  <div class="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <div class="flex items-center justify-between mb-2">
                      <label class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Quality Level (CRF): {proj().export.crf}
                      </label>
                      <span class="text-[10px] text-zinc-400 font-mono">
                        {proj().export.crf <= 18
                          ? "Near Lossless"
                          : proj().export.crf <= 23
                          ? "High Quality / Balanced (Recommended)"
                          : "High Compression"}
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
                    <div class="flex justify-between text-[9px] text-zinc-500 font-mono mt-1">
                      <span>CRF 15 (Larger Files)</span>
                      <span>CRF 22 (Standard)</span>
                      <span>CRF 30 (Smaller Files)</span>
                    </div>
                  </div>

                  {/* Encoding Preset */}
                  <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Software Preset (When Hardware is Disabled)
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
                        class={`py-2 rounded-lg font-mono font-medium transition cursor-pointer ${
                          proj().export.frameRate === 30
                            ? "bg-blue-600 text-white font-semibold shadow-sm"
                            : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200"
                        }`}
                        onClick={() => projectSignals.updateExportSettings({ frameRate: 30 })}
                      >
                        30 FPS
                      </button>
                      <button
                        type="button"
                        class={`py-2 rounded-lg font-mono font-medium transition cursor-pointer ${
                          proj().export.frameRate === 60
                            ? "bg-blue-600 text-white font-semibold shadow-sm"
                            : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200"
                        }`}
                        onClick={() => projectSignals.updateExportSettings({ frameRate: 60 })}
                      >
                        60 FPS (Cinematic Gameplay)
                      </button>
                    </div>
                  </div>

                  {/* Directory Structure */}
                  <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Output Folder Organization
                    </label>
                    <div class="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        class={`py-2 rounded-lg font-mono font-medium transition cursor-pointer ${
                          proj().export.structure === "flat"
                            ? "bg-blue-600 text-white font-semibold shadow-sm"
                            : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200"
                        }`}
                        onClick={() => projectSignals.updateExportSettings({ structure: "flat" })}
                      >
                        Flat Files
                      </button>
                      <button
                        type="button"
                        class={`py-2 rounded-lg font-mono font-medium transition cursor-pointer ${
                          proj().export.structure === "nested"
                            ? "bg-blue-600 text-white font-semibold shadow-sm"
                            : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200"
                        }`}
                        onClick={() => projectSignals.updateExportSettings({ structure: "nested" })}
                      >
                        Nested Folders (By Project)
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
                    <span class="text-[10px] font-mono text-zinc-500 mt-1 block">
                      Variables: {"{project}"}, {"{episode}"}, {"{title}"}
                    </span>
                  </div>
                </div>
              </Show>
            </div>

            {/* Footer */}
            <div class="px-5 py-3.5 bg-zinc-900/60 border-t border-zinc-800 flex justify-between items-center shrink-0">
              <span class="text-[10px] font-mono text-zinc-500 truncate max-w-[340px]">
                {profile()?.summary || "Tri-Engine Architecture Active"}
              </span>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onClick={props.onClose}
                  class="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-medium cursor-pointer transition border border-zinc-800"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};
