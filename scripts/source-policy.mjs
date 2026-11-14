import { readFile } from "node:fs/promises";

const categories = new Set(["local", "live-tv", "movies", "sports", "premium"]);
const kinds = new Set(["official-link", "user-authorized-playlist", "direct-stream"]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validateManifest(manifest) {
  assert(manifest?.schemaVersion === 1, "Manifest schemaVersion must be 1.");
  assert(Array.isArray(manifest.sources), "Manifest sources must be an array.");
  const ids = new Set();

  for (const source of manifest.sources) {
    assert(typeof source.id === "string" && /^[a-z0-9-]+$/.test(source.id), "Every source needs a kebab-case id.");
    assert(!ids.has(source.id), `Duplicate source id: ${source.id}.`);
    ids.add(source.id);
    assert(typeof source.name === "string" && source.name.length > 0, `${source.id} needs a name.`);
    assert(kinds.has(source.kind), `${source.id} has an unsupported source kind.`);
    assert(Array.isArray(source.categories) && source.categories.length > 0, `${source.id} needs at least one category.`);
    assert(source.categories.every((category) => categories.has(category)), `${source.id} has an invalid category.`);
    assert(["free-official", "user-authorized"].includes(source.access), `${source.id} has an invalid access classification.`);
    assert(isHttpsUrl(source.provenanceUrl), `${source.id} needs an HTTPS provenance URL.`);
    assert(typeof source.rightsNotes === "string" && source.rightsNotes.length >= 20, `${source.id} needs meaningful rights notes.`);
    assert(typeof source.availabilityNotes === "string" && source.availabilityNotes.length >= 20, `${source.id} needs meaningful availability notes.`);
    assert(!Number.isNaN(Date.parse(source.validation?.validatedAt)), `${source.id} needs a valid validation date.`);
    assert(typeof source.validation?.method === "string" && source.validation.method.length >= 20, `${source.id} needs a validation method.`);

    if (source.kind === "official-link") {
      assert(isHttpsUrl(source.providerUrl), `${source.id} needs an official HTTPS provider URL.`);
      assert(source.streamUrl === undefined, `${source.id} must not bundle a direct stream URL.`);
    }

    if (source.kind === "user-authorized-playlist") {
      assert(source.access === "user-authorized", `${source.id} must be marked user-authorized.`);
      assert(source.streamUrl === undefined, `${source.id} must not bundle a viewer's stream URL.`);
    }

    if (source.kind === "direct-stream") {
      assert(source.access === "free-official", `${source.id} direct streams must be free and official.`);
      assert(isHttpsUrl(source.streamUrl), `${source.id} needs an HTTPS stream URL.`);
      assert(isHttpsUrl(source.providerUrl), `${source.id} needs an official provider URL.`);
    }
  }

  return manifest.sources;
}

export async function validateDirectStreamsOnline(sources) {
  const directStreams = sources.filter((source) => source.kind === "direct-stream");
  for (const source of directStreams) {
    const response = await fetch(source.streamUrl, { signal: AbortSignal.timeout(10_000) });
    assert(response.ok, `${source.id} returned HTTP ${response.status}.`);
    const body = await response.text();
    assert(body.includes("#EXTM3U"), `${source.id} is not an HLS playlist.`);
  }
  return directStreams.length;
}

export async function loadManifest(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
