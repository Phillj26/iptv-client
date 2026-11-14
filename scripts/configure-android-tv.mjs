import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repositoryRoot, "apps", "android-tv", "android", "app", "src", "main", "AndroidManifest.xml");
const bannerPath = path.join(repositoryRoot, "apps", "android-tv", "android", "app", "src", "main", "res", "drawable", "banner.xml");

let manifest;
try {
  manifest = await readFile(manifestPath, "utf8");
} catch {
  throw new Error("Android project is missing. Run pnpm --filter @streamline/android-tv create first.");
}

if (!manifest.includes("android.software.leanback")) {
  manifest = manifest.replace(
    /(<manifest[^>]*>)/,
    "$1\n    <uses-feature android:name=\"android.software.leanback\" android:required=\"false\" />\n    <uses-feature android:name=\"android.hardware.touchscreen\" android:required=\"false\" />"
  );
}

if (!manifest.includes("android.permission.ACCESS_COARSE_LOCATION")) {
  manifest = manifest.replace(
    /(<manifest[^>]*>)/,
    "$1\n    <uses-permission android:name=\"android.permission.ACCESS_COARSE_LOCATION\" />\n    <uses-permission android:name=\"android.permission.ACCESS_FINE_LOCATION\" />"
  );
}

if (!manifest.includes("android:banner=\"@drawable/banner\"")) {
  manifest = manifest.replace(/<application([^>]*)>/, "<application$1 android:banner=\"@drawable/banner\">");
}

if (!manifest.includes("android.intent.category.LEANBACK_LAUNCHER")) {
  manifest = manifest.replace(
    /(<action[^>]+android\.intent\.action\.MAIN[^>]*\/>\s*<category[^>]+android\.intent\.category\.LAUNCHER[^>]*\/>)/s,
    "$1\n                <category android:name=\"android.intent.category.LEANBACK_LAUNCHER\" />"
  );
}

await writeFile(manifestPath, manifest);
await mkdir(path.dirname(bannerPath), { recursive: true });
await writeFile(bannerPath, `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="320dp" android:height="180dp" android:viewportWidth="320" android:viewportHeight="180">
    <path android:fillColor="#0B0E17" android:pathData="M0,0h320v180h-320z" />
    <path android:fillColor="#72DCFF" android:pathData="M24,38h272v4h-272zM24,138h160v4h-160z" />
    <path android:fillColor="#F6FBFF" android:pathData="M24,60h18v18h-18zM52,60h18v18h-18zM80,60h18v18h-18zM108,60h18v18h-18zM136,60h18v18h-18zM164,60h18v18h-18zM192,60h18v18h-18zM220,60h18v18h-18zM248,60h18v18h-18z" />
</vector>
`);

console.log("Configured Android TV and Fire TV launcher metadata.");
