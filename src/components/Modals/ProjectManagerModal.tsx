import { Component, createSignal, createMemo, Show, For } from "solid-js";
import { projectSignals } from "../../stores/project";
import { timelineSignals } from "../../stores/timeline";
import { getSavedDrafts, deleteProjectDraft, type SavedProjectDraft } from "../../services/persistence";
import { openInExplorer, isTauriEnvironment } from "../../services/api";
import {
  Folder,
  FolderOpen,
  Plus,
  Scissors,
  Clock,
  Trash2,
  ExternalLink,
  CheckCircle2,
  X,
  Sparkles,
  Film,
  Save,
} from "../Icons";

interface ProjectManagerModalProps {
  open: boolean;
  onClose: () => void;
  onStartNewProject: () => void;
}

export const ProjectManagerModal: Component<ProjectManagerModalProps> = (props) => {
  const [draftsList, setDraftsList] = createSignal<SavedProjectDraft[]>([]);
  const currentProject = projectSignals.currentProject;
  const projectDir = projectSignals.streamProjectDir;

  createMemo(() => {
    if (props.open) {
      setDraftsList(getSavedDrafts());
    }
  });

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  async function handleOpenProjectFolder(path?: string) {
    const target = path || projectDir();
    if (target) {
      await openInExplorer(target);
    }
  }

  async function handleResumeDraft(draft: SavedProjectDraft) {
    await projectSignals.resumeDraft(draft);
    props.onClose();
  }

  function handleDeleteDraft(id: string) {
    deleteProjectDraft(id);
    setDraftsList(getSavedDrafts());
  }

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none animate-in fade-in duration-150">
        <div class="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
          {/* Header */}
          <div class="px-5 py-4 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <FolderOpen size={16} />
              </div>
              <div>
                <h2 class="text-sm font-bold text-zinc-100 uppercase tracking-wider">
                  Projects & Storage Hub
                </h2>
                <p class="text-[11px] text-zinc-400">
                  Manage saved halfway drafts, switch projects, and inspect organized media assets
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={props.onClose}
              class="w-7 h-7 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          {/* Modal Content */}
          <div class="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-zinc-300">
            {/* Active Session Card */}
            <div class="p-4 rounded-xl border border-blue-900/40 bg-blue-950/20 space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span class="text-[10px] font-mono uppercase tracking-wider text-blue-300 font-bold">
                    Active Studio Project
                  </span>
                </div>
                <div class="flex items-center gap-1.5">
                  <Show when={currentProject() || projectSignals.videoMetadata()}>
                    <button
                      type="button"
                      onClick={() => {
                        projectSignals.saveAndCloseProject();
                        setDraftsList(getSavedDrafts());
                      }}
                      class="px-2.5 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/60 text-[11px] text-emerald-300 hover:text-white flex items-center gap-1 cursor-pointer transition font-mono"
                      title="Save current progress and close workspace"
                    >
                      <Save size={11} />
                      <span>Save & Close</span>
                    </button>
                  </Show>
                  <button
                    type="button"
                    onClick={() => handleOpenProjectFolder()}
                    class="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer transition font-mono"
                    title="Open project folder in Windows Explorer"
                  >
                    <Folder size={11} />
                    <span>Open Folder</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      props.onClose();
                      props.onStartNewProject();
                    }}
                    class="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-[11px] text-white font-semibold flex items-center gap-1 cursor-pointer transition shadow-sm"
                  >
                    <Plus size={11} />
                    <span>New Project</span>
                  </button>
                </div>
              </div>

              <div class="space-y-1">
                <div class="text-sm font-bold text-zinc-100 truncate">
                  {currentProject()?.name || "Untitled Studio Session"}
                </div>
                <Show when={projectDir()}>
                  <div class="text-[10px] font-mono text-zinc-400 truncate">
                    {projectDir()}
                  </div>
                </Show>
              </div>

              {/* Tidy Directory Layout Guide */}
              <div class="pt-2 border-t border-blue-900/30">
                <div class="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                  Organized Project Storage:
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-mono">
                  <div class="p-2 rounded bg-zinc-900/60 border border-zinc-800/80">
                    <span class="text-blue-400 block font-semibold">📁 source/</span>
                    <span class="text-zinc-500 text-[9px]">Raw video & chat</span>
                  </div>
                  <div class="p-2 rounded bg-zinc-900/60 border border-zinc-800/80">
                    <span class="text-emerald-400 block font-semibold">📁 normalized/</span>
                    <span class="text-zinc-500 text-[9px]">Timeline & sync</span>
                  </div>
                  <div class="p-2 rounded bg-zinc-900/60 border border-zinc-800/80">
                    <span class="text-purple-400 block font-semibold">📁 analysis/</span>
                    <span class="text-zinc-500 text-[9px]">Multi-modal events</span>
                  </div>
                  <div class="p-2 rounded bg-zinc-900/60 border border-zinc-800/80">
                    <span class="text-amber-400 block font-semibold">📁 clips/</span>
                    <span class="text-zinc-500 text-[9px]">Outcome 9:16 shorts</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Saved Halfway Projects & Drafts List */}
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Clock size={13} class="text-zinc-400" />
                  <span class="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Saved Projects & Drafts
                  </span>
                </div>
                <span class="text-[10px] font-mono text-zinc-500">
                  {draftsList().length} saved
                </span>
              </div>

              <Show
                when={draftsList().length > 0}
                fallback={
                  <div class="p-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 text-center text-zinc-500 space-y-1">
                    <Folder size={20} class="mx-auto text-zinc-600 mb-2" />
                    <p class="font-medium text-xs">No saved drafts yet</p>
                    <p class="text-[10px] text-zinc-600">
                      Projects you work on or save halfway will appear here automatically.
                    </p>
                  </div>
                }
              >
                <div class="space-y-2">
                  <For each={draftsList()}>
                    {(draft) => (
                      <div class="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-900/80 transition flex items-center justify-between gap-3">
                        <div class="min-w-0 flex-1 space-y-1">
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-bold text-zinc-100 truncate text-xs">
                              {draft.name}
                            </span>
                            <span class="px-1.5 py-0.2 rounded bg-blue-950/60 border border-blue-800/50 text-blue-300 font-mono text-[9px] uppercase font-semibold">
                              {draft.workflowMode || "hybrid"}
                            </span>
                            <span class="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono text-[9px]">
                              {draft.clipsCount} parts
                            </span>
                            <Show when={draft.shortsCount && draft.shortsCount > 0}>
                              <span class="px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-800/50 text-amber-300 font-mono text-[9px] font-semibold">
                                {draft.shortsCount} shorts
                              </span>
                            </Show>
                            <Show when={draft.resumeTime && draft.resumeTime > 0}>
                              <span class="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono text-[9px]">
                                Paused at {formatTime(draft.resumeTime || 0)}
                              </span>
                            </Show>
                          </div>
                          <div class="text-[10px] font-mono text-zinc-500 truncate">
                            {draft.filePath}
                          </div>
                          <div class="text-[9px] font-mono text-zinc-600">
                            Saved {new Date(draft.lastSaved).toLocaleString()}
                          </div>
                        </div>

                        <div class="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleResumeDraft(draft)}
                            class="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] cursor-pointer transition shadow-sm"
                          >
                            Resume
                          </button>

                          <Show when={draft.projectDir}>
                            <button
                              type="button"
                              onClick={() => handleOpenProjectFolder(draft.projectDir)}
                              class="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
                              title="Open in Explorer"
                            >
                              <ExternalLink size={12} />
                            </button>
                          </Show>

                          <button
                            type="button"
                            onClick={() => handleDeleteDraft(draft.id)}
                            class="p-1 rounded hover:bg-red-950/40 text-zinc-500 hover:text-red-400 transition cursor-pointer"
                            title="Remove draft"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>

          {/* Footer */}
          <div class="p-3 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-xs font-mono">
            <span class="text-zinc-500 text-[10px]">
              Local-first auto-save active • External SSD compatible
            </span>
            <button
              type="button"
              onClick={props.onClose}
              class="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};
