# Workflow: Debug Media & Playback

1. Inspect hardware topology via Settings Modal or `get_tri_engine_hardware_info` IPC to confirm decoder, AI, and encoder engine statuses.
2. Run `clipforge doctor` or in-app environment check to confirm local FFmpeg/FFprobe binaries.
3. Run `clipforge inspect --video <path>` or in-app media inspection to verify streams, pixel format, SAR, and timestamps.
4. If playback freezes:
   - Check `VideoPreview.tsx` to ensure `videoRef` is not being micro-seeked during active playback.
   - Verify canvas render loops are not stacking duplicate calls outside `requestAnimationFrame`.
5. If FFmpeg fails:
   - Inspect the spawned filter graph in the logs.
   - Check if the selected encoder (e.g. `h264_qsv`) requires specific pixel format mappings or if CPU fallback (`libx264`) resolves it.
