# Streamline

Streamline is a privacy-first, Netflix-style IPTV client for web, Android mobile, Android TV / Fire TV, and desktop. It manages playlists that you are authorized to use; it does not ship pirated streams, credentials, or restreamed premium channels.

## What is included

- M3U/M3U8 playlist import from a local file, pasted text, or an HTTPS URL, with source-level replacement and removal.
- XMLTV guide import, channel-to-guide matching, a now/next player guide, category browsing, search, favorites, and recently watched history.
- A responsive, remote-friendly web UI with visible focus states and keyboard / D-pad navigation.
- HLS playback with clear, actionable errors and a safe retry path.
- Android / Fire TV packaging through Capacitor and a desktop shell through Tauri.
- An auditable source manifest for official provider links and user-authorized playlist placeholders.

## Platform architecture

```text
                         +------------------+
                         |  Shared core     |
                         | M3U + XMLTV +    |
                         | catalog + policy |
                         +--------+---------+
                                  |
                    +-------------+--------------+
                    |                            |
             +------+-------+             +------+-------+
             | React PWA    |             | Source policy |
             | browser UI   |             | + validation  |
             +------+-------+             +--------------+
                    |
        +-----------+------------+
        |                        |
 +------+-------+         +------+-------+
 | Capacitor     |         | Tauri        |
 | Android/TV    |         | desktop      |
 +--------------+         +--------------+
```

The initial release is local-first: playlists, favorites, watch history, and EPG data stay on the device. An optional sync service can be added later without exposing playlist credentials to the catalog service.

## Quick start

1. Install Node.js 22+ and pnpm 10+.
2. Run `pnpm install`.
3. Start the web app with `pnpm dev`.
4. Run `pnpm check` before opening a pull request.

### Android mobile, Android TV, and Fire TV

The Android wrapper is configured in `apps/android-tv/capacitor.config.ts`. Build the web app, then run:

```bash
pnpm android:sync
pnpm android:open
```

Open the Android project in Android Studio. For TV / Fire TV distribution, configure the Android manifest with Leanback support and an application banner as described in `apps/android-tv/README.md`.

### Desktop

The Tauri configuration lives in `apps/desktop/src-tauri/tauri.conf.json`. Install the Rust and Tauri prerequisites, then run:

```bash
pnpm desktop:dev
```

## Playlists and guide data

Use only playlists and XMLTV feeds you own or are authorized to access. The importer supports:

- local `.m3u`, `.m3u8`, and `.xml` files;
- pasted M3U / XMLTV text; and
- HTTPS URLs whose provider permits browser-based access.

Some playlist servers block browser requests with CORS. Downloading the authorized playlist and importing the file locally is the supported fallback; Streamline does not proxy credentials through a third-party server.

## Legal source policy

`sources/manifest.json` includes only official provider links and placeholders for sources supplied by the viewer. It intentionally contains no bundled public M3U URLs. Before any direct stream URL is added, it must have documented provenance, rights/availability notes, a validation date, and a passing online validation.

```bash
pnpm validate:sources
pnpm validate:sources --online
```

See `LEGAL_SOURCES.md` for the acceptance rules and `ARCHITECTURE.md` for data flow and extension points.

## Project commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run the web app locally. |
| `pnpm build` | Build shared code and the PWA. |
| `pnpm test` | Run parser, catalog, error, and source-policy tests. |
| `pnpm check` | Run type checking, tests, and manifest validation. |
| `pnpm validate:sources --online` | Verify any future direct public stream entries. |

## Premium services

Premium sports and movie providers are represented as safe integration placeholders. The client can open an official provider link, hand off to a provider app, or import the viewer's authorized M3U URL. It never includes scraped credentials, bypasses DRM, or embeds paid-channel restreams.
