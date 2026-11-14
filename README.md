# Streamline

Streamline is a privacy-first, Netflix-style IPTV client for web, Android mobile, Android TV / Fire TV, and desktop. It manages playlists that you are authorized to use; it does not ship pirated streams, credentials, or restreamed premium channels.

## What is included

- M3U/M3U8 playlist import from a local file, pasted text, or an HTTPS URL, with source-level replacement and removal.
- XMLTV guide import, channel-to-guide matching, a now/next player guide, Local / Live TV / News / Movies / Sports / Premium browsing, search, favorites, and recently watched history.
- A responsive, remote-friendly web UI with visible focus states and keyboard / D-pad navigation.
- HLS playback with clear, actionable errors and a safe retry path.
- Android / Fire TV packaging through Capacitor and a desktop shell through Tauri.
- Official Capacitor runtime plugins for app resume/back handling, network-aware refresh, optional native location, provider-browser handoff, and landscape playback orientation.
- An auditable source manifest for official provider links, one validated public-domain playlist, and user-authorized playlist placeholders.

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
pnpm android:create
pnpm android:sync
pnpm android:open
```

Run `pnpm android:create` only once. The sync step applies Leanback, touchless-input, launcher, and banner metadata automatically. Open the generated Android project in Android Studio to build and sign an Android TV / Fire TV APK. See `apps/android-tv/README.md` for device validation.

The Android build requires JDK 21, Android SDK platform 35 or newer, and build-tools 34 or newer.

### Account login

To enable user login, copy `apps/web/.env.example` to a local web environment file and set the public Supabase project URL and anon key. Configure email/password access in the Supabase dashboard, then rebuild the web app before creating the Android package. Login is optional and does not upload playlists; provider credentials remain local to the viewer's authorized source.

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

Remote HTTPS playlists without credential-looking query parameters are refreshed automatically about every six hours while the app is running. URLs containing tokens, signatures, passwords, or similar credentials are intentionally not stored for background refresh; re-import those sources when the provider permits it.

The official provider catalog is bundled for offline startup, cached locally after a successful fetch, and refreshed from `VITE_SOURCE_MANIFEST_URL` on launch, app resume, network recovery, and approximately every six hours. The default URL points to this repository's public `sources/manifest.json`. Remote catalog entries must pass the shared schema validator before they replace the cached catalog; this validates structure and HTTPS/provider boundaries, while the repository's source-policy checks remain responsible for provenance and rights review.

The saved local region only reorders matching provider handoffs (for example, US local-news services). It cannot turn a provider page into a universal local-channel feed: broadcasters and providers still decide market availability and authorization.

### Native runtime capabilities

The shared app uses the Capacitor 7 plugin line (`latest-7`) so the browser build and generated Android / Fire TV shell stay on the same major version:

- `@capacitor/app` handles Android back navigation and refreshes safe sources when the app resumes.
- `@capacitor/network` retries safe source refreshes after connectivity returns.
- `@capacitor/geolocation` provides an optional location hint; Fire TV devices without location services keep the manual region field.
- `@capacitor/browser` opens official provider pages without putting provider credentials in the app.
- `@capacitor/screen-orientation` locks the player to landscape on native devices and restores the prior behavior when it closes.

The current player remains the portable HLS implementation. A native Media3 / ExoPlayer player can be added later for authorized sources that require it; DRM and entitlement checks must remain with the provider. The currently published Capgo video-player package targets Capacitor 8, so it is intentionally not mixed into this Capacitor 7 build.

## Legal source policy

`sources/manifest.json` includes official provider links, a GitHub-hosted public-domain movie playlist whose media URLs were validated, and placeholders for sources supplied by the viewer. Before any direct stream or curated playlist is added, it must have documented provenance, rights/availability notes, a validation date, and a passing online validation.

The **Public-domain movies playlist** card can import the validated GitHub playlist directly. If browser CORS prevents the import, download the raw `.m3u` file from the provenance link and use **Add playlist → Import M3U / M3U8**. The source publisher identifies the linked works as public domain; review item-level rights notes before redistributing or republishing anything.

```bash
pnpm validate:sources
pnpm validate:sources --online
```

See `LEGAL_SOURCES.md` for the acceptance rules and `ARCHITECTURE.md` for data flow and extension points.

GitHub Actions runs `pnpm validate:sources --online` on source changes and every six hours. It checks direct HLS entries and curated playlist media URLs strictly, while provider pages that deliberately reject automated requests are reported as access-limited rather than treated as playable streams.

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
