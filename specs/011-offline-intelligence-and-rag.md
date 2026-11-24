# Specification 011: Offline Intelligence & Chat Replay Engine

## Status: Completed

## Objective
Establish Clyptik's offline intelligence layer to identify viral, funny, and peak gameplay moments from long-form streams and VODs without cloud dependency or API billing. Extract and align synchronized live chat replays, compute multi-modal hype densities, and surface ranked highlight candidates directly on the studio timeline.

## Architecture & Principles
1. **100% Offline & Private**:
   - Zero external cloud calls, token costs, or privacy leaks. All analysis executes locally via native Rust algorithms in `src-tauri/src/intelligence.rs` and `src-tauri/src/normalizer.rs`.
2. **Multi-Modal Density Fusion**:
   - Combines chat velocity (messages per second), exclamation bursts, laughing tokens (e.g. `OMEGALUL`, `KEKW`, `LMAO`, `LOL`), and sentiment shifts into a normalized composite heat score ($0.0 \dots 1.0$).
3. **Decoupled Compute**:
   - Runs on background threads in Rust using physical GPU or CPU, avoiding UI thread blocking.

## Functional Requirements
1. **Chat Ingest & Normalization**:
   - Supports Twitch JSON, YouTube live chat replay `.jsonl`, standard subtitle `.srt`, and plain text chat logs with timecodes.
   - Parses timestamps into relative stream seconds and normalizes author metadata.
2. **Rolling Density Heatmap**:
   - Divides streams into discrete time bins (e.g. 5s–10s windows).
   - Generates composite scores based on message velocity, unique chatter count, and keyword clustering.
3. **Peak Moment Clustering**:
   - Merges adjacent high-energy bins within close temporal proximity into contiguous highlight scenes.
   - Calculates dynamic in-point (lead-up context) and out-point (cooldown).
4. **UI Integration**:
   - Multi-Track Timeline displays interactive chat density heatbars and highlight candidate markers.
   - Unified Studio Sidebar (AI & Chat tab) displays ranked highlight cards with one-click "+ Create Short" and instant seek preview.
   - Synchronized Chat Replay Drawer scrolling in real-time alongside video playback.

## Acceptance Criteria
- Chat files (.json, .jsonl, .txt, .srt) parse accurately into structured message arrays.
- Rolling density calculation generates normalized heat scores across full multi-hour streams.
- Highlight candidates display title, confidence score, timecode range, and primary trigger keyword.
- Timeline heatbars accurately reflect message density and permit direct click-to-seek.
- All unit and integration tests pass with 0 errors.
