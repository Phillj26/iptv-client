import { categorizeChannel, primaryCategory } from "./catalog";
import { firstUnquotedComma, parseAttributes } from "./text";
import type { Channel, ParsedPlaylist, PlaylistWarning } from "./types";

interface ExtInf {
  attributes: Record<string, string>;
  name: string;
}

export interface ParseM3uOptions {
  sourceId: string;
  name?: string;
}

function parseExtInf(value: string): ExtInf {
  const commaIndex = firstUnquotedComma(value);
  const metadata = commaIndex === -1 ? value : value.slice(0, commaIndex);
  const name = commaIndex === -1 ? "Untitled channel" : value.slice(commaIndex + 1).trim() || "Untitled channel";
  return { attributes: parseAttributes(metadata), name };
}

function channelId(sourceId: string, streamUrl: string, tvgId?: string): string {
  const stableValue = tvgId || streamUrl;
  let hash = 5381;
  for (let index = 0; index < stableValue.length; index += 1) {
    hash = (hash * 33) ^ stableValue.charCodeAt(index);
  }
  return `${sourceId}:${(hash >>> 0).toString(36)}`;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function parseM3u(content: string, options: ParseM3uOptions): ParsedPlaylist {
  const channels: Channel[] = [];
  const warnings: PlaylistWarning[] = [];
  let extInf: ExtInf | undefined;
  let groupTitle: string | undefined;
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.length === 0) {
      continue;
    }

    if (line.startsWith("#EXTINF:")) {
      extInf = parseExtInf(line.slice("#EXTINF:".length));
      continue;
    }

    if (line.startsWith("#EXTGRP:")) {
      groupTitle = line.slice("#EXTGRP:".length).trim() || undefined;
      continue;
    }

    if (line.startsWith("#")) {
      continue;
    }

    if (!extInf) {
      warnings.push({ line: index + 1, message: "Ignored a stream URL without #EXTINF metadata." });
      continue;
    }

    if (!isHttpUrl(line)) {
      warnings.push({ line: index + 1, message: "Ignored a non-HTTP(S) stream URL." });
      extInf = undefined;
      groupTitle = undefined;
      continue;
    }

    const attributes = extInf.attributes;
    const resolvedGroupTitle = attributes["group-title"] || groupTitle;
    const categories = categorizeChannel(resolvedGroupTitle, extInf.name);
    const tvgId = attributes["tvg-id"] || undefined;
    channels.push({
      id: channelId(options.sourceId, line, tvgId),
      name: extInf.name,
      streamUrl: line,
      tvgId,
      logoUrl: attributes["tvg-logo"] || undefined,
      groupTitle: resolvedGroupTitle,
      sourceId: options.sourceId,
      categories,
      primaryCategory: primaryCategory(categories)
    });
    extInf = undefined;
    groupTitle = undefined;
  }

  if (extInf) {
    warnings.push({ line: lines.length, message: "Playlist ended before a channel URL was found." });
  }

  return { name: options.name, channels, warnings };
}

export function validateRemotePlaylistUrl(value: string): URL {
  const url = new URL(value.trim());
  if (url.protocol !== "https:") {
    throw new Error("Remote playlists must use HTTPS. Import a local file if your authorized provider only offers HTTP.");
  }
  return url;
}

export function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (/token|key|secret|auth|password|signature/i.test(key)) {
        url.searchParams.set(key, "redacted");
      }
    }
    return url.toString();
  } catch {
    return "Imported playlist";
  }
}
