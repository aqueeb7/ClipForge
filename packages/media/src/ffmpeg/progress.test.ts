import { describe, it, expect } from "vitest";
import { parseProgressBuffer } from "./progress.js";

describe("FFmpeg Progress Parser", () => {
  it("parses intermediate progress chunks and calculates percentage", () => {
    const chunk = `
frame=180
fps=59.4
stream_0_0_q=22.0
bitrate=2150.0kbits/s
total_size=524288
out_time_us=3000000
out_time_ms=3000
out_time=00:00:03.000000
dup_frames=0
drop_frames=0
speed=2.5x
progress=continue
`;

    const progress = parseProgressBuffer(chunk, 6.0); // 3s of 6s = 50%
    expect(progress).not.toBeNull();
    expect(progress?.progressPercent).toBe(50.0);
    expect(progress?.outTimeSeconds).toBe(3.0);
    expect(progress?.speed).toBe("2.5x");
    expect(progress?.fps).toBe(59.4);
    expect(progress?.status).toBe("continue");
  });

  it("handles progress=end and clamps to 100%", () => {
    const chunk = `
frame=360
fps=60.0
out_time_us=6000000
speed=2.8x
progress=end
`;

    const progress = parseProgressBuffer(chunk, 6.0);
    expect(progress).not.toBeNull();
    expect(progress?.progressPercent).toBe(100);
    expect(progress?.status).toBe("end");
  });

  it("returns null if progress= token is not found in chunk", () => {
    const chunk = "frame=10\nfps=30.0\n";
    const progress = parseProgressBuffer(chunk, 10);
    expect(progress).toBeNull();
  });
});
