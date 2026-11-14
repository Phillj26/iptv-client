# Android mobile, Android TV, and Fire TV

This package wraps the shared Streamline PWA in a Capacitor Android application. It deliberately contains no embedded playlists, credentials, or DRM workarounds.

## Create the Android project

From the repository root:

```bash
pnpm build
pnpm --filter @streamline/android-tv exec cap add android
pnpm android:sync
pnpm android:open
```

The generated `android/` directory is ignored because it is reproducible from this configuration.

## TV launcher support

After Capacitor creates the Android project, add the following capabilities to its application manifest and include a 320 × 180 TV banner. Keep the regular launcher entry as well so the app runs on phones and tablets.

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

The web UI uses semantic buttons, visible focus rings, and Arrow keys / Enter. Android TV and Fire TV remotes dispatch the same events. Test with a hardware remote before release and keep focus inside any modal player.

## Playback adapter

The first build uses the web player. If an authorized source needs native HLS playback, add a Media3 / ExoPlayer Capacitor plugin behind the same channel and error contracts used by `packages/core`. Do not attempt provider DRM playback without that provider's SDK and license flow.

## Fire TV release

Build and validate a Fire OS-compatible Android package in Amazon's developer tooling. Review the provider's availability and device terms before presenting any service link; premium access remains owned by the viewer and provider.
