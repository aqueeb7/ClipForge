import { describe, it, expect } from "vitest";
import { ClipForgeProjectSchema } from "./project.js";
import { ClipSchema } from "./clip.js";
import { ClipForgeError, ErrorCode } from "../errors/index.js";

describe("Shared Models & Schemas", () => {
  it("validates a standard project structure with automatic clipping", () => {
    const validProject = {
      id: "proj_123",
      name: "GTA VI Test",
      version: 1,
      sources: {
        video: {
          path: "C:/videos/gameplay.mp4",
          durationSeconds: 180,
          width: 1920,
          height: 1080
        }
      },
      clipSettings: {
        mode: "automatic",
        durationSeconds: 60,
        startSeconds: 0,
        endSeconds: 180
      },
      composition: {
        width: 1080,
        height: 1920,
        background: {
          mode: "blur",
          blurRadius: 25,
          color: "#000000"
        },
        gameplay: {
          mode: "contain",
          scale: 1,
          offsetX: 0,
          offsetY: 0
        },
        overlay: {
          enabled: true,
          brandTitle: "CLIPFORGE",
          episodeLabel: "PART",
          showEpisodeNumber: true
        }
      },
      export: {
        container: "mp4",
        videoCodec: "h264",
        audioCodec: "aac",
        frameRate: 60,
        crf: 21,
        preset: "veryfast",
        outputDirectory: "./exports/gta6",
        namingPattern: "{project}_{episode}_{title}"
      }
    };

    const parsed = ClipForgeProjectSchema.safeParse(validProject);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.synchronization.audioOffsetMs).toBe(0);
    }
  });

  it("rejects clip with start greater than end", () => {
    const invalidClip = {
      id: "clip_1",
      index: 1,
      sourceStartSeconds: 100,
      sourceEndSeconds: 50,
      enabled: true,
      outputName: "Part_001.mp4"
    };

    const parsed = ClipSchema.safeParse(invalidClip);
    expect(parsed.success).toBe(false);
  });

  it("properly serializes and preserves ClipForgeError", () => {
    const err = new ClipForgeError({
      code: ErrorCode.FFMPEG_NOT_FOUND,
      message: "FFmpeg executable was not detected",
      suggestedAction: "Install FFmpeg or add it to system PATH",
      targetPath: "C:/ffmpeg/ffmpeg.exe"
    });

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ClipForgeError);
    expect(err.code).toBe("FFMPEG_NOT_FOUND");
    expect(err.suggestedAction).toBe("Install FFmpeg or add it to system PATH");
    const json = err.toJSON();
    expect(json["code"]).toBe("FFMPEG_NOT_FOUND");
    expect(json["targetPath"]).toBe("C:/ffmpeg/ffmpeg.exe");
  });
});
