# ClipForge CLI Reference

Command line reference for the ClipForge video production engine.

## Global Options

- `-V, --version`: Output the version number.
- `-h, --help`: Display help for any command.

---

## 1. Environment Diagnostic

### `clipforge doctor`

Verifies local environment dependencies, FFmpeg tools, codecs, directory write access, and disk space.

```bash
clipforge doctor
clipforge doctor --json
clipforge doctor --ffmpeg "C:\path\to\ffmpeg.exe" --ffprobe "C:\path\to\ffprobe.exe"
```

---

## 2. Media Inspection

### `clipforge inspect`

Inspects media containers, video stream parameters (resolution, frame rate, VFR/CFR, codec), and audio stream properties.

```bash
clipforge inspect --video "./gameplay.mp4"
clipforge inspect --video "./gameplay.mp4" --audio "./mic_audio.wav"
clipforge inspect --video "./gameplay.mp4" --json
```

---

## 3. Project Management

### `clipforge project init`

Initializes a new ClipForge project configuration file with default settings or inferred media metadata.

```bash
clipforge project init \
  --name "GTA 6 Gameplay" \
  --video "./gameplay.mp4" \
  --duration 60 \
  --config "./project.json"
```

### `clipforge project validate <file>`

Validates a project configuration JSON against the ClipForge Zod schema.

```bash
clipforge project validate "./project.json"
```

---

## 4. Clip Planning

### `clipforge plan <file>`

Generates and displays the clip manifest without rendering.

```bash
clipforge plan "./project.json"
clipforge plan "./project.json" --json
```

---

## 5. Clips Management

### `clipforge clips list <file>`

Lists all planned clips with their enabled/disabled status, start/end timestamps, duration, and output filenames.

```bash
clipforge clips list "./project.json"
```

### `clipforge clips add <file>`

Adds a custom manual clip to the project.

```bash
clipforge clips add "./project.json" --start 12.5 --end 73.25 --title "Police Chase"
```

### `clipforge clips remove <file>`

Removes a manual clip by its 1-based index.

```bash
clipforge clips remove "./project.json" --index 1
```

### `clipforge clips toggle <file>`

Toggles or explicitly sets the enabled status of a clip.

```bash
clipforge clips toggle "./project.json" --index 1 --disable
clipforge clips toggle "./project.json" --index 1 --enable
```

### `clipforge clips generate <file>`

Calculates clip boundaries and writes a `manifest.json` file.

```bash
clipforge clips generate "./project.json"
clipforge clips generate "./project.json" --out "./custom_manifest.json"
```

### `clipforge clips export <file>`

Executes batch rendering of planned clips through FFmpeg.

```bash
# Render all enabled clips
clipforge clips export "./project.json"

# Render only specific clips
clipforge clips export "./project.json" --only 1,3

# Simulate export without spawning FFmpeg
clipforge clips export "./project.json" --dry-run

# Re-render existing clips
clipforge clips export "./project.json" --overwrite

# Organize clips into nested folders (Exports/Project/Part_001/...)
clipforge clips export "./project.json" --structure nested

# Export with custom output destination
clipforge clips export "./project.json" --out-dir "D:\Exports"
```
