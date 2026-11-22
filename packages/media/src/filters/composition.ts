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

  // 0. Stacking Mode (stacked_split, split_50_50, pan_scan)
  const template = composition.stacking?.template;
  if (template === "stacked_split" || template === "split_50_50") {
    const topPct = composition.stacking?.topHeightPercent ?? (template === "split_50_50" ? 50 : 35);
    const topH = Math.min(height - 100, Math.max(100, Math.round((height * topPct) / 100)));
    const botH = height - topH;

    const tr = composition.stacking?.topRegion ?? { x: 2, y: 5, width: 28, height: 35 };
    const br = composition.stacking?.bottomRegion ?? { x: 0, y: 15, width: 100, height: 85 };

    const tx = (tr.x / 100).toFixed(4);
    const ty = (tr.y / 100).toFixed(4);
    const tw = Math.min(1.0, Math.max(0.05, tr.width / 100)).toFixed(4);
    const th = Math.min(1.0, Math.max(0.05, tr.height / 100)).toFixed(4);

    const bx = (br.x / 100).toFixed(4);
    const by = (br.y / 100).toFixed(4);
    const bw = Math.min(1.0, Math.max(0.05, br.width / 100)).toFixed(4);
    const bh = Math.min(1.0, Math.max(0.05, br.height / 100)).toFixed(4);

    const filterGraph =
      `[${inputLabel}]split=2[in_top][in_bot];` +
      `[in_top]crop=in_w*${tw}:in_h*${th}:in_w*${tx}:in_h*${ty},scale=${width}:${topH}:force_original_aspect_ratio=increase,crop=${width}:${topH}[top];` +
      `[in_bot]crop=in_w*${bw}:in_h*${bh}:in_w*${bx}:in_h*${by},scale=${width}:${botH}:force_original_aspect_ratio=increase,crop=${width}:${botH}[bot];` +
      `[top][bot]vstack=inputs=2${overlayChain},setsar=1,format=yuv420p[${outputLabel}]`;

    return { filterGraph, outputLabel };
  }

  if (template === "pan_scan") {
    const px = Math.min(0.4375, Math.max(0, (composition.stacking?.cropRegion?.x ?? 21.875) / 100)).toFixed(4);
    const filterGraph =
      `[${inputLabel}]crop=in_h*9/16:in_h:in_w*${px}:0,scale=${width}:${height}${overlayChain},setsar=1,format=yuv420p[${outputLabel}]`;

    return { filterGraph, outputLabel };
  }

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
