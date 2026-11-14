import type { WatchProgress } from "./types";

export function recordWatchProgress(
  current: WatchProgress[],
  next: Omit<WatchProgress, "watchedAt">
): WatchProgress[] {
  const item: WatchProgress = { ...next, watchedAt: new Date().toISOString() };
  return [item, ...current.filter((entry) => entry.channelId !== item.channelId)].slice(0, 40);
}

export function toggleFavorite(current: string[], channelId: string): string[] {
  return current.includes(channelId)
    ? current.filter((favorite) => favorite !== channelId)
    : [...current, channelId];
}
