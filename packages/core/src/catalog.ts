import type { CategoryId, Channel } from "./types";

const categoryRules: Array<[CategoryId, RegExp]> = [
  ["premium", /\bpremium\b|\bsubscription\b|\bpay\s?tv\b|\bvip\b/i],
  ["sports", /\bsports?\b|\bnba\b|\bnfl\b|\bmlb\b|\bnhl\b|\bsoccer\b|\bfootball\b|\bgolf\b|\btennis\b/i],
  ["movies", /\bmovie\b|\bfilm\b|\bcinema\b|\bvod\b|\bon demand\b/i],
  ["local", /\blocal\b|\bregional\b|\bmetro\b|\bcommunity\b|\bpublic access\b/i]
];

export function categorizeChannel(groupTitle?: string, name?: string): CategoryId[] {
  const searchableText = `${groupTitle ?? ""} ${name ?? ""}`.trim();
  const matches = categoryRules
    .filter(([, matcher]) => matcher.test(searchableText))
    .map(([category]) => category);

  return matches.length === 0 ? ["live-tv"] : [...new Set(matches)];
}

export function primaryCategory(categories: CategoryId[]): CategoryId {
  return categories[0] ?? "live-tv";
}

export function searchChannels(channels: Channel[], query: string): Channel[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (normalizedQuery.length === 0) {
    return channels;
  }

  return channels.filter((channel) => {
    const searchable = [channel.name, channel.groupTitle, channel.tvgId, ...channel.categories]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
    return searchable.includes(normalizedQuery);
  });
}

export function channelsForCategory(channels: Channel[], category: CategoryId): Channel[] {
  return channels.filter((channel) => channel.categories.includes(category));
}

export function mergeChannels(existing: Channel[], incoming: Channel[]): Channel[] {
  const channels = new Map(existing.map((channel) => [channel.id, channel]));
  for (const channel of incoming) {
    channels.set(channel.id, channel);
  }
  return [...channels.values()];
}
