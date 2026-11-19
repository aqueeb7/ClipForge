/**
 * Escapes characters for FFmpeg filter graph parameters and drawtext text arguments.
 */
export function escapeFilterText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/%/g, "\\%")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

export function escapeFilterPath(filePath: string): string {
  // Replace Windows backslashes with forward slashes and escape colon
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:");
}
