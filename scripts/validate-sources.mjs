import { resolve } from "node:path";
import { loadManifest, validateCuratedPlaylistsOnline, validateDirectStreamsOnline, validateManifest, validateOfficialLinksOnline } from "./source-policy.mjs";

const manifestPath = resolve("sources/manifest.json");
const manifest = await loadManifest(manifestPath);
const sources = validateManifest(manifest);

if (process.argv.includes("--online")) {
  const count = await validateDirectStreamsOnline(sources);
  const playlistCount = await validateCuratedPlaylistsOnline(sources);
  const providerResult = await validateOfficialLinksOnline(sources);
  const accessLimitedNote = providerResult.accessLimited.length > 0 ? ` Access-limited pages: ${providerResult.accessLimited.join(", ")}.` : "";
  console.log(`Validated ${count} direct public stream${count === 1 ? "" : "s"}, ${playlistCount} curated public playlist${playlistCount === 1 ? "" : "s"}, and ${providerResult.count} official provider link${providerResult.count === 1 ? "" : "s"} online.${accessLimitedNote}`);
} else {
  console.log(`Validated ${sources.length} source manifest entries offline.`);
}
