import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import {
  categoryIds,
  channelsForCategory,
  mergeChannels,
  parseM3u,
  parseSourceManifest,
  parseXmlTv,
  programmeWindowForChannel,
  programmesForChannel,
  recordWatchProgress,
  searchChannels,
  toggleFavorite,
  validateRemotePlaylistUrl,
  type CategoryId,
  type Channel,
  type EpgChannel,
  type PlaylistWarning,
  type Programme,
  type SourceManifestEntry,
  type WatchProgress
} from "@streamline/core";
import sourceManifest from "../../../sources/manifest.json";
import { PlayerDialog } from "./components/PlayerDialog";
import {
  clearSession,
  isAuthConfigured,
  loadSession,
  refreshSession,
  saveSession,
  signIn,
  signOut,
  signUp,
  type AuthSession
} from "./lib/auth";
import { nextFocusIndex, type FocusDirection } from "./lib/focus";
import { App as NativeApp } from "@capacitor/app";
import { getDeviceLocation, isNativeRuntime, openProviderLink, registerRefreshTriggers } from "./lib/native";

type NavigationId = "all" | "favorites" | CategoryId;

interface StoredProgramme extends Omit<Programme, "start" | "end"> {
  start: string;
  end?: string;
}

interface LibraryState {
  channels: Channel[];
  favorites: string[];
  history: WatchProgress[];
  playlists: ImportedPlaylist[];
  location?: ViewerLocation;
  epg: {
    channels: EpgChannel[];
    programmes: StoredProgramme[];
  };
}

interface ViewerLocation {
  label: string;
  latitude?: number;
  longitude?: number;
  updatedAt: string;
}

interface ImportedPlaylist {
  id: string;
  label: string;
  importedAt: string;
  channelCount: number;
  sourceUrl?: string;
  defaultCategory?: CategoryId;
  lastRefreshedAt?: string;
  refreshError?: string;
}

const storageKey = "streamline-library-v1";
const sourceCatalogStorageKey = "streamline-source-catalog-v1";
const sourceCatalogUrl = import.meta.env.VITE_SOURCE_MANIFEST_URL || "https://raw.githubusercontent.com/Phillj26/iptv-client/main/sources/manifest.json";
const initialLibrary: LibraryState = { channels: [], favorites: [], history: [], playlists: [], epg: { channels: [], programmes: [] } };
const bundledSourceCatalog = parseSourceManifest(sourceManifest);
const bundledManifestSources = bundledSourceCatalog.sources;
const bundledCatalogTimestamp = bundledSourceCatalog.updatedAt ? Date.parse(bundledSourceCatalog.updatedAt) : 0;

const navigation: Array<{ id: NavigationId; label: string; symbol: string }> = [
  { id: "all", label: "Home", symbol: "⌂" },
  { id: "local", label: "Local", symbol: "⌖" },
  { id: "live-tv", label: "Live TV", symbol: "◉" },
  { id: "news", label: "News", symbol: "▤" },
  { id: "movies", label: "Movies", symbol: "▣" },
  { id: "sports", label: "Sports", symbol: "◒" },
  { id: "premium", label: "Premium", symbol: "◇" },
  { id: "favorites", label: "My List", symbol: "♡" }
];

const categoryCopy: Record<CategoryId, { title: string; description: string }> = {
  local: { title: "Local", description: "Regional and community channels from your library" },
  "live-tv": { title: "Live TV", description: "Your live channels, ready when you are" },
  news: { title: "News", description: "Local, national, and global news sources" },
  movies: { title: "Movies", description: "Movie and on-demand groups from your playlist" },
  sports: { title: "Sports", description: "Authorized sports sources in your library" },
  premium: { title: "Premium", description: "Your subscribed and authorized premium services" }
};

function loadSourceCatalog(): SourceManifestEntry[] {
  try {
    const saved = window.localStorage.getItem(sourceCatalogStorageKey);
    if (saved) {
      const cached = parseSourceManifest(JSON.parse(saved));
      if (cached.updatedAt && Date.parse(cached.updatedAt) >= bundledCatalogTimestamp) {
        return cached.sources;
      }
    }
  } catch {
    return bundledManifestSources;
  }
  return bundledManifestSources;
}

function isCurrentSourceCatalog(updatedAt?: string): boolean {
  if (!updatedAt) {
    return false;
  }
  return Date.parse(updatedAt) >= bundledCatalogTimestamp;
}

function sourceMatchesLocation(source: SourceManifestEntry, location?: ViewerLocation): boolean {
  if (!location?.label || !source.regions?.length) {
    return false;
  }
  const normalizedLabel = location.label.toLocaleLowerCase();
  return source.regions.some((region) => normalizedLabel.includes(region.toLocaleLowerCase()));
}

function loadLibrary(): LibraryState {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) {
      return initialLibrary;
    }

    const parsed = JSON.parse(saved) as Partial<LibraryState>;
    return {
      channels: Array.isArray(parsed.channels) ? parsed.channels : [],
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      playlists: Array.isArray(parsed.playlists) ? parsed.playlists : [],
      location: parsed.location && typeof parsed.location.label === "string"
        ? {
            label: parsed.location.label,
            latitude: typeof parsed.location.latitude === "number" ? parsed.location.latitude : undefined,
            longitude: typeof parsed.location.longitude === "number" ? parsed.location.longitude : undefined,
            updatedAt: typeof parsed.location.updatedAt === "string" ? parsed.location.updatedAt : new Date().toISOString()
          }
        : undefined,
      epg: {
        channels: Array.isArray(parsed.epg?.channels) ? parsed.epg.channels : [],
        programmes: Array.isArray(parsed.epg?.programmes) ? parsed.epg.programmes : []
      }
    };
  } catch {
    return initialLibrary;
  }
}

function sourceIdFrom(label: string, identity = label): string {
  const normalized = label.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  let hash = 5381;
  for (let index = 0; index < identity.length; index += 1) {
    hash = (hash * 33) ^ identity.charCodeAt(index);
  }
  return `playlist-${normalized || "import"}-${(hash >>> 0).toString(36)}`;
}

function hasCredentialQuery(value: string): boolean {
  try {
    const url = new URL(value);
    return Boolean(url.username || url.password) || [...url.searchParams.keys()].some((key) => /token|key|secret|auth|password|signature/i.test(key));
  } catch {
    return true;
  }
}

function displaySourceName(channel: Channel): string {
  return channel.groupTitle || categoryCopy[channel.primaryCategory].title;
}

function categoryTitle(category: NavigationId): string {
  if (category === "all") {
    return "Your library";
  }
  if (category === "favorites") {
    return "My List";
  }
  return categoryCopy[category].title;
}

function channelGuide(programmes: Programme[], channel: Channel): string | undefined {
  return programmeWindowForChannel(programmes, channel.tvgId).current?.title;
}

interface ChannelGroup {
  label: string;
  channels: Channel[];
}

function channelGroups(channels: Channel[]): ChannelGroup[] {
  const grouped = new Map<string, Channel[]>();
  for (const channel of channels) {
    const label = channel.groupTitle?.trim() || "Featured";
    const group = grouped.get(label) ?? [];
    group.push(channel);
    grouped.set(label, group);
  }

  return [...grouped.entries()]
    .map(([label, groupedChannels]) => ({
      label,
      channels: [...groupedChannels].sort((left, right) => left.name.localeCompare(right.name))
    }))
    .sort((left, right) => {
      if (left.label === "Featured") return -1;
      if (right.label === "Featured") return 1;
      return left.label.localeCompare(right.label);
    });
}

interface ChannelRowProps {
  title: string;
  subtitle: string;
  channels: Channel[];
  favoriteIds: string[];
  programmes: Programme[];
  onPlay: (channel: Channel) => void;
  onToggleFavorite: (channelId: string) => void;
}

function ChannelRow({ title, subtitle, channels, favoriteIds, programmes, onPlay, onToggleFavorite }: ChannelRowProps) {
  const onRemoteKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      return;
    }

    const target = event.target as HTMLElement;
    if (!target.matches("button[data-channel-card]")) {
      return;
    }

    const row = target.closest(".content-row");
    const grid = target.closest(".channel-grid");
    const cards = grid ? [...grid.querySelectorAll<HTMLButtonElement>("button[data-channel-card]")] : [];
    const current = cards.indexOf(target as HTMLButtonElement);
    if (current === -1) {
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const rows = [...document.querySelectorAll<HTMLElement>(".content-row")];
      const rowIndex = row ? rows.indexOf(row as HTMLElement) : -1;
      const nextRow = rows[rowIndex + (event.key === "ArrowDown" ? 1 : -1)];
      const nextRowCards = nextRow ? [...nextRow.querySelectorAll<HTMLButtonElement>("button[data-channel-card]")] : [];
      if (nextRowCards.length > 0) {
        event.preventDefault();
        const nextRowCard = nextRowCards[Math.min(current, nextRowCards.length - 1)];
        nextRowCard.focus({ preventScroll: true });
        nextRowCard.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
      return;
    }

    const next = nextFocusIndex(current, cards.length, cards.length, event.key as FocusDirection);
    event.preventDefault();
    cards[next]?.focus({ preventScroll: true });
    cards[next]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  return (
    <section className="content-row" aria-label={title}>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className="count-pill">{channels.length}</span>
      </div>
      <div className="channel-grid" onKeyDown={onRemoteKeyDown}>
        {channels.map((channel) => {
          const isFavorite = favoriteIds.includes(channel.id);
          const guide = channelGuide(programmes, channel);
          return (
            <article className="channel-shell" key={channel.id}>
              <button className="channel-card" data-channel-card onClick={() => onPlay(channel)} type="button">
                <div className="channel-art" aria-hidden="true">
                  {channel.logoUrl ? (
                    <img alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} src={channel.logoUrl} />
                  ) : (
                    <span>{channel.name.slice(0, 1).toLocaleUpperCase()}</span>
                  )}
                </div>
                <div className="channel-details">
                  <strong>{channel.name}</strong>
                  <span>{guide || displaySourceName(channel)}</span>
                </div>
                <span className="play-marker" aria-hidden="true">▶</span>
              </button>
              <button
                aria-label={`${isFavorite ? "Remove" : "Add"} ${channel.name} ${isFavorite ? "from" : "to"} My List`}
                aria-pressed={isFavorite}
                className="favorite-button"
                onClick={() => onToggleFavorite(channel.id)}
                type="button"
              >
                {isFavorite ? "♥" : "♡"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

interface ChannelCollectionProps extends Omit<ChannelRowProps, "title" | "subtitle" | "channels"> {
  title: string;
  subtitle: string;
  channels: Channel[];
}

function ChannelCollection({ title, subtitle, channels, ...rowProps }: ChannelCollectionProps) {
  const groups = channelGroups(channels);
  return (
    <>
      {groups.map((group) => (
        <ChannelRow
          {...rowProps}
          channels={group.channels}
          key={`${title}-${group.label}`}
          subtitle={groups.length > 1 ? `${group.channels.length} in this collection` : subtitle}
          title={groups.length > 1 ? `${title} · ${group.label}` : title}
        />
      ))}
    </>
  );
}

export function App() {
  const [library, setLibrary] = useState<LibraryState>(loadLibrary);
  const [activeNavigation, setActiveNavigation] = useState<NavigationId>("all");
  const [query, setQuery] = useState("");
  const [isSetupOpen, setSetupOpen] = useState(false);
  const [playlistText, setPlaylistText] = useState("");
  const [remotePlaylistUrl, setRemotePlaylistUrl] = useState("");
  const [warnings, setWarnings] = useState<PlaylistWarning[]>([]);
  const [notice, setNotice] = useState<string>();
  const [activeChannel, setActiveChannel] = useState<Channel>();
  const [authSession, setAuthSession] = useState<AuthSession | undefined>(loadSession);
  const [isAuthOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [locationDraft, setLocationDraft] = useState("");
  const [manifestSources, setManifestSources] = useState<SourceManifestEntry[]>(loadSourceCatalog);
  const [sourceCatalogStatus, setSourceCatalogStatus] = useState("Auto-updates enabled");

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(library));
  }, [library]);

  useEffect(() => {
    setLocationDraft(library.location?.label || "");
  }, []);

  useEffect(() => {
    let active = true;
    let removeRefreshTriggers: (() => void) | undefined;
    const refreshSourceCatalog = async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15_000);
      try {
        const validatedUrl = validateRemotePlaylistUrl(sourceCatalogUrl);
        const response = await fetch(validatedUrl, { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Provider catalog returned ${response.status}`);
        }
        const catalog = parseSourceManifest(await response.json());
        if (catalog.sources.length === 0) {
          throw new Error("Provider catalog is empty");
        }
        if (!isCurrentSourceCatalog(catalog.updatedAt)) {
          throw new Error("Provider catalog is older than the bundled catalog");
        }
        window.localStorage.setItem(sourceCatalogStorageKey, JSON.stringify({ ...catalog, fetchedAt: new Date().toISOString() }));
        if (active) {
          setManifestSources(catalog.sources);
          setSourceCatalogStatus(`Updated ${new Date().toLocaleString()}`);
        }
      } catch {
        if (active) {
          setSourceCatalogStatus("Using the bundled catalog; the next retry is automatic");
        }
      } finally {
        window.clearTimeout(timeout);
      }
    };

    void refreshSourceCatalog();
    const interval = window.setInterval(() => void refreshSourceCatalog(), 6 * 60 * 60 * 1000);
    void registerRefreshTriggers(refreshSourceCatalog)
      .then((remove) => {
        if (active) {
          removeRefreshTriggers = remove;
        } else {
          remove();
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
      window.clearInterval(interval);
      removeRefreshTriggers?.();
    };
  }, []);

  useEffect(() => {
    if (!authSession || !isAuthConfigured()) {
      return undefined;
    }
    if (authSession.expiresAt > Date.now() + 60_000) {
      saveSession(authSession);
      return undefined;
    }

    let active = true;
    void refreshSession(authSession)
      .then((refreshed) => {
        if (!active) {
          return;
        }
        if (refreshed) {
          setAuthSession(refreshed);
          saveSession(refreshed);
        } else {
          setAuthSession(undefined);
          clearSession();
        }
      })
      .catch(() => {
        if (active) {
          setAuthSession(undefined);
          clearSession();
        }
      });
    return () => {
      active = false;
    };
  }, [authSession]);

  const programmes = useMemo(
    () => library.epg.programmes.map((programme) => ({
      ...programme,
      start: new Date(programme.start),
      end: programme.end ? new Date(programme.end) : undefined
    })),
    [library.epg.programmes]
  );

  const categoryChannels = useMemo(() => {
    if (activeNavigation === "all") {
      return library.channels;
    }
    if (activeNavigation === "favorites") {
      return library.channels.filter((channel) => library.favorites.includes(channel.id));
    }
    return channelsForCategory(library.channels, activeNavigation);
  }, [activeNavigation, library.channels, library.favorites]);

  const visibleChannels = useMemo(() => searchChannels(categoryChannels, query), [categoryChannels, query]);
  const recentlyWatched = library.history
    .map((history) => library.channels.find((channel) => channel.id === history.channelId))
    .filter((channel): channel is Channel => Boolean(channel));

  const orderedManifestSources = useMemo(() => [...manifestSources].sort((left, right) => {
    const leftMatches = sourceMatchesLocation(left, library.location) ? 1 : 0;
    const rightMatches = sourceMatchesLocation(right, library.location) ? 1 : 0;
    return rightMatches - leftMatches || left.name.localeCompare(right.name);
  }), [library.location, manifestSources]);

  const importPlaylist = (
    content: string,
    label: string,
    identity = label,
    defaultCategory?: CategoryId,
    sourceUrl?: string
  ) => {
    const sourceId = sourceIdFrom(label, identity);
    const parsed = parseM3u(content, { sourceId, name: label, defaultCategory });
    setWarnings(parsed.warnings);
    if (parsed.channels.length === 0) {
      setNotice("No playable HTTP(S) channels were found. Check that this is an authorized M3U or M3U8 playlist.");
      return;
    }

    const importedAt = new Date().toISOString();
    setLibrary((current) => ({
      ...current,
      channels: mergeChannels(current.channels.filter((channel) => channel.sourceId !== sourceId), parsed.channels),
      playlists: [
        ...current.playlists.filter((playlist) => playlist.id !== sourceId),
        {
          id: sourceId,
          label,
          importedAt,
          channelCount: parsed.channels.length,
          defaultCategory,
          lastRefreshedAt: sourceUrl ? importedAt : undefined,
          sourceUrl
        }
      ]
    }));
    setNotice(`Added ${parsed.channels.length} channel${parsed.channels.length === 1 ? "" : "s"} from ${label}. ${sourceUrl ? "Automatic refresh is enabled." : "Re-importing this source replaces it."}`);
    setPlaylistText("");
    setSetupOpen(false);
  };

  const importPlaylistUrl = async (url: string, label: string, defaultCategory?: CategoryId) => {
    try {
      const validatedUrl = validateRemotePlaylistUrl(url);
      const response = await fetch(validatedUrl);
      if (!response.ok) {
        throw new Error(`Provider returned ${response.status}`);
      }
      const sourceUrl = hasCredentialQuery(validatedUrl.href) ? undefined : validatedUrl.href;
      importPlaylist(await response.text(), label, validatedUrl.href, defaultCategory, sourceUrl);
      if (!sourceUrl) {
        setNotice("Playlist added. Automatic refresh is disabled because the URL contains credential parameters; the URL is not stored.");
      }
    } catch {
      setNotice("This playlist could not be imported from the web. Download the authorized file and import it locally instead.");
    }
  };

  const refreshPlaylist = async (playlist: ImportedPlaylist) => {
    if (!playlist.sourceUrl) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const validatedUrl = validateRemotePlaylistUrl(playlist.sourceUrl);
      const response = await fetch(validatedUrl, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Provider returned ${response.status}`);
      }
      const sourceId = sourceIdFrom(playlist.label, validatedUrl.href);
      const parsed = parseM3u(await response.text(), {
        defaultCategory: playlist.defaultCategory,
        name: playlist.label,
        sourceId
      });
      if (parsed.channels.length === 0) {
        throw new Error("No playable channels");
      }
      const refreshedAt = new Date().toISOString();
      setLibrary((current) => ({
        ...current,
        channels: mergeChannels(current.channels.filter((channel) => channel.sourceId !== sourceId), parsed.channels),
        playlists: current.playlists.map((entry) => entry.id === playlist.id
          ? { ...entry, channelCount: parsed.channels.length, lastRefreshedAt: refreshedAt, refreshError: undefined }
          : entry)
      }));
    } catch {
      setLibrary((current) => ({
        ...current,
        playlists: current.playlists.map((entry) => entry.id === playlist.id
          ? { ...entry, refreshError: "Could not refresh automatically. Re-import this source when it is available." }
          : entry)
      }));
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const refreshablePlaylistKey = library.playlists
    .filter((playlist) => playlist.sourceUrl)
    .map((playlist) => `${playlist.id}:${playlist.sourceUrl}`)
    .join("|");

  useEffect(() => {
    if (!refreshablePlaylistKey) {
      return undefined;
    }

    const refreshablePlaylists = library.playlists.filter((playlist) => playlist.sourceUrl);
    let active = true;
    const refreshAll = async () => {
      for (const playlist of refreshablePlaylists) {
        if (!active) {
          return;
        }
        await refreshPlaylist(playlist);
      }
    };
    void refreshAll();
    const interval = window.setInterval(() => void refreshAll(), 6 * 60 * 60 * 1000);
    let removeRefreshTriggers: (() => void) | undefined;
    void registerRefreshTriggers(refreshAll)
      .then((remove) => {
        if (active) {
          removeRefreshTriggers = remove;
        } else {
          remove();
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
      window.clearInterval(interval);
      removeRefreshTriggers?.();
    };
  }, [refreshablePlaylistKey]);

  useEffect(() => {
    if (!isNativeRuntime) {
      return undefined;
    }

    let removeBackButton: (() => void) | undefined;
    void NativeApp.addListener("backButton", ({ canGoBack }) => {
      if (activeChannel) {
        setActiveChannel(undefined);
      } else if (isAuthOpen) {
        setAuthOpen(false);
      } else if (isSetupOpen) {
        setSetupOpen(false);
      } else if (!canGoBack) {
        void NativeApp.exitApp();
      }
    }).then((handle) => {
      removeBackButton = () => void handle.remove();
    });

    return () => removeBackButton?.();
  }, [activeChannel, isAuthOpen, isSetupOpen]);

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAuthConfigured()) {
      setNotice("Login is not configured for this build. Add the Supabase environment variables before signing in.");
      return;
    }

    setAuthBusy(true);
    try {
      const result = authMode === "sign-in"
        ? await signIn(authEmail.trim(), authPassword)
        : await signUp(authEmail.trim(), authPassword);
      if (result.session) {
        setAuthSession(result.session);
        saveSession(result.session);
        setAuthOpen(false);
        setNotice(`Signed in as ${result.session.user.email || "your account"}.`);
      } else {
        setNotice("Account created. Check your email to confirm it, then sign in.");
        setAuthMode("sign-in");
      }
      setAuthPassword("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Authentication failed. Try again.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleAuthSignOut = async () => {
    if (authSession) {
      await signOut(authSession).catch(() => undefined);
    }
    setAuthSession(undefined);
    clearSession();
    setAuthOpen(false);
    setNotice("Signed out on this device.");
  };

  const saveViewerLocation = (label: string, latitude?: number, longitude?: number) => {
    const normalizedLabel = label.trim();
    setLocationDraft(normalizedLabel);
    setLibrary((current) => ({
      ...current,
      location: normalizedLabel
        ? { label: normalizedLabel, latitude, longitude, updatedAt: new Date().toISOString() }
        : undefined
    }));
    setNotice(normalizedLabel ? `Local TV region saved as ${normalizedLabel}. Provider availability still controls which channels work there.` : "Local TV region cleared.");
  };

  const useDeviceLocation = async () => {
    try {
      const location = await getDeviceLocation();
      const label = `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`;
      saveViewerLocation(label, location.latitude, location.longitude);
    } catch {
      setNotice("Location permission was unavailable. Enter your region manually; it stays on this device.");
    }
  };

  const onPlaylistFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    importPlaylist(await file.text(), file.name, `${file.name}:${file.size}:${file.lastModified}`);
    event.target.value = "";
  };

  const onEpgFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const parsed = parseXmlTv(await file.text());
    setWarnings(parsed.warnings);
    setLibrary((current) => ({
      ...current,
      epg: {
        channels: parsed.channels,
        programmes: parsed.programmes.map((programme) => ({
          ...programme,
          start: programme.start.toISOString(),
          end: programme.end?.toISOString()
        }))
      }
    }));
    setNotice(`Added guide data for ${parsed.channels.length} channels and ${parsed.programmes.length} programmes.`);
    event.target.value = "";
  };

  const onRemotePlaylist = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let label = "Remote playlist";
    try {
      label = new URL(remotePlaylistUrl).hostname;
    } catch {}
    await importPlaylistUrl(remotePlaylistUrl, label);
    setRemotePlaylistUrl("");
  };

  const toggleChannelFavorite = (channelId: string) => {
    setLibrary((current) => ({ ...current, favorites: toggleFavorite(current.favorites, channelId) }));
  };

  const updateProgress = (channel: Channel, positionSeconds: number, durationSeconds?: number) => {
    if (!Number.isFinite(positionSeconds) || positionSeconds < 0) {
      return;
    }
    setLibrary((current) => ({
      ...current,
      history: recordWatchProgress(current.history, { channelId: channel.id, positionSeconds, durationSeconds })
    }));
  };

  const removePlaylist = (playlist: ImportedPlaylist) => {
    setLibrary((current) => {
      const remainingChannels = current.channels.filter((channel) => channel.sourceId !== playlist.id);
      const remainingIds = new Set(remainingChannels.map((channel) => channel.id));
      return {
        ...current,
        channels: remainingChannels,
        favorites: current.favorites.filter((channelId) => remainingIds.has(channelId)),
        history: current.history.filter((entry) => remainingIds.has(entry.channelId)),
        playlists: current.playlists.filter((entry) => entry.id !== playlist.id)
      };
    });
    if (activeChannel?.sourceId === playlist.id) {
      setActiveChannel(undefined);
    }
    setNotice(`Removed ${playlist.label} from this device.`);
  };

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="#top" aria-label="Streamline home"><span>▶</span> STREAMLINE</a>
        <nav>
          {navigation.map((item) => (
            <button
              aria-current={activeNavigation === item.id ? "page" : undefined}
              className={activeNavigation === item.id ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={() => setActiveNavigation(item.id)}
              type="button"
            >
              <span aria-hidden="true">{item.symbol}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="privacy-dot" /> Local-only library
        </div>
      </aside>

      <div className="page" id="top">
        <header className="top-bar">
          <button className="mobile-brand" onClick={() => setActiveNavigation("all")} type="button">▶ STREAMLINE</button>
          <label className="search-field">
            <span aria-hidden="true">⌕</span>
            <input aria-label="Search your library" onChange={(event) => setQuery(event.target.value)} placeholder="Search your library" value={query} />
          </label>
          <button
            className="profile-button"
            onClick={() => setAuthOpen(true)}
            type="button"
            aria-label={authSession ? `Account ${authSession.user.email || "signed in"}` : "Sign in"}
          >
            {authSession?.user.email?.slice(0, 1).toLocaleUpperCase() || "P"}
          </button>
        </header>

        <section className="hero">
          <div className="hero-content">
            <p className="eyebrow">YOUR AUTHORIZED LIBRARY</p>
            <h1>Watch what you <em>actually</em> own.</h1>
            <p>One elegant home for playlists, guide data, favorites, and official provider handoffs—on every screen.</p>
            <div className="button-row">
              <button className="primary-button" onClick={() => setSetupOpen(true)} type="button">＋ Add playlist</button>
              <button className="secondary-button" onClick={() => document.getElementById("official-sources")?.scrollIntoView({ behavior: "smooth" })} type="button">Explore official sources</button>
            </div>
          </div>
          <div className="hero-orbit" aria-hidden="true">
            <span className="orbit-signal" />
            <span className="hero-play">▶</span>
            <small>LIVE READY</small>
          </div>
        </section>

        {isSetupOpen && (
          <section className="setup-panel" aria-label="Import authorized sources">
            <div className="section-heading">
              <div>
                <p className="eyebrow">LIBRARY SETUP</p>
                <h2>Add your authorized sources</h2>
              </div>
              <button className="icon-button" onClick={() => setSetupOpen(false)} type="button" aria-label="Close setup">×</button>
            </div>
            <div className="setup-grid">
              <label className="upload-card">
                <span>▤</span>
                <strong>Import M3U / M3U8</strong>
                <small>Select an authorized local playlist file</small>
                <input accept=".m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl,text/plain" onChange={onPlaylistFile} type="file" />
              </label>
              <label className="upload-card">
                <span>▦</span>
                <strong>Import XMLTV guide</strong>
                <small>Add programme information for matching `tvg-id` values</small>
                <input accept=".xml,.xmltv,text/xml,application/xml" onChange={onEpgFile} type="file" />
              </label>
              <form className="url-card" onSubmit={onRemotePlaylist}>
                <strong>Authorized HTTPS playlist URL</strong>
                <small>Only use a URL your provider permits you to load here.</small>
                <input onChange={(event) => setRemotePlaylistUrl(event.target.value)} placeholder="https://provider.example/playlist.m3u" required type="url" value={remotePlaylistUrl} />
                <button className="secondary-button" type="submit">Import URL</button>
              </form>
            </div>
            <div className="location-card">
              <div>
                <strong>Local TV region</strong>
                <small>Save a city, state, country code, or device location as a local-only availability hint.</small>
              </div>
              <div className="location-controls">
                <input aria-label="Local TV region" onChange={(event) => setLocationDraft(event.target.value)} placeholder="e.g. New York, US" type="text" value={locationDraft} />
                <button className="secondary-button" onClick={() => saveViewerLocation(locationDraft)} type="button">Save region</button>
                <button className="secondary-button" onClick={useDeviceLocation} type="button">Use device location</button>
              </div>
              <small>Coordinates are not uploaded by Streamline. Your broadcaster or provider decides regional availability.</small>
            </div>
            <div className="paste-panel">
              <label htmlFor="playlist-text">Paste playlist text</label>
              <textarea
                id="playlist-text"
                onChange={(event) => setPlaylistText(event.target.value)}
                placeholder={'#EXTM3U\n#EXTINF:-1 tvg-id="your.channel",Channel name\nhttps://your-authorized-provider.example/channel.m3u8'}
                value={playlistText}
              />
              <button className="primary-button" disabled={playlistText.trim().length === 0} onClick={() => importPlaylist(playlistText, "Pasted playlist", playlistText)} type="button">Add playlist text</button>
            </div>
            <section className="playlist-manager" aria-label="Imported playlists">
              <div>
                <strong>Imported playlists</strong>
                <p>Stored only on this device. Removing one also removes its channels, favorites, and watch history.</p>
              </div>
              {library.playlists.length > 0 ? (
                <ul>
                  {library.playlists.map((playlist) => (
                    <li key={playlist.id}>
                      <div>
                        <strong>{playlist.label}</strong>
                        <small>
                          {playlist.channelCount} channel{playlist.channelCount === 1 ? "" : "s"} · Imported {new Date(playlist.importedAt).toLocaleDateString()}
                          {playlist.sourceUrl ? ` · Auto refresh ${playlist.refreshError ? "needs attention" : "enabled"}` : ""}
                          {playlist.lastRefreshedAt ? ` · Updated ${new Date(playlist.lastRefreshedAt).toLocaleString()}` : ""}
                        </small>
                      </div>
                      <button className="text-button" onClick={() => removePlaylist(playlist)} type="button">Remove</button>
                    </li>
                  ))}
                </ul>
              ) : <span className="playlist-empty">No playlists imported yet.</span>}
            </section>
          </section>
        )}

        {notice && <div className="notice" role="status"><span>✓</span>{notice}<button onClick={() => setNotice(undefined)} type="button" aria-label="Dismiss message">×</button></div>}
        {isAuthOpen && (
          <section className="setup-panel auth-panel" aria-label="Account access">
            <div className="section-heading">
              <div>
                <p className="eyebrow">ACCOUNT ACCESS</p>
                <h2>{authSession ? "Your Streamline account" : authMode === "sign-in" ? "Sign in" : "Create an account"}</h2>
              </div>
              <button className="icon-button" onClick={() => setAuthOpen(false)} type="button" aria-label="Close account panel">x</button>
            </div>
            {authSession ? (
              <div className="auth-signed-in">
                <p>Signed in as <strong>{authSession.user.email || "your account"}</strong>.</p>
                <p>Your account can be used for future cross-device library sync. Playlist credentials remain with their providers.</p>
                <button className="secondary-button" onClick={() => void handleAuthSignOut()} type="button">Sign out</button>
              </div>
            ) : (
              <form className="auth-form" onSubmit={handleAuthSubmit}>
                <p className="auth-note">Login is optional. Your current library remains on this device until sync is enabled for your account.</p>
                <label>
                  Email
                  <input autoComplete="email" onChange={(event) => setAuthEmail(event.target.value)} required type="email" value={authEmail} />
                </label>
                <label>
                  Password
                  <input autoComplete={authMode === "sign-in" ? "current-password" : "new-password"} minLength={8} onChange={(event) => setAuthPassword(event.target.value)} required type="password" value={authPassword} />
                </label>
                <div className="button-row">
                  <button className="primary-button" disabled={authBusy} type="submit">{authBusy ? "Working…" : authMode === "sign-in" ? "Sign in" : "Create account"}</button>
                  <button className="secondary-button" onClick={() => setAuthMode((mode) => mode === "sign-in" ? "sign-up" : "sign-in")} type="button">
                    {authMode === "sign-in" ? "Create account" : "Use sign in"}
                  </button>
                </div>
                <small className="auth-status">{isAuthConfigured() ? "Connected to the configured authentication service." : "Account login is not configured in this build yet."}</small>
              </form>
            )}
          </section>
        )}

        {warnings.length > 0 && <div className="warning" role="status">Imported with {warnings.length} skipped or incomplete item{warnings.length === 1 ? "" : "s"}. No credentials or source URLs are shown.</div>}

        {library.channels.length === 0 ? (
          <section className="empty-state">
            <span aria-hidden="true">◌</span>
            <h2>Your library is ready for its first playlist.</h2>
            <p>Import an M3U/M3U8 and optional XMLTV guide that you are authorized to use. Premium provider credentials stay with the provider.</p>
            <button className="primary-button" onClick={() => setSetupOpen(true)} type="button">Add authorized playlist</button>
          </section>
        ) : (
          <>
            {recentlyWatched.length > 0 && activeNavigation === "all" && (
              <ChannelRow
                channels={recentlyWatched}
                favoriteIds={library.favorites}
                onPlay={setActiveChannel}
                onToggleFavorite={toggleChannelFavorite}
                programmes={programmes}
                subtitle="Pick up right where you left off"
                title="Continue watching"
              />
            )}
            {activeNavigation === "all" && library.favorites.length > 0 && (
              <ChannelRow
                channels={library.channels.filter((channel) => library.favorites.includes(channel.id))}
                favoriteIds={library.favorites}
                onPlay={setActiveChannel}
                onToggleFavorite={toggleChannelFavorite}
                programmes={programmes}
                subtitle="The channels you saved for quick access"
                title="My List"
              />
            )}
            {activeNavigation === "all" ? (
              categoryIds.map((category) => {
                const channels = searchChannels(channelsForCategory(library.channels, category), query);
                return channels.length > 0 ? (
                  <ChannelCollection
                    channels={channels}
                    favoriteIds={library.favorites}
                    key={category}
                    onPlay={setActiveChannel}
                    onToggleFavorite={toggleChannelFavorite}
                    programmes={programmes}
                    subtitle={category === "local" && library.location?.label ? `Authorized local channels for ${library.location.label}` : categoryCopy[category].description}
                    title={categoryCopy[category].title}
                  />
                ) : null;
              })
            ) : visibleChannels.length > 0 ? (
              <ChannelCollection
                channels={visibleChannels}
                favoriteIds={library.favorites}
                onPlay={setActiveChannel}
                onToggleFavorite={toggleChannelFavorite}
                programmes={programmes}
                subtitle={query ? `Results for “${query}”` : `${visibleChannels.length} channels available`}
                title={categoryTitle(activeNavigation)}
              />
            ) : (
              <section className="empty-state compact">
                <h2>Nothing matched this view.</h2>
                <p>Try a different search or add another authorized playlist.</p>
              </section>
            )}
          </>
        )}

        <section className="official-sources" id="official-sources">
          <div className="section-heading">
            <div>
              <p className="eyebrow">VERIFIED PROVIDER LINKS</p>
              <h2>Official places to explore</h2>
            </div>
            <div className="source-status">
              <span className="policy-label">No bundled restreams</span>
              <small>{sourceCatalogStatus}</small>
            </div>
          </div>
          <div className="source-grid">
            {orderedManifestSources.map((source) => (
              <article className="source-card" key={source.id}>
                <div>
                  <span className="source-type">{source.kind === "curated-public-playlist" ? "Public-domain playlist" : source.access === "free-official" ? "Official free access" : "Your authorization required"}</span>
                  <h3>{source.name}</h3>
                  {sourceMatchesLocation(source, library.location) && <small className="source-recommended">Recommended for {library.location?.label}</small>}
                  <p>{source.availabilityNotes}</p>
                </div>
                {source.playlistUrl ? (
                  <button className="secondary-button" onClick={() => void importPlaylistUrl(source.playlistUrl as string, source.name, source.categories[0])} type="button">Add playlist</button>
                ) : source.providerUrl ? (
                  <button className="secondary-button" onClick={() => { if (source.providerUrl) void openProviderLink(source.providerUrl); }} type="button">Open provider ↗</button>
                ) : (
                  <button className="secondary-button" onClick={() => setSetupOpen(true)} type="button">Add your source</button>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>

      {activeChannel && (
        <PlayerDialog
          channel={activeChannel}
          onClose={() => setActiveChannel(undefined)}
          onWatchProgress={(positionSeconds, durationSeconds) => updateProgress(activeChannel, positionSeconds, durationSeconds)}
          programmes={programmes}
        />
      )}
    </main>
  );
}
