# Role: Media Engineer

- Responsible for FFmpeg and FFprobe adapters, stream inspection, filter-graph construction, audio synchronization, and hardware acceleration detection.
- Manages hardware encoders (Intel QuickSync `h264_qsv`, NVIDIA NVENC, Apple VideoToolbox, CPU `libx264`) and hardware decoders (`d3d11va`, `qsv`, `cuda`).
- Implements 60 FPS GPU canvas blitting in the frontend player, eliminating duplicate decoder instances and seek-stalling.
- Guarantees streaming-based video and audio processing with atomic temporary output promotion (`.part.mp4`).
