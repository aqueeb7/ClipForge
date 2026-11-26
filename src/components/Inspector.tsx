import { Component, createSignal, createMemo, createEffect, Show, For } from "solid-js";
import { projectSignals } from "../stores/project";
import { timelineSignals } from "../stores/timeline";
import { openFileDialog, getMediaAssetUrl, isTauriEnvironment } from "../services/api";
import { Sliders, Scissors, Music, Film, Plus, Trash2, Check, RefreshCw, Volume2, VolumeX, Split, Image } from "./Icons";

export const Inspector: Component = () => {
  const [activeTab, setActiveTab] = createSignal<"framing" | "slicing" | "audio" | "source">("framing");

  const project = projectSignals.currentProject;
  const videoMeta = projectSignals.videoMetadata;
  const audioMeta = projectSignals.audioMetadata;
  const composition = createMemo(() => project()?.composition);
  const clipSettings = createMemo(() => project()?.clipSettings);
  const syncSettings = createMemo(() => project()?.synchronization);

  const [inspectorLogoAssetUrl, setInspectorLogoAssetUrl] = createSignal<string | null>(null);

  createEffect(() => {
    const rawPath = composition()?.overlay?.logoPath;
    if (rawPath) {
      getMediaAssetUrl(rawPath)
        .then((url) => setInspectorLogoAssetUrl(url))
        .catch(() => setInspectorLogoAssetUrl(null));
    } else {
      setInspectorLogoAssetUrl(null);
    }
  });

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  async function handleBrowseVideo() {
    if (isTauriEnvironment()) {
      const selected = await openFileDialog({
        title: "Select Video File",
        filters: [{ name: "Video Files", extensions: ["mp4", "mkv", "mov", "webm", "avi"] }]
      });
      if (selected) {
        await projectSignals.loadVideoSource(selected);
      }
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
    }
  }

  return (
    <aside class="w-80 h-full border-r border-zinc-800/80 bg-zinc-950 flex flex-col shrink-0 overflow-hidden select-none">
      {/* Inspector Tab Bar */}
      <div class="h-10 border-b border-zinc-800/80 bg-zinc-900/50 flex items-center px-1 gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("framing")}
          class={`flex-1 h-7 rounded text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab() === "framing"
              ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
          title="Frame & 9:16 Canvas"
        >
          <Sliders size={12} />
          <span>Framing</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("slicing")}
          class={`flex-1 h-7 rounded text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab() === "slicing"
              ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
          title="Clip Slicing & Markers"
        >
          <Scissors size={12} />
          <span>Clips</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audio")}
          class={`flex-1 h-7 rounded text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab() === "audio"
              ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
          title="Audio Track & Sync"
        >
          <Music size={12} />
          <span>Audio</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("source")}
          class={`flex-1 h-7 rounded text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab() === "source"
              ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
          title="Source Media Info"
        >
          <Film size={12} />
          <span>Source</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div class="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-zinc-300">
        {/* ===================== TAB 1: FRAMING ===================== */}
        <Show when={activeTab() === "framing"}>
          <div class="space-y-4">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                Canvas & Aspect Ratio
              </label>
              <div class="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div class="font-medium text-zinc-200">Vertical Canvas</div>
                  <div class="text-[10px] text-zinc-500 font-mono">1080 × 1920 (9:16 Portrait)</div>
                </div>
                <span class="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-[10px] font-semibold">
                  Full HD
                </span>
              </div>
            </div>

            {/* Stacking & Framing Templates */}
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Framing & Stacking Template
              </label>
              <div class="grid grid-cols-2 gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => projectSignals.updateComposition({
                    stacking: {
                      ...(composition()?.stacking || {}),
                      template: "blur_fill"
                    }
                  })}
                  class={`p-2 rounded text-left transition cursor-pointer flex flex-col gap-0.5 ${
                    (composition()?.stacking?.template || "blur_fill") === "blur_fill"
                      ? "bg-blue-600/20 border border-blue-500/40 text-blue-300"
                      : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                  }`}
                >
                  <span class="text-xs font-bold text-zinc-100">Blur Fill</span>
                  <span class="text-[9px] text-zinc-500">Letterbox + Blurred background</span>
                </button>

                <button
                  type="button"
                  onClick={() => projectSignals.updateComposition({
                    stacking: {
                      ...(composition()?.stacking || {}),
                      template: "stacked_split",
                      topHeightPercent: composition()?.stacking?.topHeightPercent || 35,
                      topRegion: composition()?.stacking?.topRegion || { x: 2, y: 5, width: 28, height: 35 },
                      bottomRegion: composition()?.stacking?.bottomRegion || { x: 0, y: 15, width: 100, height: 85 }
                    }
                  })}
                  class={`p-2 rounded text-left transition cursor-pointer flex flex-col gap-0.5 ${
                    composition()?.stacking?.template === "stacked_split"
                      ? "bg-blue-600/20 border border-blue-500/40 text-blue-300"
                      : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                  }`}
                >
                  <span class="text-xs font-bold text-zinc-100">Stacked Split</span>
                  <span class="text-[9px] text-zinc-500">Facecam Top + Gameplay Bot</span>
                </button>

                <button
                  type="button"
                  onClick={() => projectSignals.updateComposition({
                    stacking: {
                      ...(composition()?.stacking || {}),
                      template: "split_50_50",
                      topHeightPercent: 50,
                      topRegion: composition()?.stacking?.topRegion || { x: 0, y: 0, width: 100, height: 50 },
                      bottomRegion: composition()?.stacking?.bottomRegion || { x: 0, y: 50, width: 100, height: 50 }
                    }
                  })}
                  class={`p-2 rounded text-left transition cursor-pointer flex flex-col gap-0.5 ${
                    composition()?.stacking?.template === "split_50_50"
                      ? "bg-blue-600/20 border border-blue-500/40 text-blue-300"
                      : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                  }`}
                >
                  <span class="text-xs font-bold text-zinc-100">50 / 50 Split</span>
                  <span class="text-[9px] text-zinc-500">Equal top/bottom dual zones</span>
                </button>

                <button
                  type="button"
                  onClick={() => projectSignals.updateComposition({
                    stacking: {
                      ...(composition()?.stacking || {}),
                      template: "pan_scan",
                      cropRegion: composition()?.stacking?.cropRegion || { x: 21.875, y: 0, width: 56.25, height: 100 }
                    }
                  })}
                  class={`p-2 rounded text-left transition cursor-pointer flex flex-col gap-0.5 ${
                    composition()?.stacking?.template === "pan_scan"
                      ? "bg-blue-600/20 border border-blue-500/40 text-blue-300"
                      : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                  }`}
                >
                  <span class="text-xs font-bold text-zinc-100">Pan & Scan</span>
                  <span class="text-[9px] text-zinc-500">Direct 9:16 vertical crop</span>
                </button>
              </div>
            </div>

            {/* Template Specific Options */}
            <Show when={composition()?.stacking?.template === "stacked_split" || composition()?.stacking?.template === "split_50_50"}>
              <div class="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    Dual Zone Stacking Config
                  </span>
                  <span class="text-[10px] font-mono text-zinc-400">
                    Top {composition()?.stacking?.topHeightPercent || 35}% / Bot {100 - (composition()?.stacking?.topHeightPercent || 35)}%
                  </span>
                </div>

                <div class="space-y-1">
                  <div class="flex justify-between text-[11px] text-zinc-400">
                    <span>Vertical Split Ratio</span>
                    <span class="font-mono text-zinc-200">{composition()?.stacking?.topHeightPercent || 35}% Top</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="70"
                    value={composition()?.stacking?.topHeightPercent || 35}
                    onInput={(e) => {
                      const val = parseInt((e.target as HTMLInputElement).value, 10);
                      projectSignals.updateComposition({
                        stacking: {
                          ...(composition()?.stacking || {}),
                          template: composition()?.stacking?.template || "stacked_split",
                          topHeightPercent: val
                        }
                      });
                    }}
                    class="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                {/* Facecam Zone Presets */}
                <div class="space-y-1.5 pt-2 border-t border-zinc-800">
                  <span class="text-[10px] uppercase font-bold text-zinc-500 block">Facecam Preset Positions</span>
                  <div class="grid grid-cols-4 gap-1">
                    <button
                      type="button"
                      onClick={() => projectSignals.updateComposition({
                        stacking: {
                          ...(composition()?.stacking || {}),
                          template: composition()?.stacking?.template || "stacked_split",
                          topRegion: { x: 2, y: 5, width: 28, height: 35 }
                        }
                      })}
                      class="px-1.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 cursor-pointer text-center"
                    >
                      Top-Left
                    </button>
                    <button
                      type="button"
                      onClick={() => projectSignals.updateComposition({
                        stacking: {
                          ...(composition()?.stacking || {}),
                          template: composition()?.stacking?.template || "stacked_split",
                          topRegion: { x: 70, y: 5, width: 28, height: 35 }
                        }
                      })}
                      class="px-1.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 cursor-pointer text-center"
                    >
                      Top-Right
                    </button>
                    <button
                      type="button"
                      onClick={() => projectSignals.updateComposition({
                        stacking: {
                          ...(composition()?.stacking || {}),
                          template: composition()?.stacking?.template || "stacked_split",
                          topRegion: { x: 70, y: 60, width: 28, height: 35 }
                        }
                      })}
                      class="px-1.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 cursor-pointer text-center"
                    >
                      Bot-Right
                    </button>
                    <button
                      type="button"
                      onClick={() => projectSignals.updateComposition({
                        stacking: {
                          ...(composition()?.stacking || {}),
                          template: composition()?.stacking?.template || "stacked_split",
                          topRegion: { x: 35, y: 5, width: 30, height: 35 }
                        }
                      })}
                      class="px-1.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 cursor-pointer text-center"
                    >
                      Center
                    </button>
                  </div>
                </div>
              </div>
            </Show>

            <Show when={composition()?.stacking?.template === "pan_scan"}>
              <div class="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                <div class="flex items-center justify-between text-[11px]">
                  <span class="text-zinc-400">Horizontal Pan Position</span>
                  <span class="font-mono text-zinc-200">{((composition()?.stacking?.cropRegion?.x ?? 21.875) + 28.125).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="43.75"
                  step="0.5"
                  value={composition()?.stacking?.cropRegion?.x ?? 21.875}
                  onInput={(e) => {
                    const val = parseFloat((e.target as HTMLInputElement).value);
                    projectSignals.updateComposition({
                      stacking: {
                        ...(composition()?.stacking || {}),
                        template: "pan_scan",
                        cropRegion: { x: val, y: 0, width: 56.25, height: 100 }
                      }
                    });
                  }}
                  class="w-full accent-blue-500 cursor-pointer"
                />
                <div class="flex justify-between text-[9px] text-zinc-500 font-mono">
                  <span>Left (0%)</span>
                  <span>Center (50%)</span>
                  <span>Right (100%)</span>
                </div>
              </div>
            </Show>

            {/* Background Style */}
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Background Mode
              </label>
              <div class="grid grid-cols-3 gap-1 p-0.5 bg-zinc-900 border border-zinc-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => projectSignals.updateComposition({ background: { mode: "blur", blurRadius: 25 } })}
                  class={`py-1.5 rounded text-[11px] font-medium transition cursor-pointer ${
                    composition()?.background?.mode === "blur"
                      ? "bg-zinc-800 text-white shadow-sm font-semibold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Gaussian Blur
                </button>
                <button
                  type="button"
                  onClick={() => projectSignals.updateComposition({ background: { mode: "solid", color: composition()?.background?.color || "#000000" } })}
                  class={`py-1.5 rounded text-[11px] font-medium transition cursor-pointer ${
                    composition()?.background?.mode === "solid"
                      ? "bg-zinc-800 text-white shadow-sm font-semibold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Solid Color
                </button>
                <button
                  type="button"
                  onClick={() => projectSignals.updateComposition({ background: { mode: "none" } })}
                  class={`py-1.5 rounded text-[11px] font-medium transition cursor-pointer ${
                    composition()?.background?.mode === "none"
                      ? "bg-zinc-800 text-white shadow-sm font-semibold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Pure Black
                </button>
              </div>
            </div>

            {/* Gameplay Fit & Scaling */}
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Gameplay Framing Fit
              </label>
              <div class="grid grid-cols-3 gap-1 p-0.5 bg-zinc-900 border border-zinc-800 rounded-lg mb-3">
                <button
                  type="button"
                  onClick={() => projectSignals.updateComposition({ gameplay: { mode: "contain", scale: 1.0 } })}
                  class={`py-1.5 rounded text-[11px] font-medium transition cursor-pointer ${
                    composition()?.gameplay?.mode === "contain"
                      ? "bg-zinc-800 text-white shadow-sm font-semibold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Fit (Letterbox)
                </button>
                <button
                  type="button"
                  onClick={() => projectSignals.updateComposition({ gameplay: { mode: "cover", scale: 1.0 } })}
                  class={`py-1.5 rounded text-[11px] font-medium transition cursor-pointer ${
                    composition()?.gameplay?.mode === "cover"
                      ? "bg-zinc-800 text-white shadow-sm font-semibold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Fill (Crop)
                </button>
                <button
                  type="button"
                  onClick={() => projectSignals.updateComposition({ gameplay: { mode: "stretch", scale: 1.0 } })}
                  class={`py-1.5 rounded text-[11px] font-medium transition cursor-pointer ${
                    composition()?.gameplay?.mode === "stretch"
                      ? "bg-zinc-800 text-white shadow-sm font-semibold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Stretch
                </button>
              </div>

              {/* Scale Slider */}
              <div class="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                <div class="flex items-center justify-between text-[11px]">
                  <span class="text-zinc-400">Scale Multiplier</span>
                  <span class="font-mono text-zinc-200 font-semibold">{composition()?.gameplay?.scale || 1.0}×</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={composition()?.gameplay?.scale || 1.0}
                  onInput={(e) => {
                    const val = parseFloat((e.target as HTMLInputElement).value);
                    projectSignals.updateComposition({
                      gameplay: {
                        mode: composition()?.gameplay?.mode || "contain",
                        scale: val
                      }
                    });
                  }}
                  class="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Overlay Branding */}
            <div class="border-t border-zinc-800/80 pt-4 space-y-3">
              <div class="flex items-center justify-between">
                <label class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Header & Title Overlays
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={composition()?.overlay?.enabled ?? true}
                    onChange={(e) => {
                      projectSignals.updateComposition({
                        overlay: {
                          ...composition()?.overlay,
                          enabled: (e.target as HTMLInputElement).checked
                        }
                      });
                    }}
                    class="rounded accent-blue-500 cursor-pointer"
                  />
                  <span class="text-[11px] text-zinc-400">Enabled</span>
                </label>
              </div>

              <Show when={composition()?.overlay?.enabled ?? true}>
                <div class="space-y-3">
                  {/* PNG Title Image / Logo */}
                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] text-zinc-400 font-medium">Header Title PNG Image</span>
                      <Show when={composition()?.overlay?.logoPath}>
                        <button
                          type="button"
                          onClick={() =>
                            projectSignals.updateComposition({
                              overlay: {
                                ...(composition()?.overlay || {}),
                                enabled: true,
                                logoPath: undefined
                              }
                            })
                          }
                          class="text-[9px] text-red-400 hover:text-red-300 cursor-pointer flex items-center gap-1 transition"
                          title="Remove heading logo image"
                        >
                          <Trash2 size={10} />
                          <span>Remove</span>
                        </button>
                      </Show>
                    </div>

                    <Show
                      when={composition()?.overlay?.logoPath}
                      fallback={
                        <button
                          type="button"
                          onClick={async () => {
                            const file = await openFileDialog({
                              title: "Select Title PNG Image",
                              filters: [{ name: "PNG Images (*.png)", extensions: ["png"] }]
                            });
                            if (file) {
                              projectSignals.updateComposition({
                                overlay: {
                                  ...(composition()?.overlay || { brandTitle: "CLYPTIK", episodeLabel: "PART" }),
                                  enabled: true,
                                  logoPath: file,
                                  logoScale: composition()?.overlay?.logoScale || 1.0
                                }
                              });
                            }
                          }}
                          class="w-full py-2.5 px-3 border border-dashed border-zinc-700 hover:border-blue-500/80 rounded-lg bg-zinc-950/60 hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 text-xs flex items-center justify-center gap-2 cursor-pointer transition group"
                        >
                          <Image size={14} class="text-zinc-500 group-hover:text-blue-400 transition" />
                          <span>Choose PNG Title Logo...</span>
                        </button>
                      }
                    >
                      <div class="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                        <div class="flex items-center gap-2.5">
                          <div class="w-14 h-11 rounded bg-zinc-900 border border-zinc-700/60 flex items-center justify-center p-1 overflow-hidden shrink-0">
                            <Show
                              when={inspectorLogoAssetUrl()}
                              fallback={<div class="text-[9px] text-zinc-500 font-mono">PNG</div>}
                            >
                              <img
                                src={inspectorLogoAssetUrl()!}
                                alt="Heading Logo"
                                class="max-w-full max-h-full object-contain"
                              />
                            </Show>
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="text-[11px] font-mono text-zinc-200 truncate" title={composition()?.overlay?.logoPath}>
                              {composition()?.overlay?.logoPath?.split(/[/\\]/).pop()}
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                const file = await openFileDialog({
                                  title: "Select Title PNG Image",
                                  filters: [{ name: "PNG Images (*.png)", extensions: ["png"] }]
                                });
                                if (file) {
                                  projectSignals.updateComposition({
                                    overlay: {
                                      ...(composition()?.overlay || {}),
                                      enabled: true,
                                      logoPath: file
                                    }
                                  });
                                }
                              }}
                              class="text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer transition"
                            >
                              Change Image...
                            </button>
                          </div>
                        </div>

                        {/* Logo Width & Scale */}
                        <div class="pt-2 border-t border-zinc-800/80 space-y-2">
                          <div class="space-y-1">
                            <div class="flex items-center justify-between text-[10px]">
                              <span class="text-zinc-400">Logo Width</span>
                              <span class="font-mono text-zinc-300 font-semibold">
                                {(composition()?.overlay?.logoWidth ?? 45).toFixed(0)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="15"
                              max="85"
                              step="1"
                              value={composition()?.overlay?.logoWidth ?? 45}
                              onInput={(e) => {
                                const val = parseFloat((e.target as HTMLInputElement).value);
                                projectSignals.updateComposition({
                                  overlay: {
                                    ...(composition()?.overlay || {}),
                                    enabled: true,
                                    logoWidth: val
                                  }
                                });
                              }}
                              class="w-full accent-blue-500 cursor-pointer"
                            />
                          </div>

                          {/* Logo X (Horizontal) */}
                          <div class="space-y-1">
                            <div class="flex items-center justify-between text-[10px]">
                              <span class="text-zinc-400">Horizontal (X)</span>
                              <span class="font-mono text-zinc-300 font-semibold">
                                {(composition()?.overlay?.logoX ?? 50).toFixed(0)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="10"
                              max="90"
                              step="0.5"
                              value={composition()?.overlay?.logoX ?? 50}
                              onInput={(e) => {
                                const val = parseFloat((e.target as HTMLInputElement).value);
                                projectSignals.updateComposition({
                                  overlay: {
                                    ...(composition()?.overlay || {}),
                                    enabled: true,
                                    logoX: val
                                  }
                                });
                              }}
                              class="w-full accent-blue-500 cursor-pointer"
                            />
                            <div class="grid grid-cols-3 gap-1 pt-0.5">
                              <button
                                type="button"
                                onClick={() => projectSignals.updateComposition({ overlay: { ...(composition()?.overlay || {}), enabled: true, logoX: 20 } })}
                                class="py-0.5 px-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[9px] text-zinc-400 text-center"
                              >
                                Left (20%)
                              </button>
                              <button
                                type="button"
                                onClick={() => projectSignals.updateComposition({ overlay: { ...(composition()?.overlay || {}), enabled: true, logoX: 50 } })}
                                class="py-0.5 px-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[9px] text-zinc-400 text-center"
                              >
                                Center (50%)
                              </button>
                              <button
                                type="button"
                                onClick={() => projectSignals.updateComposition({ overlay: { ...(composition()?.overlay || {}), enabled: true, logoX: 80 } })}
                                class="py-0.5 px-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[9px] text-zinc-400 text-center"
                              >
                                Right (80%)
                              </button>
                            </div>
                          </div>

                          {/* Logo Y (Vertical) */}
                          <div class="space-y-1">
                            <div class="flex items-center justify-between text-[10px]">
                              <span class="text-zinc-400">Vertical (Y)</span>
                              <span class="font-mono text-zinc-300 font-semibold">
                                {(composition()?.overlay?.logoY ?? 5.5).toFixed(1)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="85"
                              step="0.5"
                              value={composition()?.overlay?.logoY ?? 5.5}
                              onInput={(e) => {
                                const val = parseFloat((e.target as HTMLInputElement).value);
                                projectSignals.updateComposition({
                                  overlay: {
                                    ...(composition()?.overlay || {}),
                                    enabled: true,
                                    logoY: val
                                  }
                                });
                              }}
                              class="w-full accent-blue-500 cursor-pointer"
                            />
                            <div class="grid grid-cols-4 gap-1 pt-0.5">
                              <button
                                type="button"
                                onClick={() => projectSignals.updateComposition({ overlay: { ...(composition()?.overlay || {}), enabled: true, logoY: 5.5 } })}
                                class="py-0.5 px-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[9px] text-zinc-400 text-center"
                              >
                                Top (5.5%)
                              </button>
                              <button
                                type="button"
                                onClick={() => projectSignals.updateComposition({ overlay: { ...(composition()?.overlay || {}), enabled: true, logoY: 12 } })}
                                class="py-0.5 px-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[9px] text-zinc-400 text-center"
                              >
                                Upper (12%)
                              </button>
                              <button
                                type="button"
                                onClick={() => projectSignals.updateComposition({ overlay: { ...(composition()?.overlay || {}), enabled: true, logoY: 50 } })}
                                class="py-0.5 px-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[9px] text-zinc-400 text-center"
                              >
                                Mid (50%)
                              </button>
                              <button
                                type="button"
                                onClick={() => projectSignals.updateComposition({ overlay: { ...(composition()?.overlay || {}), enabled: true, logoY: 82 } })}
                                class="py-0.5 px-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[9px] text-zinc-400 text-center"
                              >
                                Bot (82%)
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Show>
                  </div>

                  <div class="space-y-2 pt-1 border-t border-zinc-800/60">
                    <div>
                      <span class="block text-[10px] text-zinc-400 mb-1">Header Brand Title (Text)</span>
                      <input
                        type="text"
                        placeholder="e.g. CLYPTIK (or leave empty if using PNG only)"
                        value={composition()?.overlay?.brandTitle || ""}
                        onInput={(e) => {
                          projectSignals.updateComposition({
                            overlay: {
                              ...composition()?.overlay,
                              enabled: true,
                              brandTitle: (e.target as HTMLInputElement).value
                            }
                          });
                        }}
                        class="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200 outline-none focus:border-zinc-700 placeholder:text-zinc-500"
                      />
                    </div>

                    <Show when={composition()?.overlay?.brandTitle}>
                      {/* Title Font Size & Placement Controls */}
                      <div class="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                        <div class="space-y-1">
                          <div class="flex items-center justify-between text-[10px]">
                            <span class="text-zinc-400">Title Font Size</span>
                            <span class="font-mono text-zinc-300 font-semibold">
                              {composition()?.overlay?.titleFontSize ?? 36}px
                            </span>
                          </div>
                          <input
                            type="range"
                            min="20"
                            max="64"
                            step="2"
                            value={composition()?.overlay?.titleFontSize ?? 36}
                            onInput={(e) => {
                              const val = parseInt((e.target as HTMLInputElement).value, 10);
                              projectSignals.updateComposition({
                                overlay: {
                                  ...(composition()?.overlay || {}),
                                  enabled: true,
                                  titleFontSize: val
                                }
                              });
                            }}
                            class="w-full accent-blue-500 cursor-pointer"
                          />
                        </div>

                        <div class="space-y-1">
                          <div class="flex items-center justify-between text-[10px]">
                            <span class="text-zinc-400">Title Vertical (Y)</span>
                            <span class="font-mono text-zinc-300 font-semibold">
                              {(composition()?.overlay?.titleY ?? (composition()?.overlay?.logoPath ? 13.5 : 6.5)).toFixed(1)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="85"
                            step="0.5"
                            value={composition()?.overlay?.titleY ?? (composition()?.overlay?.logoPath ? 13.5 : 6.5)}
                            onInput={(e) => {
                              const val = parseFloat((e.target as HTMLInputElement).value);
                              projectSignals.updateComposition({
                                overlay: {
                                  ...(composition()?.overlay || {}),
                                  enabled: true,
                                  titleY: val
                                }
                              });
                            }}
                            class="w-full accent-blue-500 cursor-pointer"
                          />
                          <div class="grid grid-cols-3 gap-1 pt-0.5">
                            <button
                              type="button"
                              onClick={() => projectSignals.updateComposition({ overlay: { ...(composition()?.overlay || {}), enabled: true, titleY: 6.5 } })}
                              class="py-0.5 px-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[9px] text-zinc-400 text-center"
                            >
                              Top (6.5%)
                            </button>
                            <button
                              type="button"
                              onClick={() => projectSignals.updateComposition({ overlay: { ...(composition()?.overlay || {}), enabled: true, titleY: 13.5 } })}
                              class="py-0.5 px-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[9px] text-zinc-400 text-center"
                            >
                              Sub (13.5%)
                            </button>
                            <button
                              type="button"
                              onClick={() => projectSignals.updateComposition({ overlay: { ...(composition()?.overlay || {}), enabled: true, titleY: 50 } })}
                              class="py-0.5 px-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[9px] text-zinc-400 text-center"
                            >
                              Mid (50%)
                            </button>
                          </div>
                        </div>

                        <div class="space-y-1">
                          <div class="flex items-center justify-between text-[10px]">
                            <span class="text-zinc-400">Title Horizontal (X)</span>
                            <span class="font-mono text-zinc-300 font-semibold">
                              {(composition()?.overlay?.titleX ?? 50).toFixed(0)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="90"
                            step="0.5"
                            value={composition()?.overlay?.titleX ?? 50}
                            onInput={(e) => {
                              const val = parseFloat((e.target as HTMLInputElement).value);
                              projectSignals.updateComposition({
                                overlay: {
                                  ...(composition()?.overlay || {}),
                                  enabled: true,
                                  titleX: val
                                }
                              });
                            }}
                            class="w-full accent-blue-500 cursor-pointer"
                          />
                        </div>
                      </div>
                    </Show>
                  </div>

                  <div class="space-y-2 pt-1 border-t border-zinc-800/60">
                    <div>
                      <span class="block text-[10px] text-zinc-400 mb-1">Bottom Episode Label</span>
                      <input
                        type="text"
                        placeholder="e.g. PART"
                        value={composition()?.overlay?.episodeLabel || "PART"}
                        onInput={(e) => {
                          projectSignals.updateComposition({
                            overlay: {
                              ...composition()?.overlay,
                              enabled: true,
                              episodeLabel: (e.target as HTMLInputElement).value
                            }
                          });
                        }}
                        class="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200 outline-none focus:border-zinc-700"
                      />
                    </div>

                    <div class="space-y-1">
                      <div class="flex items-center justify-between text-[10px]">
                        <span class="text-zinc-400">Episode Tag Vertical (Y)</span>
                        <span class="font-mono text-zinc-300 font-semibold">
                          {(composition()?.overlay?.episodeY ?? 90).toFixed(0)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="60"
                        max="96"
                        step="0.5"
                        value={composition()?.overlay?.episodeY ?? 90}
                        onInput={(e) => {
                          const val = parseFloat((e.target as HTMLInputElement).value);
                          projectSignals.updateComposition({
                            overlay: {
                              ...(composition()?.overlay || {}),
                              enabled: true,
                              episodeY: val
                            }
                          });
                        }}
                        class="w-full accent-blue-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div class="pt-1 text-[9px] text-zinc-500 bg-zinc-900/50 p-2 rounded border border-zinc-800/60 leading-relaxed">
                    <span class="text-blue-400 font-bold block mb-0.5">💡 Interactive Live Placement</span>
                    You can drag the Logo, Title, or Episode tag directly on the 9:16 vertical video preview. The preview and final render are mathematically 1:1 identical.
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </Show>

        {/* ===================== TAB 2: SLICING ===================== */}
        <Show when={activeTab() === "slicing"}>
          <div class="space-y-4">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Slicing Strategy
              </label>
              <div class="grid grid-cols-2 gap-1 p-0.5 bg-zinc-900 border border-zinc-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => projectSignals.setClippingMode("automatic")}
                  class={`py-1.5 rounded text-[11px] font-medium transition cursor-pointer ${
                    clipSettings()?.mode === "automatic"
                      ? "bg-zinc-800 text-white shadow-sm font-semibold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Automatic Parts
                </button>
                <button
                  type="button"
                  onClick={() => projectSignals.setClippingMode("manual")}
                  class={`py-1.5 rounded text-[11px] font-medium transition cursor-pointer ${
                    clipSettings()?.mode === "manual"
                      ? "bg-zinc-800 text-white shadow-sm font-semibold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Manual In/Out
                </button>
              </div>
            </div>

            {/* Automatic Slicing Controls */}
            <Show when={clipSettings()?.mode === "automatic"}>
              <div class="space-y-3.5">
                <div class="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="text-zinc-400">Target Duration</span>
                    <span class="font-mono text-zinc-200 font-semibold">
                      {(clipSettings() as any)?.durationSeconds || 60}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="180"
                    step="5"
                    value={(clipSettings() as any)?.durationSeconds || 60}
                    onInput={(e) => {
                      const val = parseInt((e.target as HTMLInputElement).value, 10);
                      projectSignals.updateClipSettings({ durationSeconds: val });
                    }}
                    class="w-full accent-blue-500 cursor-pointer"
                  />
                  <div class="flex justify-between text-[9px] font-mono text-zinc-600">
                    <span>15s (Shorts)</span>
                    <span>60s (Standard)</span>
                    <span>180s (Long)</span>
                  </div>
                </div>

                <div class="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="text-zinc-400">Overlap Buffer</span>
                    <span class="font-mono text-zinc-200 font-semibold">
                      {(clipSettings() as any)?.overlapSeconds || 0}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={(clipSettings() as any)?.overlapSeconds || 0}
                    onInput={(e) => {
                      const val = parseInt((e.target as HTMLInputElement).value, 10);
                      projectSignals.updateClipSettings({ overlapSeconds: val });
                    }}
                    class="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                <div class="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span class="text-[11px] text-zinc-400">Starting Episode #</span>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={(clipSettings() as any)?.startingEpisode || 1}
                    onInput={(e) => {
                      const val = parseInt((e.target as HTMLInputElement).value, 10) || 1;
                      projectSignals.updateClipSettings({ startingEpisode: val });
                    }}
                    class="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-center text-xs font-mono text-zinc-200 outline-none"
                  />
                </div>
              </div>
            </Show>

            {/* Manual Marker Controls */}
            <Show when={clipSettings()?.mode === "manual"}>
              <div class="space-y-3">
                <div class="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                  <span class="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Quick Marker Punch
                  </span>
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => timelineSignals.setInPoint()}
                      class="px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer transition flex items-center justify-center gap-1.5"
                    >
                      <span>Mark In [</span>
                      <Show when={timelineSignals.inPoint() !== null}>
                        <span class="font-mono text-blue-400 text-[10px]">{formatTime(timelineSignals.inPoint()!)}</span>
                      </Show>
                    </button>
                    <button
                      type="button"
                      onClick={() => timelineSignals.setOutPoint()}
                      class="px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer transition flex items-center justify-center gap-1.5"
                    >
                      <span>Mark Out ]</span>
                      <Show when={timelineSignals.outPoint() !== null}>
                        <span class="font-mono text-blue-400 text-[10px]">{formatTime(timelineSignals.outPoint()!)}</span>
                      </Show>
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={!timelineSignals.hasSelectionRange()}
                    onClick={() => {
                      if (timelineSignals.hasSelectionRange()) {
                        projectSignals.addManualClipRange(timelineSignals.inPoint()!, timelineSignals.outPoint()!);
                        timelineSignals.clearMarkers();
                      }
                    }}
                    class={`w-full py-1.5 rounded text-xs font-semibold cursor-pointer transition flex items-center justify-center gap-1.5 ${
                      timelineSignals.hasSelectionRange()
                        ? "bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
                        : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    }`}
                  >
                    <Plus size={13} />
                    <span>Create Clip from Range</span>
                  </button>
                </div>

                {/* Manual Clips List */}
                <div class="space-y-1.5">
                  <span class="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Defined Clips ({(clipSettings() as any)?.clips?.length || 0})
                  </span>

                  <div class="max-h-52 overflow-y-auto space-y-1">
                    <For each={(clipSettings() as any)?.clips || []}>
                      {(item: any, idx) => (
                        <div class="p-2 rounded bg-zinc-900 border border-zinc-800/80 flex items-center justify-between text-[11px]">
                          <div>
                            <div class="font-medium text-zinc-200">
                              {item.title || `Part ${String(idx() + 1).padStart(3, "0")}`}
                            </div>
                            <div class="font-mono text-[10px] text-zinc-500">
                              {formatTime(item.start)} → {formatTime(item.end)} ({Math.round((item.end - item.start) * 10) / 10}s)
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => projectSignals.removeManualClipItem(idx() + 1)}
                            class="p-1 hover:text-red-400 text-zinc-500 cursor-pointer"
                            title="Remove clip"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </Show>
          </div>
        </Show>

        {/* ===================== TAB 3: AUDIO & SYNC ===================== */}
        <Show when={activeTab() === "audio"}>
          <div class="space-y-4">
            {/* Primary Track Info */}
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Primary Video Audio Track
              </label>
              <div class="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div class="font-medium text-zinc-200">Embedded Stream</div>
                  <div class="text-[10px] font-mono text-zinc-500">
                    {videoMeta()?.hasAudio ? "AAC Stereo 48kHz" : "No Audio Track"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={projectSignals.toggleVideoAudioMute}
                  class={`px-2 py-1 rounded text-xs font-medium cursor-pointer transition flex items-center gap-1 ${
                    projectSignals.isVideoAudioMuted()
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : "bg-zinc-800 text-zinc-300"
                  }`}
                >
                  <Show when={projectSignals.isVideoAudioMuted()} fallback={<Volume2 size={12} />}>
                    <VolumeX size={12} />
                  </Show>
                  <span>{projectSignals.isVideoAudioMuted() ? "Muted" : "Active"}</span>
                </button>
              </div>
            </div>

            {/* Dedicated High-Quality Track */}
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Separate Microphone / Mix Track
              </label>
              <Show
                when={project()?.sources?.audio}
                fallback={
                  <button
                    type="button"
                    onClick={handleBrowseAudio}
                    class="w-full py-3 rounded-lg border border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-900/40 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-xs font-medium cursor-pointer transition flex flex-col items-center gap-1"
                  >
                    <Music size={16} class="text-zinc-500" />
                    <span>Attach Separate Audio Track</span>
                    <span class="text-[10px] font-mono text-zinc-600">Supports .weba, .wav, .mp3, .m4a</span>
                  </button>
                }
              >
                <div class="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-zinc-200 truncate max-w-[180px]">
                      {project()?.sources.audio?.path.split(/[/\\]/).pop()}
                    </span>
                    <button
                      type="button"
                      onClick={() => projectSignals.loadAudioSource("")}
                      class="text-zinc-500 hover:text-red-400 cursor-pointer"
                      title="Detach Audio Track"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="text-zinc-500 font-mono">Dedicated Stream Attached</span>
                    <button
                      type="button"
                      onClick={projectSignals.toggleDedicatedAudioMute}
                      class={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer transition ${
                        projectSignals.isDedicatedAudioMuted()
                          ? "bg-red-500/20 text-red-400"
                          : "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      {projectSignals.isDedicatedAudioMuted() ? "Muted" : "Active"}
                    </button>
                  </div>
                </div>
              </Show>
            </div>

            {/* Audio Synchronization Offset */}
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Audio Sync Offset
                </label>
                <button
                  type="button"
                  onClick={() => projectSignals.setAudioOffset(0)}
                  class="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  Reset (0ms)
                </button>
              </div>

              <div class="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                <div class="flex items-center justify-between text-[11px]">
                  <span class="text-zinc-400">Delay / Advance</span>
                  <span class="font-mono text-blue-400 font-semibold">
                    {syncSettings()?.audioOffsetMs || 0} ms
                  </span>
                </div>
                <input
                  type="range"
                  min="-2000"
                  max="2000"
                  step="25"
                  value={syncSettings()?.audioOffsetMs || 0}
                  onInput={(e) => {
                    const val = parseInt((e.target as HTMLInputElement).value, 10);
                    projectSignals.setAudioOffset(val);
                  }}
                  class="w-full accent-blue-500 cursor-pointer"
                />

                <div class="flex items-center justify-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => projectSignals.adjustAudioOffset(-50)}
                    class="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono text-zinc-300 cursor-pointer"
                  >
                    -50ms
                  </button>
                  <button
                    type="button"
                    onClick={() => projectSignals.adjustAudioOffset(-10)}
                    class="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono text-zinc-300 cursor-pointer"
                  >
                    -10ms
                  </button>
                  <button
                    type="button"
                    onClick={() => projectSignals.adjustAudioOffset(10)}
                    class="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono text-zinc-300 cursor-pointer"
                  >
                    +10ms
                  </button>
                  <button
                    type="button"
                    onClick={() => projectSignals.adjustAudioOffset(50)}
                    class="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono text-zinc-300 cursor-pointer"
                  >
                    +50ms
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Show>

        {/* ===================== TAB 4: SOURCE INFO ===================== */}
        <Show when={activeTab() === "source"}>
          <div class="space-y-4">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Input Video Stream
              </label>
              <div class="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                <div class="font-medium text-zinc-200 truncate">
                  {project()?.sources.video.path.split(/[/\\]/).pop() || "No file"}
                </div>
                <div class="text-[10px] font-mono text-zinc-500 break-all">
                  {project()?.sources.video.path}
                </div>

                <div class="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/80 text-[11px] font-mono">
                  <div>
                    <span class="text-zinc-500 block text-[9px] uppercase">Duration</span>
                    <span class="text-zinc-200">{formatTime(videoMeta()?.durationSeconds || 0)}</span>
                  </div>
                  <div>
                    <span class="text-zinc-500 block text-[9px] uppercase">Resolution</span>
                    <span class="text-zinc-200">{videoMeta()?.width}×{videoMeta()?.height}</span>
                  </div>
                  <div>
                    <span class="text-zinc-500 block text-[9px] uppercase">Framerate</span>
                    <span class="text-zinc-200">{videoMeta()?.fps || 60} fps</span>
                  </div>
                  <div>
                    <span class="text-zinc-500 block text-[9px] uppercase">Codec</span>
                    <span class="text-zinc-200">{videoMeta()?.codec || "h264"}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleBrowseVideo}
              class="w-full py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={12} />
              <span>Replace Video Source</span>
            </button>
          </div>
        </Show>
      </div>
    </aside>
  );
};
