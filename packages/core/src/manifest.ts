import { categoryIds, type CategoryId, type SourceManifestDocument, type ManifestSourceKind, type SourceManifestEntry } from "./types";

const sourceKinds: ManifestSourceKind[] = ["official-link", "user-authorized-playlist", "direct-stream", "curated-public-playlist"];
const sourceAccess = ["free-official", "user-authorized"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function requireString(value: unknown, field: string, id: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${id} needs a non-empty ${field}.`);
  }
  return value;
}

export function validateSourceManifest(value: unknown): SourceManifestEntry[] {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.sources)) {
    throw new Error("Source catalog must contain schemaVersion 1 and a sources array.");
  }

  const ids = new Set<string>();
  return value.sources.map((rawSource) => {
    if (!isRecord(rawSource)) {
      throw new Error("Source catalog entries must be objects.");
    }

    const id = requireString(rawSource.id, "id", "source");
    if (!/^[a-z0-9-]+$/.test(id) || ids.has(id)) {
      throw new Error(`Source catalog has an invalid or duplicate id: ${id}.`);
    }
    ids.add(id);

    const name = requireString(rawSource.name, "name", id);
    if (!sourceKinds.includes(rawSource.kind as ManifestSourceKind)) {
      throw new Error(`${id} has an unsupported source kind.`);
    }
    const kind = rawSource.kind as ManifestSourceKind;
    const categories = rawSource.categories;
    if (!Array.isArray(categories) || categories.length === 0 || !categories.every((category) => typeof category === "string" && categoryIds.includes(category as CategoryId))) {
      throw new Error(`${id} has invalid categories.`);
    }
    if (!sourceAccess.includes(rawSource.access as (typeof sourceAccess)[number])) {
      throw new Error(`${id} has invalid access classification.`);
    }
    if (!isHttpsUrl(rawSource.provenanceUrl)) {
      throw new Error(`${id} needs an HTTPS provenance URL.`);
    }
    requireString(rawSource.rightsNotes, "rightsNotes", id);
    requireString(rawSource.availabilityNotes, "availabilityNotes", id);
    if (!isRecord(rawSource.validation) || !isHttpsUrl(rawSource.provenanceUrl) || typeof rawSource.validation.validatedAt !== "string" || Number.isNaN(Date.parse(rawSource.validation.validatedAt)) || typeof rawSource.validation.method !== "string" || rawSource.validation.method.trim().length < 20) {
      throw new Error(`${id} needs valid validation metadata.`);
    }
    if (rawSource.regions !== undefined && (!Array.isArray(rawSource.regions) || !rawSource.regions.every((region) => typeof region === "string" && region.trim().length > 0))) {
      throw new Error(`${id} has invalid region metadata.`);
    }
    if (rawSource.providerUrl !== undefined && !isHttpsUrl(rawSource.providerUrl)) {
      throw new Error(`${id} has an invalid provider URL.`);
    }
    if (rawSource.playlistUrl !== undefined && !isHttpsUrl(rawSource.playlistUrl)) {
      throw new Error(`${id} has an invalid playlist URL.`);
    }
    if (rawSource.streamUrl !== undefined && !isHttpsUrl(rawSource.streamUrl)) {
      throw new Error(`${id} has an invalid stream URL.`);
    }

    if (kind === "official-link" && !isHttpsUrl(rawSource.providerUrl)) {
      throw new Error(`${id} needs an official provider URL.`);
    }
    if (kind === "user-authorized-playlist" && rawSource.streamUrl !== undefined) {
      throw new Error(`${id} must not bundle a viewer stream URL.`);
    }
    if (kind === "direct-stream" && (rawSource.access !== "free-official" || !isHttpsUrl(rawSource.providerUrl) || !isHttpsUrl(rawSource.streamUrl))) {
      throw new Error(`${id} direct streams must be free official HTTPS streams with provenance.`);
    }
    if (kind === "curated-public-playlist" && (rawSource.access !== "free-official" || !isHttpsUrl(rawSource.playlistUrl))) {
      throw new Error(`${id} curated playlists must be free official HTTPS playlists.`);
    }

    return {
      ...rawSource,
      id,
      name,
      categories: categories as CategoryId[],
      kind,
      access: rawSource.access as SourceManifestEntry["access"]
    } as SourceManifestEntry;
  });
}

export function parseSourceManifest(value: unknown): SourceManifestDocument {
  const sources = validateSourceManifest(value);
  if (!isRecord(value)) {
    throw new Error("Source catalog must be an object.");
  }
  if (value.updatedAt !== undefined && (typeof value.updatedAt !== "string" || Number.isNaN(Date.parse(value.updatedAt)))) {
    throw new Error("Source catalog updatedAt must be a valid date.");
  }
  return {
    schemaVersion: 1,
    sources,
    ...(typeof value.updatedAt === "string" ? { updatedAt: value.updatedAt } : {})
  };
}
