import {
  highlightInFolder,
  openBrowserUrl,
  listenForOAuthCode,
  cancelOAuthListener,
  exchangeOAuthCode,
  refreshOAuthToken,
  saveStoredSecrets,
  loadStoredSecrets,
  saveStoredTokens,
  loadStoredTokens,
  clearStoredCredentials,
  uploadToYouTube,
} from "./api.js";

export interface PublishMetadata {
  title: string;
  description: string;
  tags: string[];
  privacy: "public" | "unlisted" | "private";
}

export interface YouTubeTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  channelName?: string;
}

export function formatCaption(metadata: PublishMetadata): string {
  const cleanTags = Array.from(
    new Set(
      metadata.tags.map((t) => (t.startsWith("#") ? t : `#${t}`))
    )
  );

  const parts: string[] = [];
  if (metadata.title.trim()) {
    parts.push(metadata.title.trim());
  }
  if (metadata.description.trim()) {
    parts.push(metadata.description.trim());
  }
  if (cleanTags.length > 0) {
    parts.push(cleanTags.join(" "));
  }
  return parts.join("\n\n");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("Clipboard API failed:", err);
  }
  return false;
}

export async function getSavedYouTubeTokens(): Promise<YouTubeTokens | null> {
  try {
    const raw = await loadStoredTokens();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveYouTubeTokens(tokens: YouTubeTokens): Promise<void> {
  try {
    await saveStoredTokens(JSON.stringify(tokens, null, 2));
  } catch (err) {
    console.warn("Failed to persist YouTube tokens:", err);
  }
}

export async function clearYouTubeTokens(): Promise<void> {
  try {
    await clearStoredCredentials();
  } catch (err) {
    console.warn("Failed to clear YouTube tokens:", err);
  }
}

export async function getSavedSecrets(): Promise<{ client_id: string; client_secret: string } | null> {
  return await loadStoredSecrets();
}

export async function saveSecrets(clientId: string, clientSecret: string): Promise<void> {
  await saveStoredSecrets(clientId, clientSecret);
}

/**
 * 1-Click Launch Workflow for Instagram Reels.
 * Copies caption to clipboard, highlights file in Explorer, and opens Instagram web upload.
 */
export async function launchInstagramWorkflow(
  filePath: string,
  metadata: PublishMetadata
): Promise<void> {
  const caption = formatCaption(metadata);
  await copyToClipboard(caption);
  await highlightInFolder(filePath);
  await openBrowserUrl("https://www.instagram.com/create/style/");
}

/**
 * 1-Click Launch Workflow for TikTok Studio.
 */
export async function launchTikTokWorkflow(
  filePath: string,
  metadata: PublishMetadata
): Promise<void> {
  const caption = formatCaption(metadata);
  await copyToClipboard(caption);
  await highlightInFolder(filePath);
  await openBrowserUrl("https://www.tiktok.com/creator-center/upload");
}

/**
 * 1-Click Launch Workflow for YouTube Studio Web.
 */
export async function launchYouTubeStudioWorkflow(
  filePath: string,
  metadata: PublishMetadata
): Promise<void> {
  const caption = formatCaption(metadata);
  await copyToClipboard(caption);
  await highlightInFolder(filePath);
  await openBrowserUrl("https://studio.youtube.com/channel/UC/videos/upload?d=pt");
}

/**
 * Generates the Google OAuth 2.0 Authorization URL with strict RFC 3986 percent-encoded scopes.
 * Google accounts authorization rejects '+' as space in scopes on strict endpoints.
 */
export function buildGoogleAuthUrl(clientId: string, port: number = 8085): string {
  const redirectUri = `http://localhost:${port}`;
  const scopes = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString().replace(/\+/g, "%20")}`;
}

/**
 * Returns a guaranteed valid access token, automatically refreshing if expired and refresh_token is present.
 */
export async function getValidAccessToken(
  tokens: YouTubeTokens,
  clientId?: string,
  clientSecret?: string
): Promise<string> {
  const safetyBufferMs = 60 * 1000;
  if (Date.now() < tokens.expiresAt - safetyBufferMs) {
    return tokens.accessToken;
  }

  if (!tokens.refreshToken) {
    return tokens.accessToken;
  }

  let cid = clientId;
  let sec = clientSecret;
  if (!cid || !sec) {
    const saved = await getSavedSecrets();
    if (saved) {
      cid = saved.client_id;
      sec = saved.client_secret;
    }
  }

  if (cid && sec && tokens.refreshToken) {
    try {
      const refreshed = await refreshOAuthToken(cid, sec, tokens.refreshToken);
      const updated: YouTubeTokens = {
        ...tokens,
        accessToken: refreshed.access_token,
        expiresAt: Date.now() + (refreshed.expires_in || 3600) * 1000,
      };
      await saveYouTubeTokens(updated);
      return updated.accessToken;
    } catch (err) {
      console.warn("Auto-refresh of OAuth token failed:", err);
    }
  }

  return tokens.accessToken;
}

/**
 * Initiates the Google OAuth 2.0 flow for YouTube Data API.
 * Uses a local loopback server on http://localhost:8085 (dedicated to ClipForge).
 */
export async function startYouTubeOAuthFlow(
  clientId: string,
  clientSecret: string
): Promise<YouTubeTokens> {
  const port = 8085;
  const redirectUri = `http://localhost:${port}`;
  const authUrl = buildGoogleAuthUrl(clientId, port);

  // Save the secrets for future runs so the user never has to re-type them
  await saveSecrets(clientId, clientSecret);

  // Start background TCP listener on port 8085
  const listenerPromise = listenForOAuthCode(port);

  // Launch browser to Google authorization URL
  await openBrowserUrl(authUrl);

  // Await redirect with authorization code (with timeout & cancellation support)
  const code = await listenerPromise;

  // Exchange authorization code for tokens
  const tokenData = await exchangeOAuthCode(clientId, clientSecret, code, redirectUri);

  const tokens: YouTubeTokens = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
  };

  await saveYouTubeTokens(tokens);
  return tokens;
}

/**
 * Cancels active OAuth listener.
 */
export async function cancelOAuth(): Promise<void> {
  await cancelOAuthListener();
}

/**
 * Direct API upload of a vertical video to YouTube Shorts.
 */
export async function uploadClipToYouTube(
  filePath: string,
  metadata: PublishMetadata,
  tokenOrTokens: string | YouTubeTokens
): Promise<{ success: boolean; url?: string; videoId?: string; error?: string }> {
  let token: string;
  if (typeof tokenOrTokens === "string") {
    token = tokenOrTokens;
  } else {
    token = await getValidAccessToken(tokenOrTokens);
  }

  const cleanTags = Array.from(
    new Set(
      metadata.tags.map((t) => t.replace(/^#/, ""))
    )
  );

  let title = metadata.title.trim();
  if (!title.toLowerCase().includes("#shorts")) {
    title = `${title} #Shorts`;
  }

  const res = await uploadToYouTube({
    filePath,
    title,
    description: metadata.description,
    tags: cleanTags,
    privacy: metadata.privacy,
    accessToken: token,
  });

  return {
    success: res.success,
    url: res.url,
    videoId: res.video_id,
    error: res.error,
  };
}
