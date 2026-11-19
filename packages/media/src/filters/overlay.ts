import { escapeFilterText, escapeFilterPath } from "./escape.js";

export interface TextOverlayOptions {
  enabled?: boolean;
  brandTitle?: string;
  mainTitle?: string;
  episodeLabel?: string;
  episodeIndex?: number;
  showEpisodeNumber?: boolean;
  fontFile?: string;
  fontColor?: string;
  boxColor?: string;
}

export function buildTextOverlayFilters(options: TextOverlayOptions): string[] {
  if (options.enabled === false) {
    return [];
  }

  const filters: string[] = [];
  const fontColor = options.fontColor ?? "white";
  const boxColor = options.boxColor ?? "black@0.6";

  const fontClause = options.fontFile
    ? `:fontfile='${escapeFilterPath(options.fontFile)}'`
    : "";

  let currentY = 120;

  // 1. Brand Title (e.g. "CLIPFORGE")
  if (options.brandTitle && options.brandTitle.trim()) {
    const escapedBrand = escapeFilterText(options.brandTitle.trim().toUpperCase());
    filters.push(
      `drawtext=text='${escapedBrand}'${fontClause}:fontcolor=${fontColor}:fontsize=34:x=(w-text_w)/2:y=${currentY}:box=1:boxcolor=${boxColor}:boxborderw=8`
    );
    currentY += 65;
  }

  // 2. Main Title (e.g. "GTA VI GAMEPLAY")
  if (options.mainTitle && options.mainTitle.trim()) {
    const escapedMain = escapeFilterText(options.mainTitle.trim().toUpperCase());
    filters.push(
      `drawtext=text='${escapedMain}'${fontClause}:fontcolor=${fontColor}:fontsize=44:x=(w-text_w)/2:y=${currentY}:box=1:boxcolor=${boxColor}:boxborderw=10`
    );
    currentY += 75;
  }

  // 3. Episode Label & Number (e.g. "PART 001")
  if (options.showEpisodeNumber !== false && (options.episodeIndex !== undefined || options.episodeLabel)) {
    const label = options.episodeLabel ? options.episodeLabel.trim().toUpperCase() : "PART";
    const num = options.episodeIndex !== undefined ? String(options.episodeIndex).padStart(3, "0") : "";
    const episodeText = num ? `${label} ${num}` : label;
    const escapedEpisode = escapeFilterText(episodeText);

    filters.push(
      `drawtext=text='${escapedEpisode}'${fontClause}:fontcolor=yellow:fontsize=40:x=(w-text_w)/2:y=${currentY}:box=1:boxcolor=${boxColor}:boxborderw=8`
    );
  }

  return filters;
}
