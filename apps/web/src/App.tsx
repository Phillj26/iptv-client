import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import {
  categoryIds,
  channelsForCategory,
  mergeChannels,
  parseM3u,
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
import { nextFocusIndex, type FocusDirection } from "./lib/focus";

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
  epg: {
    channels: EpgChannel[];
    programmes: StoredProgramme[];
  };
}

interface ImportedPlaylist {
  id: string;
  label: string;
  importedAt: string;
  channelCount: number;
}

const storageKey = "streamline-library-v1";
const initialLibrary: LibraryState = { channels: [], favorites: [], history: [], playlists: [], epg: { channels: [], programmes: [] } };
const manifestSources = sourceManifest.sources as unknown as SourceManifestEntry[];

const navigation: Array<{ id: NavigationId; label: string; symbol: string }> = [
  { id: "all", label: "Home", symbol: "⌂" },
  { id: "local", label: "Local", symbol: "⌖" },
  { id: "live-tv", label: "Live TV", symbol: "◉" },
  { id: "movies", label: "Movies", symbol: "▣" },
  { id: "sports", label: "Sports", symbol: "◒" },
  { id: "premium", label: "Premium", symbol: "◇" },
  { id: "favorites", label: "My List", symbol: "♡" }
];

const categoryCopy: Record<CategoryId, { title: string; description: string }> = {
  local: { title: "Local", description: "Regional and community channels from your library" },
  "live-tv": { title: "Live TV", description: "Your live channels, ready when you are" },
  movies: { title: "Movies", description: "Movie and on-demand groups from your playlist" },
  sports: { title: "Sports", description: "Authorized sports sources in your library" },
  premium: { title: "Premium", description: "Your subscribed and authorized premium services" }
};

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

    const grid = target.closest(".channel-grid");
    const cards = grid ? [...grid.querySelectorAll<HTMLButtonElement>("button[data-channel-card]")] : [];
    const current = cards.indexOf(target as HTMLButtonElement);
    if (current === -1) {
      return;
    }

    const columns = Math.max(1, Math.floor((grid?.clientWidth ?? 180) / 180));
    const next = nextFocusIndex(current, cards.length, columns, event.key as FocusDirection);
    event.preventDefault();
    cards[next]?.focus();
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

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(library));
  }, [library]);

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

  const importPlaylist = (content: string, label: string, identity = label) => {
    const sourceId = sourceIdFrom(label, identity);
    const parsed = parseM3u(content, { sourceId, name: label });
    setWarnings(parsed.warnings);
    if (parsed.channels.length === 0) {
      setNotice("No playable HTTP(S) channels were found. Check that this is an authorized M3U or M3U8 playlist.");
      return;
    }

    setLibrary((current) => ({
      ...current,
      channels: mergeChannels(current.channels.filter((channel) => channel.sourceId !== sourceId), parsed.channels),
      playlists: [
        ...current.playlists.filter((playlist) => playlist.id !== sourceId),
        { id: sourceId, label, importedAt: new Date().toISOString(), channelCount: parsed.channels.length }
      ]
    }));
    setNotice(`Added ${parsed.channels.length} channel${parsed.channels.length === 1 ? "" : "s"} from ${label}. Re-importing this source replaces it.`);
    setPlaylistText("");
    setSetupOpen(false);
  };

  const importPlaylistUrl = async (url: string, label: string) => {
    try {
      const validatedUrl = validateRemotePlaylistUrl(url);
      const response = await fetch(validatedUrl);
      if (!response.ok) {
        throw new Error(`Provider returned ${response.status}`);
      }
      importPlaylist(await response.text(), label, validatedUrl.href);
    } catch {
      setNotice("This playlist could not be imported from the web. Download the authorized file and import it locally instead.");
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
          <button className="profile-button" type="button" aria-label="Local profile">P</button>
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
                        <small>{playlist.channelCount} channel{playlist.channelCount === 1 ? "" : "s"} · Imported {new Date(playlist.importedAt).toLocaleDateString()}</small>
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
                  <ChannelRow
                    channels={channels}
                    favoriteIds={library.favorites}
                    key={category}
                    onPlay={setActiveChannel}
                    onToggleFavorite={toggleChannelFavorite}
                    programmes={programmes}
                    subtitle={categoryCopy[category].description}
                    title={categoryCopy[category].title}
                  />
                ) : null;
              })
            ) : visibleChannels.length > 0 ? (
              <ChannelRow
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
            <span className="policy-label">No bundled restreams</span>
          </div>
          <div className="source-grid">
            {manifestSources.map((source) => (
              <article className="source-card" key={source.id}>
                <div>
                  <span className="source-type">{source.kind === "curated-public-playlist" ? "Public-domain playlist" : source.access === "free-official" ? "Official free access" : "Your authorization required"}</span>
                  <h3>{source.name}</h3>
                  <p>{source.availabilityNotes}</p>
                </div>
                {source.playlistUrl ? (
                  <button className="secondary-button" onClick={() => void importPlaylistUrl(source.playlistUrl as string, source.name)} type="button">Add playlist</button>
                ) : source.providerUrl ? (
                  <button className="secondary-button" onClick={() => window.open(source.providerUrl, "_blank", "noopener,noreferrer")} type="button">Open provider ↗</button>
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
