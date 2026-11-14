export const categoryIds = ["local", "live-tv", "movies", "sports", "premium"] as const;

export type CategoryId = (typeof categoryIds)[number];

export interface Channel {
  id: string;
  name: string;
  streamUrl: string;
  tvgId?: string;
  logoUrl?: string;
  groupTitle?: string;
  sourceId: string;
  categories: CategoryId[];
  primaryCategory: CategoryId;
}

export interface PlaylistWarning {
  line: number;
  message: string;
}

export interface ParsedPlaylist {
  name?: string;
  channels: Channel[];
  warnings: PlaylistWarning[];
}

export interface EpgChannel {
  id: string;
  displayName: string;
  iconUrl?: string;
}

export interface Programme {
  channelId: string;
  start: Date;
  end?: Date;
  title: string;
  description?: string;
  category?: string;
}

export interface ParsedEpg {
  channels: EpgChannel[];
  programmes: Programme[];
  warnings: PlaylistWarning[];
}

export interface WatchProgress {
  channelId: string;
  positionSeconds: number;
  durationSeconds?: number;
  watchedAt: string;
}

export type PlaybackErrorKind =
  | "network"
  | "unauthorized"
  | "unsupported-format"
  | "drm"
  | "geo-restricted"
  | "unknown";

export interface PlaybackError {
  kind: PlaybackErrorKind;
  message: string;
  retryable: boolean;
}

export type ManifestSourceKind = "official-link" | "user-authorized-playlist" | "direct-stream" | "curated-public-playlist";

export interface SourceManifestEntry {
  id: string;
  name: string;
  kind: ManifestSourceKind;
  categories: CategoryId[];
  access: "free-official" | "user-authorized";
  providerUrl?: string;
  playlistUrl?: string;
  streamUrl?: string;
  provenanceUrl: string;
  rightsNotes: string;
  availabilityNotes: string;
  validation: {
    validatedAt: string;
    method: string;
  };
}
