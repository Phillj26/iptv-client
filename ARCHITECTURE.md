# Architecture

## Goals

Streamline is a local-first media client. It treats a playlist as user data, not as a central catalogue to collect, redistribute, or proxy. This keeps credentials out of application telemetry and makes the same experience viable on web, Android / Fire TV, and desktop.

## Packages

| Area | Responsibility |
| --- | --- |
| `packages/core` | Parsing, channel normalization, category assignment, XMLTV matching, progress, playback error classification, source-policy types, and runtime source-manifest validation. |
| `apps/web` | React PWA, local persistence, provider-backed account access, safe playlist refresh, HLS playback, responsive layout, and focus navigation. |
| `apps/android-tv` | Capacitor configuration and reproducible manifest setup for Android mobile, Android TV, and Fire TV packaging. |
| `apps/desktop` | Tauri configuration that packages the web build for desktop. |
| `sources` | Auditable provider, validated public-domain playlist, and placeholder manifest; never a repository of unlicensed streams. |

## Data flow

1. The viewer imports authorized M3U/M3U8 and optional XMLTV data.
2. The core parser normalizes channels, then assigns a stable identifier and a category, including a first-class `news` category.
3. The web application stores the imported library and a local source registry in browser storage. The registry keeps a non-sensitive playlist label, opaque source identifier, import time, and channel count. A remote URL is retained only when its query does not contain credential-looking parameters so the app can refresh it; credential-bearing URLs are never stored for background refresh. Native shells use the same web storage until a secure-storage adapter is introduced.
4. Search, favorites, and recent playback operate against the local catalog.
5. The player selects native HLS support where available and uses Hls.js otherwise. It classifies errors without displaying URLs or credentials.
6. Optional Supabase-compatible account access stores only the provider session locally. It is a sign-in capability for future sync, not a server-side catalogue of playlists or provider credentials.
7. The shared Capacitor bridge handles native app resume/back events, network-aware refresh, optional location permissions, official provider-browser handoff, and landscape playback orientation.
8. The official provider catalog starts from the bundled manifest, then accepts only a schema-valid HTTPS refresh from the configured public manifest URL. A successful catalog refresh is cached locally for offline startup and ordered using the viewer's saved region metadata.

## Category policy

Categories are intentionally viewer-focused rather than a claim about rights:

- `local`: local / regional grouping hints supplied by the playlist;
- `live-tv`: general live channels;
- `news`: local, national, and global news groupings;
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

## Refresh and native platform adapters

Safe remote playlists refresh on a six-hour interval while the app is active, on native app resume, and when network connectivity returns. Refresh failures are recorded beside the imported source without replacing the last known working channel set. Credential-bearing URLs and sources that require a provider session must use an official provider integration or manual re-import.

The provider catalog follows the same lifecycle but is separate from playlists: it refreshes from `VITE_SOURCE_MANIFEST_URL`, validates entries before use, and updates official provider handoffs without introducing credentials or direct paid-channel URLs. Source entries can declare country/region hints for UI ordering; those hints are not a substitute for provider geolocation or entitlement checks.

The repository's scheduled source-validation workflow checks direct public streams, curated playlist media URLs, and official provider pages every six hours. A provider page that returns an anti-bot or access-control status is reported as access-limited; it is not silently classified as a playable stream.

The web player is the baseline implementation. A future native Media3 / ExoPlayer adapter can provide hardware-optimized playback for Android and Fire TV while keeping the `PlaybackError` and `Channel` contracts unchanged. That adapter must not attempt to play DRM-protected providers without their approved SDK or license flow.
