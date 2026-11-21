import { Component, createSignal, createEffect, Show, For } from "solid-js";
import type { Clip } from "../../types/index.js";
import { projectSignals } from "../../stores/project";
import { queueSignals } from "../../stores/queue";
import { publishHistorySignals } from "../../stores/publishHistory";
import {
  formatCaption,
  copyToClipboard,
  getSavedYouTubeTokens,
  saveYouTubeTokens,
  clearYouTubeTokens,
  getSavedSecrets,
  saveSecrets,
  buildGoogleAuthUrl,
  startYouTubeOAuthFlow,
  cancelOAuth,
  uploadClipToYouTube,
  launchInstagramWorkflow,
  launchTikTokWorkflow,
  launchYouTubeStudioWorkflow,
  PublishMetadata,
  YouTubeTokens,
} from "../../services/publisher";
import { highlightInFolder, openBrowserUrl, openFileDialog } from "../../services/api";
import {
  Share,
  Copy,
  Check,
  ExternalLink,
  UploadCloud,
  YouTubeIcon,
  InstagramIcon,
  TikTokIcon,
  FolderOpen,
  HelpCircle,
  AlertCircle,
  X,
} from "../Icons";

interface PublishModalProps {
  open: boolean;
  clip: Clip | null;
  onClose: () => void;
}

export const PublishModal: Component<PublishModalProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal<"youtube" | "quicklaunch">("youtube");
  const [tokens, setTokens] = createSignal<YouTubeTokens | null>(null);

  // Setup Guide toggle
  const [showSetupGuide, setShowSetupGuide] = createSignal(false);

  // Form Fields
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [tags, setTags] = createSignal<string[]>(["#Shorts", "#Gaming", "#ClipForge"]);
  const [newTagInput, setNewTagInput] = createSignal("");
  const [privacy, setPrivacy] = createSignal<"public" | "unlisted" | "private">("public");

  // OAuth Config Inputs for ClipForge
  const [clientId, setClientId] = createSignal("");
  const [clientSecret, setClientSecret] = createSignal("");
  const [isAuthenticating, setIsAuthenticating] = createSignal(false);
  const [authError, setAuthError] = createSignal<string | null>(null);
  const [copiedAuthUrl, setCopiedAuthUrl] = createSignal(false);

  async function handleCopyAuthUrl() {
    const cid = clientId().trim();
    if (!cid) return;
    const url = buildGoogleAuthUrl(cid);
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedAuthUrl(true);
      setTimeout(() => setCopiedAuthUrl(false), 3000);
    }
  }

  // Upload state
  const [isUploading, setIsUploading] = createSignal(false);
  const [uploadError, setUploadError] = createSignal<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = createSignal<string | null>(null);
  const [customFilePath, setCustomFilePath] = createSignal<string>("");

  // Quick launch states
  const [copiedCaption, setCopiedCaption] = createSignal(false);
  const [highlightedFile, setHighlightedFile] = createSignal(false);

  const GTA6_TEMPLATE = {
    title: "GTA 6 in 2K 🔥🌴 The streets of Vice City are calling! #Shorts",
    description: `Welcome to Vice City! 🌴🔥
Experience GTA 6 gameplay in stunning 1440p (2K) resolution.
From exploring the streets to unexpected chaos, missions, driving and pure open-world madness — we're diving into the world of Grand Theft Auto VI.

🎮 Stream Details:
• Game: Grand Theft Auto VI
• Quality: 2K / 1440p 60FPS
• Content: Gameplay, exploration & open-world action

🛠️ Built for Gamers — ClipForge:
I'm also building ClipForge, a high-performance open-source desktop tool designed to turn long gameplay sessions into vertical short-form clips. Powered natively by Rust and FFmpeg hardware acceleration.
⭐ GitHub: https://github.com/aqueeb7/ClipForge

If you're into gaming, game dev, and open-source projects, consider following along!
Like, share and subscribe for more Vice City action.`,
    tags: [
      "#GTA6",
      "#GTAVI",
      "#GrandTheftAuto6",
      "#ViceCity",
      "#RockstarGames",
      "#GTA6Gameplay",
      "#Gaming",
      "#2KGaming",
      "#1440pGaming",
      "#ClipForge",
      "#OpenSource",
      "#Shorts",
    ],
  };

  function applyTemplate(type: "gta6" | "default") {
    if (type === "gta6") {
      setTitle(GTA6_TEMPLATE.title);
      setDescription(GTA6_TEMPLATE.description);
      setTags([...GTA6_TEMPLATE.tags]);
    } else {
      const proj = projectSignals.currentProject();
      const projName = proj?.name || "Gameplay";
      const clipTitle = props.clip?.outputName || `Part #${(props.clip?.index ?? 0) + 1}`;
      setTitle(`${clipTitle} - ${projName} #Shorts`);
      setDescription(
        `High-performance vertical clip extracted from ${projName}.\n\nRendered locally with ClipForge Engine (https://github.com/aqueeb7/ClipForge).`
      );
      setTags(["#Shorts", "#Gaming", "#ClipForge", `#${projName.replace(/\s+/g, "")}`]);
    }
  }

  // On open or clip change, populate metadata and load stored credentials
  createEffect(() => {
    if (props.open && props.clip) {
      const proj = projectSignals.currentProject();
      const projName = proj?.name || "Gameplay";
      const isGta = /gta/i.test(projName) || /gta/i.test(props.clip.outputName || "");

      if (isGta) {
        applyTemplate("gta6");
      } else {
        applyTemplate("default");
      }

      setUploadedUrl(null);
      setUploadError(null);
      setAuthError(null);
      setCopiedCaption(false);
      setHighlightedFile(false);
      setCustomFilePath("");

      // Load securely saved tokens from disk (.credentials/youtube-tokens.json)
      getSavedYouTubeTokens().then((t) => {
        setTokens(t);
      });

      // Load securely saved client secrets from disk (.credentials/youtube-secrets.json)
      getSavedSecrets().then((sec) => {
        if (sec) {
          if (!clientId()) setClientId(sec.client_id);
          if (!clientSecret()) setClientSecret(sec.client_secret);
        }
      });
    }
  });

  const getTargetFilePath = () => {
    if (customFilePath()) return customFilePath();
    if (!props.clip) return "";
    const info = queueSignals.getRenderedInfo(props.clip.id);
    let raw = info?.outputPath || "";
    if (!raw) {
      const proj = projectSignals.currentProject();
      if (proj?.export?.outputDirectory) {
        const outName = props.clip.outputName || `${props.clip.id}.mp4`;
        raw = `${proj.export.outputDirectory}/${outName}`;
      }
    }
    if (!raw) return "";
    // Clean accidental /apps/Exports/ and normalize slashes
    return raw
      .replace(/[\\/]apps[\\/]Exports[\\/]/gi, "/Exports/")
      .replace(/[\\/]apps[\\/]/gi, "/")
      .replace(/\\/g, "/");
  };

  async function handleBrowseTargetFile() {
    try {
      const selected = await openFileDialog({
        title: "Select Rendered MP4 Video",
        filters: [{ name: "Video Files", extensions: ["mp4", "mov", "mkv", "webm"] }]
      });
      if (selected && typeof selected === "string") {
        setCustomFilePath(selected);
        setUploadError(null);
      }
    } catch (err) {
      console.warn("Failed to open file dialog:", err);
    }
  }

  const getMetadata = (): PublishMetadata => ({
    title: title(),
    description: description(),
    tags: tags(),
    privacy: privacy(),
  });

  async function handleConnectOAuth() {
    const cid = clientId().trim();
    const sec = clientSecret().trim();

    if (!cid || !sec) {
      setAuthError("Please enter your Google OAuth Client ID and Client Secret.");
      setShowSetupGuide(true);
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const saved = await startYouTubeOAuthFlow(cid, sec);
      setTokens(saved);
      setShowSetupGuide(false);
    } catch (err: any) {
      setAuthError(err.message || String(err));
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleCancelOAuth() {
    await cancelOAuth();
    setIsAuthenticating(false);
    setAuthError("Authentication was cancelled.");
  }

  async function handleDisconnect() {
    await clearYouTubeTokens();
    setTokens(null);
    setAuthError(null);
  }

  async function handleDirectUpload() {
    const t = tokens();
    if (!t) return;
    const filePath = getTargetFilePath();
    if (!filePath) {
      setUploadError("Could not resolve rendered clip file path.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadedUrl(null);

    try {
      const result = await uploadClipToYouTube(filePath, getMetadata(), t);
      if (result.success && result.url) {
        setUploadedUrl(result.url);
        if (props.clip) {
          publishHistorySignals.recordPublish(
            props.clip.id,
            "youtube",
            result.url,
            props.clip.outputName
          );
        }
      } else {
        setUploadError(result.error || "Failed to upload to YouTube");
      }
    } catch (err: any) {
      setUploadError(err.message || String(err));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCopyCaption() {
    const text = formatCaption(getMetadata());
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2500);
    }
  }

  async function handleHighlightFile() {
    const filePath = getTargetFilePath();
    if (filePath) {
      await highlightInFolder(filePath);
      setHighlightedFile(true);
      setTimeout(() => setHighlightedFile(false), 2500);
    }
  }

  async function handleFastLaunchInstagram() {
    const filePath = getTargetFilePath();
    if (filePath) {
      await launchInstagramWorkflow(filePath, getMetadata());
      setCopiedCaption(true);
      setHighlightedFile(true);
      if (props.clip) {
        publishHistorySignals.recordPublish(
          props.clip.id,
          "instagram",
          undefined,
          props.clip.outputName
        );
      }
    }
  }

  async function handleFastLaunchTikTok() {
    const filePath = getTargetFilePath();
    if (filePath) {
      await launchTikTokWorkflow(filePath, getMetadata());
      setCopiedCaption(true);
      setHighlightedFile(true);
      if (props.clip) {
        publishHistorySignals.recordPublish(
          props.clip.id,
          "tiktok",
          undefined,
          props.clip.outputName
        );
      }
    }
  }

  async function handleFastLaunchYouTubeStudio() {
    const filePath = getTargetFilePath();
    if (filePath) {
      await launchYouTubeStudioWorkflow(filePath, getMetadata());
      setCopiedCaption(true);
      setHighlightedFile(true);
      if (props.clip) {
        publishHistorySignals.recordPublish(
          props.clip.id,
          "youtube_studio",
          undefined,
          props.clip.outputName
        );
      }
    }
  }

  function addTag() {
    const val = newTagInput().trim();
    if (!val) return;
    const formatted = val.startsWith("#") ? val : `#${val}`;
    if (!tags().includes(formatted)) {
      setTags([...tags(), formatted]);
    }
    setNewTagInput("");
  }

  function removeTag(tagToRemove: string) {
    setTags(tags().filter((t) => t !== tagToRemove));
  }

  function handleFileImport(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      file.text().then((text) => {
        try {
          const parsed = JSON.parse(text);
          const config = parsed.installed || parsed.web || parsed;
          if (config.client_id && config.client_secret) {
            setClientId(config.client_id);
            setClientSecret(config.client_secret);
            saveSecrets(config.client_id, config.client_secret);
            setAuthError(null);
          } else {
            setAuthError("Selected JSON file does not contain client_id or client_secret.");
          }
        } catch (err: any) {
          setAuthError("Invalid JSON file: " + err.message);
        }
      });
    }
  }

  return (
    <Show when={props.open && props.clip}>
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
        <div class="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
          {/* Header */}
          <div class="px-5 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-900/60">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Share size={18} />
              </div>
              <div>
                <h2 class="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <span>Publishing & Launch Hub</span>
                  <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                    {props.clip?.outputName || "Selected Clip"}
                  </span>
                </h2>
                <p class="text-xs text-zinc-400">
                  YouTube Shorts Direct API Upload & Desktop Web Launchers
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={props.onClose}
              class="text-zinc-400 hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
            >
              &times;
            </button>
          </div>

          {/* Tab Navigation */}
          <div class="px-5 pt-3 pb-0 border-b border-zinc-800 flex items-center gap-2 bg-zinc-900/30">
            <button
              type="button"
              onClick={() => setActiveTab("youtube")}
              class={`px-3 py-2 text-xs font-medium rounded-t-lg transition flex items-center gap-2 border-b-2 cursor-pointer ${
                activeTab() === "youtube"
                  ? "border-red-500 text-red-400 bg-red-950/20"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <YouTubeIcon size={14} class="text-red-500" />
              <span>YouTube Shorts (Direct API)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("quicklaunch")}
              class={`px-3 py-2 text-xs font-medium rounded-t-lg transition flex items-center gap-2 border-b-2 cursor-pointer ${
                activeTab() === "quicklaunch"
                  ? "border-pink-500 text-pink-400 bg-pink-950/20"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <InstagramIcon size={14} class="text-pink-400" />
              <span>1-Click Launch Hub (Instagram / TikTok)</span>
            </button>
          </div>

          {/* Modal Body */}
          <div class="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Target Video File Resolver Banner */}
            <div class="p-3 rounded-lg border border-zinc-800 bg-zinc-900/40 flex items-center justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                    Video Target
                  </span>
                  <Show when={customFilePath()}>
                    <span class="text-[9px] px-1.5 py-0.2 rounded bg-blue-950 text-blue-400 border border-blue-800">
                      Custom Selected
                    </span>
                  </Show>
                </div>
                <div class="text-xs font-mono text-zinc-200 truncate mt-0.5" title={getTargetFilePath()}>
                  {getTargetFilePath() || "No file target resolved"}
                </div>
              </div>
              <button
                type="button"
                onClick={handleBrowseTargetFile}
                class="px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer transition flex items-center gap-1.5 shrink-0 border border-zinc-700 hover:border-zinc-600"
                title="Browse your computer to pick or change the rendered video file"
              >
                <FolderOpen size={13} class="text-zinc-400" />
                <span>{customFilePath() ? "Change..." : "Browse..."}</span>
              </button>
            </div>

            {/* Publishing History for this Clip */}
            {(() => {
              if (!props.clip) return null;
              const history = publishHistorySignals.getClipPublishHistory(props.clip.id);
              if (history.length === 0) return null;

              return (
                <div class="p-3 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Check size={12} class="text-emerald-400" />
                      <span>Publication History ({history.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => publishHistorySignals.clearPublishHistory(props.clip!.id)}
                      class="text-[10px] text-zinc-500 hover:text-red-400 transition cursor-pointer"
                    >
                      Clear History
                    </button>
                  </div>

                  <div class="flex flex-wrap gap-1.5">
                    <For each={history}>
                      {(rec) => {
                        const dateStr = new Date(rec.publishedAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                        return (
                          <div class="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-[11px]">
                            <Show when={rec.platform === "youtube"}>
                              <YouTubeIcon size={12} class="text-red-500" />
                              <span class="text-red-300 font-medium">YouTube Shorts</span>
                              <Show when={rec.url}>
                                <button
                                  type="button"
                                  onClick={() => openBrowserUrl(rec.url!)}
                                  class="text-blue-400 hover:underline flex items-center gap-0.5 ml-0.5 cursor-pointer"
                                  title="Open in Browser"
                                >
                                  <span>View</span>
                                  <ExternalLink size={9} />
                                </button>
                              </Show>
                            </Show>

                            <Show when={rec.platform === "instagram"}>
                              <InstagramIcon size={12} class="text-pink-400" />
                              <span class="text-pink-300 font-medium">Instagram Reels</span>
                            </Show>

                            <Show when={rec.platform === "tiktok"}>
                              <TikTokIcon size={12} class="text-cyan-400" />
                              <span class="text-cyan-300 font-medium">TikTok Studio</span>
                            </Show>

                            <Show when={rec.platform === "youtube_studio"}>
                              <YouTubeIcon size={12} class="text-amber-500" />
                              <span class="text-amber-300 font-medium">YouTube Studio</span>
                            </Show>

                            <span class="text-[10px] text-zinc-500 ml-1">({dateStr})</span>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </div>
              );
            })()}

            {/* TAB 1: YOUTUBE SHORTS DIRECT API */}
            <Show when={activeTab() === "youtube"}>
              {/* Account Status Card */}
              <div class="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/50 flex flex-col gap-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div
                      class={`w-2.5 h-2.5 rounded-full ${
                        tokens() ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
                      }`}
                    />
                    <span class="text-xs font-medium text-zinc-200">
                      {tokens() ? "YouTube Account Connected" : "Not Connected"}
                    </span>
                    <span class="text-[10px] text-zinc-500 font-mono">
                      (OAuth 2.0 Loopback: http://localhost:8085)
                    </span>
                  </div>

                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSetupGuide(!showSetupGuide())}
                      class="text-[11px] text-blue-400 hover:text-blue-300 transition cursor-pointer flex items-center gap-1"
                    >
                      <HelpCircle size={12} />
                      <span>{showSetupGuide() ? "Hide Setup Guide" : "Setup Instructions"}</span>
                    </button>

                    <Show when={tokens()}>
                      <button
                        type="button"
                        onClick={handleDisconnect}
                        class="text-[11px] text-zinc-400 hover:text-red-400 transition cursor-pointer"
                      >
                        Disconnect
                      </button>
                    </Show>
                  </div>
                </div>

                {/* Step-by-Step Google Console Configuration Instructions */}
                <Show when={showSetupGuide() || (!tokens() && !clientId())}>
                  <div class="p-3.5 rounded-lg bg-zinc-950 border border-blue-900/40 space-y-2.5 text-xs text-zinc-300">
                    <div class="flex items-center justify-between pb-1.5 border-b border-zinc-800">
                      <span class="font-semibold text-blue-400 flex items-center gap-1.5">
                        <HelpCircle size={13} />
                        How to Configure Google Cloud Console for ClipForge
                      </span>
                      <button
                        type="button"
                        onClick={() => openBrowserUrl("https://console.cloud.google.com/apis/credentials")}
                        class="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <span>Open Console</span>
                        <ExternalLink size={11} />
                      </button>
                    </div>

                    <ol class="space-y-1.5 list-decimal list-inside text-[11px] text-zinc-300 leading-relaxed">
                      <li>
                        Go to{" "}
                        <button
                          type="button"
                          onClick={() => openBrowserUrl("https://console.cloud.google.com/apis/library/youtube.googleapis.com")}
                          class="text-blue-400 hover:underline font-mono"
                        >
                          Google Cloud Console
                        </button>{" "}
                        and click <strong>Enable</strong> for <strong>YouTube Data API v3</strong>.
                      </li>
                      <li>
                        Under <strong>OAuth consent screen</strong>: choose <strong>External</strong>, and add your Google email under <strong>Test Users</strong> (required for apps in testing).
                      </li>
                      <li>
                        Under <strong>Credentials</strong> &gt; <strong>Create Credentials</strong> &gt; <strong>OAuth client ID</strong>:
                        <ul class="list-disc list-inside ml-4 text-zinc-400 mt-0.5 space-y-0.5">
                          <li>Application type: <strong>Desktop app</strong> (recommended) or <strong>Web application</strong></li>
                          <li>Name: <code>ClipForge</code></li>
                          <li>
                            Authorized redirect URI: <code class="bg-zinc-800 text-emerald-400 px-1 py-0.5 rounded font-mono">http://localhost:8085</code> (or <code class="bg-zinc-800 text-emerald-400 px-1 py-0.5 rounded font-mono">http://localhost</code>)
                          </li>
                        </ul>
                      </li>
                      <li>
                        Click <strong>Download JSON</strong> (or copy <strong>Client ID</strong> &amp; <strong>Client Secret</strong>) and use the button below to import it in 1 click.
                      </li>
                    </ol>

                    <div class="pt-1 text-[10px] text-zinc-500 font-mono">
                      Credentials are stored locally in <code class="text-zinc-400">.credentials/</code> and gitignored.
                    </div>
                  </div>
                </Show>

                {/* If Not Connected: Show Inputs & Authorization */}
                <Show when={!tokens()}>
                  <div class="pt-2 border-t border-zinc-800/80 space-y-2.5">
                    <div class="flex items-center justify-between">
                      <span class="text-[11px] font-semibold text-zinc-300">Google OAuth Credentials</span>
                      <label class="text-[11px] text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 hover:border-zinc-700 transition">
                        <UploadCloud size={12} />
                        <span>Import client_secret.json</span>
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleFileImport}
                          class="hidden"
                        />
                      </label>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label class="block text-[11px] font-medium text-zinc-400 mb-1">
                          Google OAuth Client ID
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 123456789-xxx.apps.googleusercontent.com"
                          value={clientId()}
                          onInput={(e) => setClientId(e.currentTarget.value)}
                          class="w-full px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label class="block text-[11px] font-medium text-zinc-400 mb-1">
                          Client Secret
                        </label>
                        <input
                          type="password"
                          placeholder="e.g. GOCSPX-xxxxxxxxx"
                          value={clientSecret()}
                          onInput={(e) => setClientSecret(e.currentTarget.value)}
                          class="w-full px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                    </div>

                    <Show when={authError()}>
                      <div class="p-2.5 rounded bg-red-950/40 border border-red-800/40 text-xs text-red-300 flex items-center justify-between">
                        <span>{authError()}</span>
                        <button
                          type="button"
                          onClick={() => setAuthError(null)}
                          class="text-red-400 hover:text-red-200 ml-2 cursor-pointer"
                        >
                          &times;
                        </button>
                      </div>
                    </Show>

                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleConnectOAuth}
                        disabled={isAuthenticating()}
                        class="flex-1 py-2 rounded bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <YouTubeIcon size={14} />
                        <span>
                          {isAuthenticating() ? "Waiting for Browser Approval..." : "Connect Google Account"}
                        </span>
                      </button>

                      <Show when={isAuthenticating()}>
                        <button
                          type="button"
                          onClick={handleCancelOAuth}
                          class="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer transition border border-zinc-700"
                        >
                          Cancel
                        </button>
                      </Show>
                    </div>

                    <Show when={isAuthenticating()}>
                      <div class="p-3 rounded-lg bg-blue-950/30 border border-blue-800/40 space-y-2 text-[11px] text-blue-300">
                        <div class="flex items-center gap-2">
                          <div class="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                          <span>
                            Listening on <code class="font-mono text-white">http://localhost:8085</code>. Complete sign-in in your browser.
                          </span>
                        </div>
                        <div class="flex items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => openBrowserUrl(buildGoogleAuthUrl(clientId().trim()))}
                            class="px-2.5 py-1 rounded bg-blue-900/60 hover:bg-blue-800 text-blue-200 text-[11px] font-medium transition cursor-pointer flex items-center gap-1 border border-blue-700/50"
                          >
                            <ExternalLink size={11} />
                            <span>Re-open Browser</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleCopyAuthUrl}
                            class="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium transition cursor-pointer flex items-center gap-1 border border-zinc-700"
                          >
                            <Copy size={11} />
                            <span>{copiedAuthUrl() ? "Copied URL!" : "Copy Sign-in Link"}</span>
                          </button>
                        </div>
                      </div>
                    </Show>
                  </div>
                </Show>
              </div>

              {/* Metadata Form */}
              <div class="space-y-3">
                <div class="flex items-center justify-between pb-1 border-b border-zinc-800/60">
                  <span class="text-xs font-semibold text-zinc-300">Publish Metadata</span>
                  <div class="flex items-center gap-1.5">
                    <span class="text-[10px] text-zinc-500 font-medium">Preset:</span>
                    <button
                      type="button"
                      onClick={() => applyTemplate("gta6")}
                      class="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/50 transition cursor-pointer flex items-center gap-1 shadow-sm"
                      title="Load GTA 6 Vice City 2K + ClipForge promo template"
                    >
                      <span>🌴 GTA 6 + ClipForge</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyTemplate("default")}
                      class="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition cursor-pointer"
                      title="Load default clip metadata"
                    >
                      <span>⚡ Standard</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1">
                    Video Title (Auto-enriches with #Shorts)
                  </label>
                  <input
                    type="text"
                    value={title()}
                    onInput={(e) => setTitle(e.currentTarget.value)}
                    class="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1">Description</label>
                  <textarea
                    rows={6}
                    value={description()}
                    onInput={(e) => setDescription(e.currentTarget.value)}
                    class="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                {/* Tags Editor */}
                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1">Tags</label>
                  <div class="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-zinc-900 border border-zinc-800 mb-2">
                    <For each={tags()}>
                      {(tag) => (
                        <span class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-blue-300 border border-zinc-700">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            class="hover:text-red-400 cursor-pointer text-zinc-400"
                          >
                            &times;
                          </button>
                        </span>
                      )}
                    </For>
                  </div>
                  <div class="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add tag (e.g. #Gameplay)"
                      value={newTagInput()}
                      onInput={(e) => setNewTagInput(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      class="flex-1 px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      class="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer transition border border-zinc-700"
                    >
                      Add Tag
                    </button>
                  </div>
                </div>

                {/* Privacy Selector */}
                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1">Privacy Status</label>
                  <select
                    value={privacy()}
                    onChange={(e) =>
                      setPrivacy(e.currentTarget.value as "public" | "unlisted" | "private")
                    }
                    class="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="public">Public (Instant Release)</option>
                    <option value="unlisted">Unlisted (Accessible via link)</option>
                    <option value="private">Private (Only you)</option>
                  </select>
                </div>

                {/* Success / Error Messages */}
                <Show when={uploadError()}>
                  <div class="p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-xs text-red-300">
                    {uploadError()}
                  </div>
                </Show>

                <Show when={uploadedUrl()}>
                  <div class="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <Check size={16} class="text-emerald-400" />
                      <div>
                        <span class="text-xs font-medium text-emerald-300">
                          Uploaded as YouTube Short!
                        </span>
                        <p class="text-[11px] text-zinc-400 font-mono truncate max-w-sm">
                          {uploadedUrl()}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openBrowserUrl(uploadedUrl()!)}
                      class="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium cursor-pointer transition flex items-center gap-1.5"
                    >
                      <ExternalLink size={12} />
                      <span>View Short</span>
                    </button>
                  </div>
                </Show>
              </div>
            </Show>

            {/* TAB 2: 1-CLICK DESKTOP WEB LAUNCHER (INSTAGRAM & TIKTOK) */}
            <Show when={activeTab() === "quicklaunch"}>
              <div class="space-y-4">
                <div class="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                  <div class="flex items-start gap-3">
                    <div class="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
                      <InstagramIcon size={18} />
                    </div>
                    <div>
                      <h3 class="text-xs font-semibold text-zinc-200">
                        3-Second Fast Publish Workflow
                      </h3>
                      <p class="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                        Instagram and TikTok support desktop uploading directly from the web browser.
                        ClipForge automates the tedious steps: copy captions, highlight the file in Explorer,
                        and launch the upload page.
                      </p>
                    </div>
                  </div>

                  {/* 3 Step Flow Indicators */}
                  <div class="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800/80">
                    <div class="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col gap-1">
                      <span class="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Step 1</span>
                      <span class="text-xs font-medium text-zinc-200">Caption Ready</span>
                      <button
                        type="button"
                        onClick={handleCopyCaption}
                        class={`mt-1 py-1 px-2 rounded text-[11px] font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                          copiedCaption()
                            ? "bg-emerald-950 border border-emerald-700 text-emerald-300"
                            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
                        }`}
                      >
                        <Show when={copiedCaption()} fallback={<Copy size={11} />}>
                          <Check size={11} class="text-emerald-400" />
                        </Show>
                        <span>{copiedCaption() ? "Copied!" : "Copy Caption"}</span>
                      </button>
                    </div>

                    <div class="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col gap-1">
                      <span class="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Step 2</span>
                      <span class="text-xs font-medium text-zinc-200">Highlight File</span>
                      <button
                        type="button"
                        onClick={handleHighlightFile}
                        class={`mt-1 py-1 px-2 rounded text-[11px] font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                          highlightedFile()
                            ? "bg-emerald-950 border border-emerald-700 text-emerald-300"
                            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
                        }`}
                      >
                        <Show when={highlightedFile()} fallback={<FolderOpen size={11} />}>
                          <Check size={11} class="text-emerald-400" />
                        </Show>
                        <span>{highlightedFile() ? "Selected!" : "Reveal in Explorer"}</span>
                      </button>
                    </div>

                    <div class="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col gap-1">
                      <span class="text-[10px] font-bold text-pink-400 uppercase tracking-wider">Step 3</span>
                      <span class="text-xs font-medium text-zinc-200">Drag & Drop</span>
                      <span class="text-[10px] text-zinc-500 mt-1">Paste caption & share!</span>
                    </div>
                  </div>
                </div>

                {/* Fast 1-Click Launchers */}
                <div class="space-y-2">
                  <span class="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    1-Click Instant Desktop Launchers
                  </span>

                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Instagram Reels */}
                    <button
                      type="button"
                      onClick={handleFastLaunchInstagram}
                      class="p-3 rounded-lg border border-pink-500/30 bg-pink-950/20 hover:bg-pink-950/40 text-pink-300 transition cursor-pointer flex flex-col items-center gap-2 group"
                    >
                      <InstagramIcon size={22} class="group-hover:scale-110 transition-transform" />
                      <span class="text-xs font-semibold">Instagram Reels</span>
                      <span class="text-[10px] text-zinc-400">instagram.com/create</span>
                    </button>

                    {/* TikTok Studio */}
                    <button
                      type="button"
                      onClick={handleFastLaunchTikTok}
                      class="p-3 rounded-lg border border-cyan-500/30 bg-cyan-950/20 hover:bg-cyan-950/40 text-cyan-300 transition cursor-pointer flex flex-col items-center gap-2 group"
                    >
                      <TikTokIcon size={22} class="group-hover:scale-110 transition-transform" />
                      <span class="text-xs font-semibold">TikTok Studio</span>
                      <span class="text-[10px] text-zinc-400">tiktok.com/upload</span>
                    </button>

                    {/* YouTube Studio Web */}
                    <button
                      type="button"
                      onClick={handleFastLaunchYouTubeStudio}
                      class="p-3 rounded-lg border border-red-500/30 bg-red-950/20 hover:bg-red-950/40 text-red-300 transition cursor-pointer flex flex-col items-center gap-2 group"
                    >
                      <YouTubeIcon size={22} class="group-hover:scale-110 transition-transform text-red-500" />
                      <span class="text-xs font-semibold">YouTube Studio Web</span>
                      <span class="text-[10px] text-zinc-400">studio.youtube.com</span>
                    </button>
                  </div>
                </div>

                {/* Caption Preview Card */}
                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1">
                    Generated Caption Preview (Ready to Paste)
                  </label>
                  <div class="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 whitespace-pre-wrap select-all max-h-36 overflow-y-auto">
                    {formatCaption(getMetadata())}
                  </div>
                </div>
              </div>
            </Show>
          </div>

          {/* Footer Actions */}
          <div class="px-5 py-3.5 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between shrink-0">
            <span class="text-[11px] text-zinc-500 font-mono truncate max-w-xs">
              {getTargetFilePath() || "No file target"}
            </span>

            <div class="flex items-center gap-2">
              <button
                type="button"
                onClick={props.onClose}
                class="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer transition"
              >
                Close
              </button>

              <Show when={activeTab() === "youtube"}>
                <button
                  type="button"
                  onClick={handleDirectUpload}
                  disabled={!tokens() || isUploading()}
                  class={`px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition flex items-center gap-1.5 ${
                    tokens() && !isUploading()
                      ? "bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-900/20"
                      : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700"
                  }`}
                >
                  <UploadCloud size={14} />
                  <span>{isUploading() ? "Uploading Short..." : "Upload to YouTube Shorts"}</span>
                </button>
              </Show>

              <Show when={activeTab() === "quicklaunch"}>
                <button
                  type="button"
                  onClick={handleFastLaunchInstagram}
                  class="px-4 py-1.5 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-medium cursor-pointer transition shadow-md shadow-pink-900/20 flex items-center gap-1.5"
                >
                  <InstagramIcon size={14} />
                  <span>1-Click Launch to Instagram</span>
                </button>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};
export default PublishModal;
