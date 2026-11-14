import { resolve } from "node:path";
import { loadManifest, validateDirectStreamsOnline, validateManifest } from "./source-policy.mjs";

const manifestPath = resolve("sources/manifest.json");
const manifest = await loadManifest(manifestPath);
const sources = validateManifest(manifest);

if (process.argv.includes("--online")) {
  const count = await validateDirectStreamsOnline(sources);
  console.log(`Validated ${count} direct public stream${count === 1 ? "" : "s"} online.`);
} else {
  console.log(`Validated ${sources.length} source manifest entries offline.`);
}
