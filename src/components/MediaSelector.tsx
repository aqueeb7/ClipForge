import { Component, createSignal, Show } from "solid-js";
import { projectSignals } from "../stores/project";
import { openFileDialog, isTauriEnvironment } from "../services/api";

export const MediaSelector: Component = () => {
  let fileInputRef: HTMLInputElement | undefined;
  let audioFileInputRef: HTMLInputElement | undefined;

  const [manualVideoPath, setManualVideoPath] = createSignal("");
  const [manualAudioPath, setManualAudioPath] = createSignal("");
  const [audioOffset, setAudioOffset] = createSignal(0);
  const [isDraggingOver, setIsDraggingOver] = createSignal(false);

  async function handleBrowseVideo() {
    if (isTauriEnvironment()) {
      const selected = await openFileDialog({
        title: "Select Gameplay Video File",
        filters: [{ name: "Video Files", extensions: ["mp4", "mkv", "mov", "webm", "avi"] }]
      });
      if (selected) {
        setManualVideoPath(selected);
        await projectSignals.loadVideoSource(selected);
      }
    } else {
      fileInputRef?.click();
    }
  }

  function handleFileInputChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      setManualVideoPath(file.name);
      const blobUrl = URL.createObjectURL(file);
      projectSignals.loadVideoSource(file.name, blobUrl);
    }
  }

  function handleAudioFileInputChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      setManualAudioPath(file.name);
      projectSignals.loadAudioSource(file.name);
    }
  }

  function handleDrop(e: DragEvent) {
    setIsDraggingOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      const filePath = (file as unknown as { path?: string }).path || file.name;
      setManualVideoPath(filePath);
      const blobUrl = URL.createObjectURL(file);
      projectSignals.loadVideoSource(filePath, blobUrl);
    }
  }

  async function handleLoadVideoManual() {
    if (manualVideoPath().trim()) {
      await projectSignals.loadVideoSource(manualVideoPath().trim());
    }
  }

  async function handleBrowseAudio() {
    if (isTauriEnvironment()) {
      const selected = await openFileDialog({
        title: "Select Dedicated Audio Track (Optional)",
        filters: [
          {
            name: "Audio Files (*.weba, *.wav, *.mp3, *.aac, *.m4a, *.flac, *.ogg, *.opus)",
            extensions: ["weba", "wav", "mp3", "aac", "m4a", "flac", "ogg", "opus", "wma", "mka"]
          },
          {
            name: "All Files (*.*)",
            extensions: ["*"]
          }
        ]
      });
      if (selected) {
        setManualAudioPath(selected);
        await projectSignals.loadAudioSource(selected);
      }
    } else {
      audioFileInputRef?.click();
    }
  }

  async function handleLoadAudioManual() {
    if (manualAudioPath().trim()) {
      await projectSignals.loadAudioSource(manualAudioPath().trim());
    }
  }

  function handleDetachAudio() {
    setManualAudioPath("");
    projectSignals.detachAudioSource();
  }

  function handleUpdateOffset() {
    projectSignals.setAudioOffset(Number(audioOffset()));
  }

  return (
    <div class="space-y-3">
      {/* Hidden file inputs for web fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
        class="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={audioFileInputRef}
        type="file"
        accept="audio/*,.weba,.opus,.mka"
        class="hidden"
        onChange={handleAudioFileInputChange}
      />

      {/* Video Source Selection */}
      <div
        class={`p-3.5 rounded-xl border transition-colors bg-dark-900/50 ${
          isDraggingOver() ? "border-blue-500 bg-blue-950/20" : "border-zinc-800"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDraggingOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleDrop(e);
        }}
      >
        <div class="flex items-center justify-between mb-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-blue-500"></span>
            Primary Video Source
          </label>
          <Show when={projectSignals.videoMetadata()}>
            <span class="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Loaded
            </span>
          </Show>
        </div>

        <div class="flex gap-2">
          <input
            value={manualVideoPath()}
            onInput={(e) => setManualVideoPath(e.currentTarget.value)}
            type="text"
            placeholder="File path or drag video here..."
            class="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono"
            onKeyUp={(e) => {
              if (e.key === "Enter") handleLoadVideoManual();
            }}
          />
          <button
            type="button"
            onClick={handleBrowseVideo}
            class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition cursor-pointer"
          >
            Browse
          </button>
          <Show when={manualVideoPath() && !projectSignals.videoMetadata()}>
            <button
              type="button"
              onClick={handleLoadVideoManual}
              class="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition cursor-pointer"
            >
              Load
            </button>
          </Show>
        </div>

        {/* Video Inspection Details */}
        <Show when={projectSignals.videoMetadata()}>
          {(meta) => (
            <div class="mt-2.5 grid grid-cols-4 gap-1.5 pt-2 border-t border-zinc-800/60 text-xs">
              <div class="bg-zinc-950/60 p-1.5 rounded border border-zinc-800/40">
                <div class="text-[9px] text-zinc-500 uppercase">Resolution</div>
                <div class="font-mono text-zinc-200 font-medium text-[11px]">
                  {meta().width}x{meta().height}
                </div>
              </div>
              <div class="bg-zinc-950/60 p-1.5 rounded border border-zinc-800/40">
                <div class="text-[9px] text-zinc-500 uppercase">Duration</div>
                <div class="font-mono text-zinc-200 font-medium text-[11px]">
                  {meta().durationSeconds.toFixed(1)}s
                </div>
              </div>
              <div class="bg-zinc-950/60 p-1.5 rounded border border-zinc-800/40">
                <div class="text-[9px] text-zinc-500 uppercase">Framerate</div>
                <div class="font-mono text-zinc-200 font-medium text-[11px]">{meta().fps} fps</div>
              </div>
              <div class="bg-zinc-950/60 p-1.5 rounded border border-zinc-800/40">
                <div class="text-[9px] text-zinc-500 uppercase">Codec</div>
                <div class="font-mono text-zinc-200 font-medium text-[11px]">{meta().codec}</div>
              </div>
            </div>
          )}
        </Show>
      </div>

      {/* Optional Dedicated Audio Track */}
      <div class="p-3.5 rounded-xl border border-zinc-800 bg-dark-900/50">
        <div class="flex items-center justify-between mb-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
            Dedicated Audio Track (Optional Sync)
          </label>
          <Show when={projectSignals.audioMetadata()}>
            <span class="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Attached
            </span>
          </Show>
        </div>

        <div class="flex gap-2">
          <input
            value={manualAudioPath()}
            onInput={(e) => setManualAudioPath(e.currentTarget.value)}
            type="text"
            placeholder="Path to microphone audio track (.weba, .wav, .mp3, .aac)..."
            class="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono"
            onKeyUp={(e) => {
              if (e.key === "Enter") handleLoadAudioManual();
            }}
          />
          <button
            type="button"
            onClick={handleBrowseAudio}
            class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition cursor-pointer"
          >
            Browse
          </button>
          <Show when={manualAudioPath() && !projectSignals.audioMetadata()}>
            <button
              type="button"
              onClick={handleLoadAudioManual}
              class="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition cursor-pointer"
            >
              Load
            </button>
          </Show>
          <Show when={projectSignals.audioMetadata()}>
            <button
              type="button"
              onClick={handleDetachAudio}
              class="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 rounded-lg text-xs font-medium transition cursor-pointer"
              title="Detach audio track"
            >
              Detach
            </button>
          </Show>
        </div>

        {/* Audio Track Inspection Details */}
        <Show when={projectSignals.audioMetadata()}>
          {(meta) => (
            <div class="mt-2.5 grid grid-cols-3 gap-1.5 pt-2 border-t border-zinc-800/60 text-xs">
              <div class="bg-zinc-950/60 p-1.5 rounded border border-zinc-800/40">
                <div class="text-[9px] text-zinc-500 uppercase">Duration</div>
                <div class="font-mono text-zinc-200 font-medium text-[11px]">
                  {meta().durationSeconds.toFixed(1)}s
                </div>
              </div>
              <div class="bg-zinc-950/60 p-1.5 rounded border border-zinc-800/40">
                <div class="text-[9px] text-zinc-500 uppercase">Codec / Format</div>
                <div class="font-mono text-zinc-200 font-medium text-[11px] uppercase">{meta().codec}</div>
              </div>
              <div class="bg-zinc-950/60 p-1.5 rounded border border-zinc-800/40">
                <div class="text-[9px] text-zinc-500 uppercase">Audio Stream</div>
                <div class="font-mono text-emerald-400 font-medium text-[11px]">Ready</div>
              </div>
            </div>
          )}
        </Show>

        {/* Sync Offset Controller */}
        <Show when={projectSignals.audioMetadata() || manualAudioPath()}>
          <div class="mt-2.5 flex items-center gap-2 pt-2 border-t border-zinc-800/60">
            <span class="text-xs text-zinc-400">Offset (ms):</span>
            <input
              value={audioOffset()}
              onInput={(e) => setAudioOffset(Number(e.currentTarget.value))}
              type="number"
              step="50"
              class="w-24 bg-zinc-950 border border-zinc-800 rounded px-2 py-0.5 text-xs text-zinc-200 font-mono"
              onChange={handleUpdateOffset}
            />
            <span class="text-[10px] text-zinc-500 font-mono">Positive: delay | Negative: advance</span>
          </div>
        </Show>
      </div>
    </div>
  );
};
