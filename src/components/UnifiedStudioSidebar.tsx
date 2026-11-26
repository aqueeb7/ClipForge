import { Component, createSignal, createMemo, createEffect, Show, For } from "solid-js";
import { projectSignals } from "../stores/project";
import { timelineSignals } from "../stores/timeline";
import { chatReplaySignals } from "../stores/chatReplay";
import { intelligenceSignals } from "../stores/intelligence";
import { openFileDialog, getMediaAssetUrl, isTauriEnvironment } from "../services/api";
import { ClipPlanList } from "./ClipPlanList";
import { HighlightCandidatesDrawer } from "./HighlightCandidatesDrawer";
import { ChatReplayDrawer } from "./ChatReplayDrawer";
import {
  Sliders,
  Scissors,
  Sparkles,
  Music,
  Film,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  ChevronRight,
  ChevronLeft,
  MessageSquare,
  Flame,
  Layers,
  Type,
  CheckCircle2,
  Image,
} from "./Icons";
import type { Clip } from "../types/index.js";

interface UnifiedStudioSidebarProps {
  onPublishClip?: (clip: Clip) => void;
}

export const UnifiedStudioSidebar: Component<UnifiedStudioSidebarProps> = (props) => {
  const activeTab = projectSignals.activeStudioSidebarTab;
  const setActiveTab = projectSignals.setActiveStudioSidebarTab;
  const isCollapsed = projectSignals.isStudioSidebarCollapsed;
  const setIsCollapsed = projectSignals.setIsStudioSidebarCollapsed;
  const intelSubTab = projectSignals.intelSubTab;
  const setIntelSubTab = projectSignals.setIntelSubTab;

  const project = projectSignals.currentProject;
  const videoMeta = projectSignals.videoMetadata;
  const audioMeta = projectSignals.audioMetadata;
  const composition = createMemo(() => project()?.composition);
  const clipSettings = createMemo(() => project()?.clipSettings);
  const clips = createMemo(() => projectSignals.currentManifest()?.clips ?? []);
  const shorts = createMemo(() => projectSignals.shortClips());

  const [sidebarLogoAssetUrl, setSidebarLogoAssetUrl] = createSignal<string | null>(null);

  createEffect(() => {
    const rawPath = composition()?.overlay?.logoPath;
    if (rawPath) {
      getMediaAssetUrl(rawPath)
        .then((url) => setSidebarLogoAssetUrl(url))
        .catch(() => setSidebarLogoAssetUrl(null));
    } else {
      setSidebarLogoAssetUrl(null);
    }
  });

  const totalClipsCount = createMemo(() => clips().length + shorts().length);
  const totalIntelCount = createMemo(() => {
    const cand = intelligenceSignals.totalCandidates() || intelligenceSignals.totalMoments();
    const chat = chatReplaySignals.hasChat() ? 1 : 0;
    return cand + chat;
  });

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
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
    <aside
      class={`h-full shrink-0 select-none transition-all duration-200 flex flex-col ${
        isCollapsed() ? "w-11" : "w-[430px]"
      }`}
    >
      <div class="h-full w-full bg-zinc-950 border border-zinc-800/80 rounded-xl flex flex-col overflow-hidden shadow-2xl">
        {/* ===================== COLLAPSED VIEW ===================== */}
        <Show
          when={!isCollapsed()}
          fallback={
            <div class="h-full flex flex-col items-center py-2.5 gap-2 bg-zinc-950 text-zinc-400">
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                class="w-7 h-7 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer transition"
                title="Expand Studio Sidebar"
              >
                <ChevronLeft size={14} />
              </button>

              <div class="w-5 h-px bg-zinc-800 my-1" />

              <button
                type="button"
                onClick={() => {
                  setActiveTab("framing");
                  setIsCollapsed(false);
                }}
                class={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition ${
                  activeTab() === "framing" ? "bg-blue-600 text-white" : "hover:bg-zinc-800 text-zinc-400"
                }`}
                title="Framing & Canvas"
              >
                <Sliders size={14} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("clips");
                  setIsCollapsed(false);
                }}
                class={`w-8 h-8 rounded-lg relative flex items-center justify-center cursor-pointer transition ${
                  activeTab() === "clips" ? "bg-blue-600 text-white" : "hover:bg-zinc-800 text-zinc-400"
                }`}
                title="Clips & Manifest"
              >
                <Scissors size={14} />
                <Show when={totalClipsCount() > 0}>
                  <span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400" />
                </Show>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("intelligence");
                  setIsCollapsed(false);
                }}
                class={`w-8 h-8 rounded-lg relative flex items-center justify-center cursor-pointer transition ${
                  activeTab() === "intelligence" ? "bg-amber-500 text-black" : "hover:bg-zinc-800 text-amber-400"
                }`}
                title="AI Highlights & Chat"
              >
                <Sparkles size={14} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("audio");
                  setIsCollapsed(false);
                }}
                class={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition ${
                  activeTab() === "audio" ? "bg-blue-600 text-white" : "hover:bg-zinc-800 text-zinc-400"
                }`}
                title="Audio Track & Sync"
              >
                <Music size={14} />
              </button>
            </div>
          }
        >
          {/* ===================== EXPANDED HEADER & TABS ===================== */}
          <div class="h-10 border-b border-zinc-800/80 bg-zinc-900/70 flex items-center justify-between px-2 gap-1 shrink-0 overflow-x-auto no-scrollbar">
            {/* 4 Primary Navigation Tabs */}
            <div class="flex items-center gap-1 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => setActiveTab("framing")}
                class={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeTab() === "framing"
                    ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                }`}
                title="Canvas & Visual 9:16 Framing"
              >
                <Sliders size={12} class={activeTab() === "framing" ? "text-blue-400" : ""} />
                <span>Framing</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("clips")}
                class={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeTab() === "clips"
                    ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                }`}
                title="Clip & Short Manifest"
              >
                <Scissors size={12} class={activeTab() === "clips" ? "text-amber-400" : ""} />
                <span>Clips</span>
                <Show when={totalClipsCount() > 0}>
                  <span class="px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums bg-zinc-800 text-zinc-300">
                    {totalClipsCount()}
                  </span>
                </Show>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("intelligence")}
                class={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeTab() === "intelligence"
                    ? "bg-zinc-800 text-amber-300 shadow-sm border border-zinc-700/50"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                }`}
                title="AI Highlights & Synchronized Chat"
              >
                <Sparkles size={12} class="text-amber-400" />
                <span>AI & Chat</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("audio")}
                class={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeTab() === "audio"
                    ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                }`}
                title="Audio Sync & Tracks"
              >
                <Music size={12} class={activeTab() === "audio" ? "text-emerald-400" : ""} />
                <span>Audio</span>
              </button>
            </div>

            {/* Collapse Button */}
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              class="w-6 h-6 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center cursor-pointer transition shrink-0 ml-1"
              title="Collapse Studio Sidebar"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* ===================== TAB CONTENT AREA ===================== */}
          <div class="flex-1 min-h-0 overflow-hidden flex flex-col bg-zinc-950">
            {/* TAB 1: FRAMING & CANVAS */}
            <Show when={activeTab() === "framing"}>
              <div class="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-zinc-300">
                {/* Canvas Badge */}
                <div class="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                  <div>
                    <div class="font-medium text-zinc-200">Vertical 9:16 Canvas</div>
                    <div class="text-[10px] text-zinc-500 font-mono">1080 × 1920 Full HD Output</div>
                  </div>
                  <span class="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-[10px] font-semibold">
                    9:16 Shorts
                  </span>
                </div>

                {/* Stacking & Framing Templates */}
                <div>
                  <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Framing Template
                  </label>
                  <div class="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        projectSignals.updateComposition({
                          stacking: {
                            ...(composition()?.stacking || {}),
                            template: "stacked_split",
                            topHeightPercent: composition()?.stacking?.topHeightPercent || 35,
                            topRegion: composition()?.stacking?.topRegion || { x: 2, y: 5, width: 28, height: 35 },
                            bottomRegion: composition()?.stacking?.bottomRegion || { x: 0, y: 15, width: 100, height: 85 }
                          }
                        })
                      }
                      class={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                        composition()?.stacking?.template === "stacked_split"
                          ? "border-amber-500 bg-amber-950/30 text-amber-200"
                          : "border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400"
                      }`}
                    >
                      <span class="text-xs font-bold text-zinc-200 block">Cam + Game</span>
                      <span class="text-[9px] text-zinc-500 mt-1 leading-tight">Facecam top + gameplay bottom split</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        projectSignals.updateComposition({
                          stacking: {
                            ...(composition()?.stacking || {}),
                            template: "blur_fill"
                          }
                        })
                      }
                      class={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                        (composition()?.stacking?.template || "blur_fill") === "blur_fill"
                          ? "border-blue-500 bg-blue-950/30 text-blue-200"
                          : "border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400"
                      }`}
                    >
                      <span class="text-xs font-bold text-zinc-200 block">Blur Fill</span>
                      <span class="text-[9px] text-zinc-500 mt-1 leading-tight">9:16 Letterbox with blurred background</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        projectSignals.updateComposition({
                          stacking: {
                            ...(composition()?.stacking || {}),
                            template: "split_50_50",
                            topHeightPercent: 50,
                            topRegion: composition()?.stacking?.topRegion || { x: 0, y: 0, width: 100, height: 50 },
                            bottomRegion: composition()?.stacking?.bottomRegion || { x: 0, y: 50, width: 100, height: 50 }
                          }
                        })
                      }
                      class={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                        composition()?.stacking?.template === "split_50_50"
                          ? "border-emerald-500 bg-emerald-950/30 text-emerald-200"
                          : "border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400"
                      }`}
                    >
                      <span class="text-xs font-bold text-zinc-200 block">50 / 50 Split</span>
                      <span class="text-[9px] text-zinc-500 mt-1 leading-tight">Dual equal camera view for reactions</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        projectSignals.updateComposition({
                          stacking: {
                            ...(composition()?.stacking || {}),
                            template: "pan_scan",
                            cropRegion: composition()?.stacking?.cropRegion || { x: 21.875, y: 0, width: 56.25, height: 100 }
                          }
                        })
                      }
                      class={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                        composition()?.stacking?.template === "pan_scan"
                          ? "border-purple-500 bg-purple-950/30 text-purple-200"
                          : "border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400"
                      }`}
                    >
                      <span class="text-xs font-bold text-zinc-200 block">Pan & Scan</span>
                      <span class="text-[9px] text-zinc-500 mt-1 leading-tight">Direct 9:16 crop window across stream</span>
                    </button>
                  </div>
                </div>

                {/* Stacking Dual Zone Ratio Slider */}
                <Show when={composition()?.stacking?.template === "stacked_split" || composition()?.stacking?.template === "split_50_50"}>
                  <div class="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                    <div class="flex items-center justify-between text-[11px]">
                      <span class="font-bold text-amber-300">Vertical Split Ratio</span>
                      <span class="font-mono text-zinc-300">
                        Top {composition()?.stacking?.topHeightPercent || 35}% / Bot {100 - (composition()?.stacking?.topHeightPercent || 35)}%
                      </span>
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

                    {/* Quick Facecam Preset Positions */}
                    <div class="pt-2 border-t border-zinc-800 space-y-1">
                      <span class="text-[10px] uppercase font-bold text-zinc-400 block">Quick Facecam Presets</span>
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

                {/* Pan & Scan Horizontal Offset Slider */}
                <Show when={composition()?.stacking?.template === "pan_scan"}>
                  <div class="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                    <div class="flex items-center justify-between text-[11px]">
                      <span class="font-bold text-purple-300">Horizontal Pan Window</span>
                      <span class="font-mono text-zinc-300">
                        {((composition()?.stacking?.cropRegion?.x ?? 21.875) + 28.125).toFixed(0)}%
                      </span>
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

                {/* Branding & Overlay Settings */}
                <div class="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2.5">
                  <div class="flex items-center justify-between">
                    <label class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Channel Branding Overlay
                    </label>
                    <input
                      type="checkbox"
                      checked={composition()?.overlay?.enabled ?? true}
                      onChange={(e) =>
                        projectSignals.updateComposition({
                          overlay: {
                            ...(composition()?.overlay || { brandTitle: "CLYPTIK", episodeLabel: "PART" }),
                            enabled: (e.target as HTMLInputElement).checked
                          }
                        })
                      }
                      class="rounded accent-blue-500 cursor-pointer"
                    />
                  </div>

                  <Show when={composition()?.overlay?.enabled ?? true}>
                    <div class="space-y-3 pt-1">
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
                                  when={sidebarLogoAssetUrl()}
                                  fallback={<div class="text-[9px] text-zinc-500 font-mono">PNG</div>}
                                >
                                  <img
                                    src={sidebarLogoAssetUrl()!}
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

                            {/* Logo Scale Slider */}
                            <div class="pt-1.5 border-t border-zinc-800/80 space-y-1">
                              <div class="flex items-center justify-between text-[10px]">
                                <span class="text-zinc-400">Logo Size</span>
                                <span class="font-mono text-zinc-300 font-semibold">
                                  {Math.round((composition()?.overlay?.logoScale || 1.0) * 100)}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0.5"
                                max="1.6"
                                step="0.05"
                                value={composition()?.overlay?.logoScale || 1.0}
                                onInput={(e) => {
                                  const val = parseFloat((e.target as HTMLInputElement).value);
                                  projectSignals.updateComposition({
                                    overlay: {
                                      ...(composition()?.overlay || {}),
                                      enabled: true,
                                      logoScale: val
                                    }
                                  });
                                }}
                                class="w-full accent-blue-500 cursor-pointer"
                              />
                            </div>
                          </div>
                        </Show>
                      </div>

                      <div>
                        <span class="text-[10px] text-zinc-400 block mb-1">Header Brand Title (Text)</span>
                        <input
                          type="text"
                          placeholder="e.g. CLYPTIK (or leave empty if using PNG only)"
                          value={composition()?.overlay?.brandTitle || ""}
                          onInput={(e) =>
                            projectSignals.updateComposition({
                              overlay: {
                                ...(composition()?.overlay || { enabled: true, episodeLabel: "PART" }),
                                brandTitle: (e.target as HTMLInputElement).value
                              }
                            })
                          }
                          class="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 outline-none placeholder:text-zinc-500"
                        />
                      </div>
                      <div>
                        <span class="text-[10px] text-zinc-400 block mb-1">Episodic Tag (Full Stream Parts only)</span>
                        <input
                          type="text"
                          value={composition()?.overlay?.episodeLabel || "PART"}
                          onInput={(e) =>
                            projectSignals.updateComposition({
                              overlay: {
                                ...(composition()?.overlay || { enabled: true, brandTitle: "CLYPTIK" }),
                                episodeLabel: (e.target as HTMLInputElement).value
                              }
                            })
                          }
                          class="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 outline-none"
                        />
                      </div>
                    </div>
                  </Show>
                </div>
              </div>
            </Show>

            {/* TAB 2: CLIPS & SHORTS DECK */}
            <Show when={activeTab() === "clips"}>
              <div class="flex-1 min-h-0 overflow-hidden">
                <ClipPlanList onPublishClip={props.onPublishClip} />
              </div>
            </Show>

            {/* TAB 3: AI & CHAT INTELLIGENCE */}
            <Show when={activeTab() === "intelligence"}>
              <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* Sub-tab Selector: AI Highlights vs Live Chat */}
                <div class="p-2 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIntelSubTab("highlights")}
                    class={`flex-1 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      intelSubTab() === "highlights"
                        ? "bg-amber-500 text-black shadow-sm font-bold"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Sparkles size={12} class={intelSubTab() === "highlights" ? "text-black" : "text-amber-400"} />
                    <span>AI Highlights</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIntelSubTab("chat")}
                    class={`flex-1 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      intelSubTab() === "chat"
                        ? "bg-emerald-600 text-white shadow-sm font-bold"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <MessageSquare size={12} class={intelSubTab() === "chat" ? "text-white" : "text-emerald-400"} />
                    <span>Live Chat</span>
                  </button>
                </div>

                {/* AI Hardware Acceleration Info Banner */}
                <div class="px-2.5 py-1 bg-zinc-950 border-b border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400 shrink-0">
                  <div class="flex items-center gap-1.5 truncate">
                    <Sparkles size={10} class="text-amber-400 shrink-0" />
                    <span class="truncate">
                      AI Engine: <span class="text-amber-300 font-bold">{projectSignals.triEngineProfile()?.active_inference.name.split("(")[0] || "NVIDIA CUDA (MX350)"}</span>
                    </span>
                  </div>
                  <span class="px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-800/50 text-amber-300 text-[9px] shrink-0 font-bold">
                    640 CUDA Cores
                  </span>
                </div>

                <div class="flex-1 min-h-0 overflow-hidden">
                  <Show when={intelSubTab() === "highlights"}>
                    <HighlightCandidatesDrawer onClose={() => projectSignals.setIsStudioSidebarCollapsed(true)} />
                  </Show>
                  <Show when={intelSubTab() === "chat"}>
                    <ChatReplayDrawer onClose={() => projectSignals.setIsStudioSidebarCollapsed(true)} />
                  </Show>
                </div>
              </div>
            </Show>

            {/* TAB 4: AUDIO & SYNC */}
            <Show when={activeTab() === "audio"}>
              <div class="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-zinc-300">
                {/* Embedded Video Audio */}
                <div>
                  <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Primary Stream Audio
                  </label>
                  <div class="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                    <div>
                      <div class="font-medium text-zinc-200">Embedded Audio</div>
                      <div class="text-[10px] text-zinc-500 font-mono">
                        {videoMeta()?.hasAudio ? "AAC Stereo 48kHz" : "No Audio Track Detected"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={projectSignals.toggleVideoAudioMute}
                      class={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition flex items-center gap-1 ${
                        projectSignals.isVideoAudioMuted()
                          ? "bg-red-500/20 text-red-400 border border-red-500/40"
                          : "bg-zinc-800 text-zinc-300 hover:text-white"
                      }`}
                    >
                      <Show when={projectSignals.isVideoAudioMuted()} fallback={<Volume2 size={12} />}>
                        <VolumeX size={12} />
                      </Show>
                      <span>{projectSignals.isVideoAudioMuted() ? "Muted" : "Active"}</span>
                    </button>
                  </div>
                </div>

                {/* Separate Audio Track */}
                <div>
                  <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
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
                    <div class="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                      <div class="flex items-center justify-between">
                        <span class="font-medium text-zinc-200 truncate max-w-[200px]">
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
                        <span class="text-emerald-400 font-mono">Dedicated Stream Attached</span>
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

                {/* Audio Sync Offset Slider */}
                <div class="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2.5">
                  <div class="flex items-center justify-between">
                    <label class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Audio Sync Offset (ms)
                    </label>
                    <button
                      type="button"
                      onClick={() => projectSignals.setAudioOffset(0)}
                      class="text-[10px] font-mono text-blue-400 hover:text-blue-300 cursor-pointer"
                    >
                      Reset (0ms)
                    </button>
                  </div>

                  <div class="flex items-center justify-between font-mono text-xs">
                    <span class="text-zinc-500">-500ms</span>
                    <span class="text-zinc-100 font-bold px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                      {(project()?.synchronization.audioOffsetMs || 0) > 0 ? "+" : ""}
                      {project()?.synchronization.audioOffsetMs || 0} ms
                    </span>
                    <span class="text-zinc-500">+500ms</span>
                  </div>

                  <input
                    type="range"
                    min="-500"
                    max="500"
                    step="10"
                    value={project()?.synchronization.audioOffsetMs || 0}
                    onInput={(e) => {
                      const val = parseInt((e.target as HTMLInputElement).value, 10);
                      projectSignals.setAudioOffset(val);
                    }}
                    class="w-full accent-blue-500 cursor-pointer"
                  />

                  <div class="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => projectSignals.adjustAudioOffset(-50)}
                      class="flex-1 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono text-zinc-300 cursor-pointer transition"
                    >
                      -50ms
                    </button>
                    <button
                      type="button"
                      onClick={() => projectSignals.adjustAudioOffset(-10)}
                      class="flex-1 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono text-zinc-300 cursor-pointer transition"
                    >
                      -10ms
                    </button>
                    <button
                      type="button"
                      onClick={() => projectSignals.adjustAudioOffset(10)}
                      class="flex-1 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono text-zinc-300 cursor-pointer transition"
                    >
                      +10ms
                    </button>
                    <button
                      type="button"
                      onClick={() => projectSignals.adjustAudioOffset(50)}
                      class="flex-1 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono text-zinc-300 cursor-pointer transition"
                    >
                      +50ms
                    </button>
                  </div>
                </div>

                {/* Video Stream Info */}
                <Show when={videoMeta()}>
                  <div class="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1.5">
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Source Media Technical Spec
                    </label>
                    <div class="grid grid-cols-2 gap-1.5 text-[10px] font-mono text-zinc-400">
                      <div>Duration: <span class="text-zinc-200">{formatTime(videoMeta()?.durationSeconds || 0)}</span></div>
                      <div>Resolution: <span class="text-zinc-200">{videoMeta()?.width}×{videoMeta()?.height}</span></div>
                      <div>Frame Rate: <span class="text-zinc-200">{videoMeta()?.fps || 30} fps</span></div>
                      <div>Video Codec: <span class="text-zinc-200 uppercase">{videoMeta()?.codec || "H264"}</span></div>
                    </div>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </aside>
  );
};
