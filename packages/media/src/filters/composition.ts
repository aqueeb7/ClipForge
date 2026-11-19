import { CompositionSettings } from "@clipforge/shared";
import { buildTextOverlayFilters, TextOverlayOptions } from "./overlay.js";

export interface BuildCompositionFilterOptions {
  composition: CompositionSettings;
  mainTitle?: string;
  episodeIndex?: number;
  fontFile?: string;
  inputLabel?: string;
  outputLabel?: string;
}

export interface CompositionFilterResult {
  filterGraph: string;
  outputLabel: string;
}

export function buildCompositionFilter(
  options: BuildCompositionFilterOptions
): CompositionFilterResult {
  const {
    composition,
    mainTitle,
    episodeIndex,
    fontFile,
    inputLabel = "0:v",
    outputLabel = "vout"
  } = options;

  const width = composition.width || 1080;
  const height = composition.height || 1920;

  // Build overlay filters if enabled
  const overlayOptions: TextOverlayOptions = {
    enabled: composition.overlay.enabled,
    brandTitle: composition.overlay.brandTitle,
    mainTitle,
    episodeLabel: composition.overlay.episodeLabel,
    episodeIndex,
    showEpisodeNumber: composition.overlay.showEpisodeNumber,
    fontFile
  };
  const overlayFilters = buildTextOverlayFilters(overlayOptions);
  const overlayChain = overlayFilters.length > 0 ? `,${overlayFilters.join(",")}` : "";

  // 1. Crop Mode (gameplay.mode === "crop")
  if (composition.gameplay.mode === "crop") {
    const filterGraph =
      `[${inputLabel}]scale=${width}:${height}:force_original_aspect_ratio=increase,` +
      `crop=${width}:${height}:(in_w-${width})/2:(in_h-${height})/2${overlayChain},` +
      `setsar=1,format=yuv420p[${outputLabel}]`;

    return { filterGraph, outputLabel };
  }

  // 2. Solid Background Mode (background.mode === "solid")
  if (composition.background.mode === "solid") {
    const rawColor = composition.background.color || "#000000";
    const cleanColor = rawColor.startsWith("#") ? rawColor : `#${rawColor}`;

    const filterGraph =
      `[${inputLabel}]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
      `pad=${width}:${height}:(${width}-iw)/2:(${height}-ih)/2:color=${cleanColor}${overlayChain},` +
      `setsar=1,format=yuv420p[${outputLabel}]`;

    return { filterGraph, outputLabel };
  }

  // 3. Blurred Background Mode (Default, background.mode === "blur")
  const blurRadius = composition.background.blurRadius || 25;
  const filterGraph =
    `[${inputLabel}]split=2[bg_in][fg_in];` +
    `[bg_in]scale=${width}:${height}:force_original_aspect_ratio=increase,` +
    `crop=${width}:${height},` +
    `gblur=sigma=${blurRadius}:steps=2,` +
    `eq=brightness=-0.15[bg];` +
    `[fg_in]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg];` +
    `[bg][fg]overlay=(W-w)/2:(H-h)/2${overlayChain},` +
    `setsar=1,format=yuv420p[${outputLabel}]`;

  return { filterGraph, outputLabel };
}
