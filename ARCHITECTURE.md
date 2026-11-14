# Architecture

## Goals

Streamline is a local-first media client. It treats a playlist as user data, not as a central catalogue to collect, redistribute, or proxy. This keeps credentials out of application telemetry and makes the same experience viable on web, Android / Fire TV, and desktop.

## Packages

| Area | Responsibility |
| --- | --- |
| `packages/core` | Parsing, channel normalization, category assignment, XMLTV matching, progress, playback error classification, and source-policy types. |
| `apps/web` | React PWA, local persistence, HLS playback, responsive layout, and focus navigation. |
| `apps/android-tv` | Capacitor configuration for Android mobile, Android TV, and Fire TV packaging. |
| `apps/desktop` | Tauri configuration that packages the web build for desktop. |
| `sources` | Auditable provider, validated public-domain playlist, and placeholder manifest; never a repository of unlicensed streams. |

## Data flow

1. The viewer imports authorized M3U/M3U8 and optional XMLTV data.
2. The core parser normalizes channels, then assigns a stable identifier and a category.
3. The web application stores the imported library and a local source registry in browser storage. The registry keeps a non-sensitive playlist label, opaque source identifier, import time, and channel count—never the remote URL or its credentials. Native shells use the same web storage until a secure-storage adapter is introduced.
4. Search, favorites, and recent playback operate against the local catalog.
5. The player selects native HLS support where available and uses Hls.js otherwise. It classifies errors without displaying URLs or credentials.

## Category policy

Categories are intentionally viewer-focused rather than a claim about rights:

- `local`: local / regional grouping hints supplied by the playlist;
- `live-tv`: general live channels;
- `movies`: movie or on-demand grouping hints;
- `sports`: sports grouping hints;
- `premium`: content marked as subscription / premium by the provider or the viewer.

Viewers can revise category labels after importing a playlist. A `premium` label does not give access to any content; it is only an organizational category.

## Security boundaries

- Remote playlist URLs must use HTTPS in the browser importer.
- URL display is redacted so token and credential query parameters are not shown in the interface.
- No CORS-bypassing proxy is included.
- DRM-protected or entitlement-required sources surface a provider handoff, not a workaround.
- Direct public stream entries are accepted only when `sources/manifest.json` records official provenance, rights notes, availability, validation date, and validation method.

## Native player adapter

The web player is the baseline implementation. A future Capacitor plugin can provide native Media3 / ExoPlayer playback for Android and Fire TV while keeping the `PlaybackError` and `Channel` contracts unchanged. That adapter must not attempt to play DRM-protected providers without their approved SDK or license flow.
