import { Component, createSignal, createEffect, Show } from "solid-js";
import { projectSignals } from "../../stores/project";
import { openDirectoryDialog } from "../../services/api";
import { Plus, X, AlertCircle } from "../Icons";

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
}

export const NewProjectModal: Component<NewProjectModalProps> = (props) => {
  const [projectName, setProjectName] = createSignal("New Project");
  const [outputDir, setOutputDir] = createSignal("");
  const [overwriteWarning, setOverwriteWarning] = createSignal(false);

  createEffect(() => {
    if (props.open) {
      setProjectName("New Project " + new Date().toISOString().slice(0, 10));
      setOutputDir(projectSignals.currentProject()?.export.outputDirectory || "");
      setOverwriteWarning(projectSignals.isDirty() || Boolean(projectSignals.videoMetadata()));
    }
  });

  async function handleBrowseOutputDir() {
    const selected = await openDirectoryDialog("Select Default Export Directory");
    if (selected) {
      setOutputDir(selected);
    }
  }

  function handleCreate() {
    projectSignals.createNewProject({
      name: projectName().trim() || "Untitled Project",
      outputDirectory: outputDir() || undefined
    });
    props.onClose();
  }

  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div class="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
          {/* Modal Header */}
          <div class="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
                <Plus size={14} />
              </div>
              <div>
                <h3 class="text-sm font-bold text-zinc-100">Create New Project</h3>
                <p class="text-[11px] text-zinc-400">Initialize a clean workspace for video clipping</p>
              </div>
            </div>
            <button
              type="button"
              onClick={props.onClose}
              class="text-zinc-500 hover:text-zinc-200 cursor-pointer p-1"
            >
              <X size={15} />
            </button>
          </div>

          {/* Warning if unsaved changes exist */}
          <Show when={overwriteWarning()}>
            <div class="bg-amber-500/10 border-b border-amber-500/20 px-5 py-2.5 flex items-start gap-2.5 text-xs text-amber-300">
              <AlertCircle size={15} class="text-amber-400 shrink-0 mt-0.5" />
              <div class="flex-1">
                <p class="font-semibold">Unsaved Work Detected</p>
                <p class="text-[11px] text-amber-400/80 mt-0.5">
                  Creating a new project will clear the active video, timeline trims, and render manifest.
                </p>
              </div>
            </div>
          </Show>

          {/* Form Body */}
          <div class="p-5 flex flex-col gap-4 text-xs">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Project Name
              </label>
              <input
                value={projectName()}
                onInput={(e) => setProjectName(e.currentTarget.value)}
                type="text"
                placeholder="e.g. Stream Highlights Part 1"
                class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700 transition"
                autofocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
              />
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Default Export Directory
              </label>
              <div class="flex items-center gap-2">
                <input
                  value={outputDir()}
                  type="text"
                  readOnly
                  placeholder="Select folder for exported clips..."
                  class="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 truncate focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={handleBrowseOutputDir}
                  class="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium cursor-pointer transition shrink-0"
                >
                  Browse
                </button>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div class="px-5 py-3.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={props.onClose}
              class="px-3.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 cursor-pointer transition font-medium border border-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              class="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-sm transition"
            >
              Create Project
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};
