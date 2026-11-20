import { Component, Show, For } from "solid-js";
import { HelpCircle, X } from "../Icons";

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export const ShortcutsModal: Component<ShortcutsModalProps> = (props) => {
  const shortcutGroups = [
    {
      title: "Workspace & Navigation",
      shortcuts: [
        { key: "F1", desc: "Media Pool Workspace" },
        { key: "F2", desc: "Studio & Timeline Workspace" },
        { key: "F3", desc: "Delivery & Export Console" },
        { key: "Space", desc: "Play / Pause Video Monitor" },
        { key: "← / →", desc: "Step Frame Backward / Forward (1s)" },
        { key: "M", desc: "Mute / Unmute Audio" }
      ]
    },
    {
      title: "Trimming & Slicing",
      shortcuts: [
        { key: "[", desc: "Set In Point / Cut Intro" },
        { key: "]", desc: "Set Out Point / Cut Outro" },
        { key: "Ctrl + K", desc: "Split Clip at Playhead" },
        { key: "Ctrl + R", desc: "Reset Master Trim" }
      ]
    },
    {
      title: "Project & Export",
      shortcuts: [
        { key: "Ctrl + N", desc: "New Project" },
        { key: "Ctrl + S", desc: "Save Project to Disk" },
        { key: "Ctrl + E", desc: "Render Remaining Clips" },
        { key: "Ctrl + Shift + E", desc: "Render All Clips" }
      ]
    }
  ];

  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div class="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh]">
          {/* Header */}
          <div class="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-mono text-zinc-300">
                <HelpCircle size={14} />
              </div>
              <h3 class="text-sm font-bold text-zinc-100">Keyboard Shortcuts</h3>
            </div>
            <button
              type="button"
              onClick={props.onClose}
              class="text-zinc-500 hover:text-zinc-200 cursor-pointer p-1"
            >
              <X size={15} />
            </button>
          </div>

          {/* Shortcuts Body */}
          <div class="p-5 overflow-y-auto flex flex-col gap-4 divide-y divide-zinc-900">
            <For each={shortcutGroups}>
              {(group) => (
                <div class="pt-3 first:pt-0">
                  <h4 class="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-2">
                    {group.title}
                  </h4>
                  <div class="grid grid-cols-1 gap-1">
                    <For each={group.shortcuts}>
                      {(item) => (
                        <div class="flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-900/50 text-xs">
                          <span class="text-zinc-300">{item.desc}</span>
                          <kbd class="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[11px] font-mono text-zinc-300 shadow-sm">
                            {item.key}
                          </kbd>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </div>

          {/* Footer */}
          <div class="px-5 py-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-end shrink-0">
            <button
              type="button"
              onClick={props.onClose}
              class="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-medium cursor-pointer transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};
