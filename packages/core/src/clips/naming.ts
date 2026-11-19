export interface ResolveFilenameOptions {
  pattern: string;
  projectName: string;
  episodeIndex: number;
  clipIndex: number;
  title?: string;
  extension?: string;
}

export function sanitizeFilename(name: string): string {
  // Replace Windows illegal characters: \ / : * ? " < > | and control chars
  return name
    .replace(/[\\/:*?"<>|\r\n\t]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function resolveClipFilename(options: ResolveFilenameOptions): string {
  const { pattern, projectName, episodeIndex, clipIndex, title, extension = "mp4" } = options;

  const episodePad = String(episodeIndex).padStart(3, "0");
  const indexPad = String(clipIndex).padStart(3, "0");
  const safeProject = sanitizeFilename(projectName);
  const safeTitle = title ? sanitizeFilename(title) : `Part_${episodePad}`;
  const safeEpisode = `Part_${episodePad}`;

  let filename = pattern
    .replace(/\{project\}/gi, safeProject)
    .replace(/\{episode\}/gi, safeEpisode)
    .replace(/\{index\}/gi, indexPad)
    .replace(/\{title\}/gi, safeTitle);

  filename = sanitizeFilename(filename);
  if (!filename) {
    filename = `${safeProject}_Part_${episodePad}`;
  }

  const cleanExt = extension.replace(/^\./, "");
  return `${filename}.${cleanExt}`;
}
