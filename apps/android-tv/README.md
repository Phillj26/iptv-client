# Android mobile, Android TV, and Fire TV

This package wraps the shared Streamline PWA in a Capacitor Android application. It deliberately contains no embedded playlists, credentials, or DRM workarounds.

The Capacitor Android build requires Android Studio or the Android SDK, platform 35 or newer, build-tools 34 or newer, Gradle from the generated wrapper, and JDK 21.

## Create and prepare the Android project

From the repository root:

```bash
pnpm build
pnpm android:create
pnpm android:sync
pnpm android:open
```

Run `pnpm android:create` only once for a checkout. The generated `android/` directory is ignored because it is reproducible from this configuration. Every later `pnpm android:sync` rebuilds the web assets and applies the TV launcher configuration automatically.

## TV launcher support

The sync step adds the following capabilities to the generated application manifest and creates a 320 × 180 launcher banner. The regular launcher entry remains in place so the same APK runs on phones, tablets, Android TV, and Fire TV.

```xml
<uses-feature android:name="android.software.leanback" android:required="false" />
<uses-feature android:name="android.hardware.touchscreen" android:required="false" />

<application android:banner="@drawable/banner">
  <activity android:name=".MainActivity">
    <intent-filter>
      <action android:name="android.intent.action.MAIN" />
      <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
    </intent-filter>
  </activity>
</application>
```

## Remote navigation

The web UI uses semantic buttons, visible focus rings, and Arrow keys / Enter. Android TV and Fire TV remotes dispatch the same events. The Capacitor App plugin closes the player, setup, and login overlays from the remote back button before exiting the app. Test with a hardware remote before release and keep focus inside any modal player.

The Network plugin resumes safe playlist and provider-catalog refresh after connectivity returns, and the app refreshes again when Fire TV resumes it from the background. URLs containing credentials are never retained for this behavior. Region-matched official local-news and free-TV handoffs are reordered using the saved local region, while providers still control actual availability.

## Playback adapter

The first build uses the portable web HLS player and locks the native player view to landscape. If an authorized source needs native HLS playback, add a Media3 / ExoPlayer Capacitor plugin behind the same channel and error contracts used by `packages/core`. Do not attempt provider DRM playback without that provider's SDK and license flow. The current Capgo video-player package is Capacitor 8-only, so it is not installed in this Capacitor 7 application.

## Fire TV release

Open the generated project in Android Studio, select the release variant, and build an APK or App Bundle with your own signing key. Install the APK on a Fire TV / Fire Stick test device using Amazon's developer tooling or ADB, then verify D-pad focus, playback, login, and provider handoffs on the target Fire OS version. Fire TV distribution still requires Amazon's packaging, signing, and listing review; Streamline does not bypass provider DRM or regional restrictions.

## Account login

The shared web UI supports email/password account access when the web build is configured with the Supabase project URL and public anon key from `apps/web/.env.example`. The APK uses the same login screen. Never put a service-role key, provider playlist password, or DRM credential in the app bundle.
