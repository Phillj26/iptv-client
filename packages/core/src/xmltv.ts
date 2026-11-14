import { decodeXmlEntities, parseAttributes, tagText } from "./text";
import type { EpgChannel, ParsedEpg, PlaylistWarning, Programme } from "./types";

function parseXmlTvDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-]\d{4}|Z))?/);
  if (!match) {
    return undefined;
  }

  const [, year, month, day, hour, minute, second, offset = "Z"] = match;
  const isoOffset = offset === "Z" ? "Z" : `${offset.slice(0, 3)}:${offset.slice(3)}`;
  const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${isoOffset}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function parseXmlTv(content: string): ParsedEpg {
  const channels: EpgChannel[] = [];
  const programmes: Programme[] = [];
  const warnings: PlaylistWarning[] = [];
  const channelMatcher = /<channel\b([^>]*)>([\s\S]*?)<\/channel>/gi;
  const programmeMatcher = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;

  for (const match of content.matchAll(channelMatcher)) {
    const attributes = parseAttributes(match[1]);
    const id = attributes.id;
    const displayName = tagText(match[2], "display-name");
    if (!id || !displayName) {
      warnings.push({ line: 0, message: "Ignored an XMLTV channel without an id or display name." });
      continue;
    }

    const iconMatcher = match[2].match(/<icon\b([^>]*)\/?>(?:<\/icon>)?/i);
    const iconUrl = iconMatcher ? parseAttributes(iconMatcher[1]).src : undefined;
    channels.push({ id, displayName, iconUrl });
  }

  for (const match of content.matchAll(programmeMatcher)) {
    const attributes = parseAttributes(match[1]);
    const channelId = attributes.channel;
    const start = parseXmlTvDate(attributes.start);
    const end = parseXmlTvDate(attributes.stop);
    const title = tagText(match[2], "title");

    if (!channelId || !start || !title) {
      warnings.push({ line: 0, message: "Ignored an XMLTV programme with incomplete timing or title data." });
      continue;
    }

    programmes.push({
      channelId,
      start,
      end,
      title,
      description: tagText(match[2], "desc"),
      category: tagText(match[2], "category")
    });
  }

  if (channels.length === 0 && programmes.length === 0 && content.trim().length > 0) {
    warnings.push({ line: 0, message: "No XMLTV channels or programmes were found." });
  }

  return { channels, programmes, warnings };
}

export function programmesForChannel(programmes: Programme[], tvgId: string | undefined): Programme[] {
  if (!tvgId) {
    return [];
  }
  return programmes.filter((programme) => programme.channelId === tvgId);
}

export function programmeWindowForChannel(
  programmes: Programme[],
  tvgId: string | undefined,
  at = new Date()
): { current?: Programme; next?: Programme } {
  const schedule = programmesForChannel(programmes, tvgId)
    .slice()
    .sort((first, second) => first.start.getTime() - second.start.getTime());
  const current = schedule.find((programme) => {
    const end = programme.end?.getTime() ?? programme.start.getTime() + 60 * 60 * 1000;
    return programme.start.getTime() <= at.getTime() && end > at.getTime();
  });
  const next = schedule.find((programme) => programme.start.getTime() > at.getTime());

  return { current, next };
}

export function xmlText(value: string): string {
  return decodeXmlEntities(value.replace(/<[^>]+>/g, ""));
}
