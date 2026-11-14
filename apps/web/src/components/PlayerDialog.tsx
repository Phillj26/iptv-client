import { useEffect, useRef, useState } from "react";
import { classifyPlaybackError, programmeWindowForChannel, type Channel, type PlaybackError, type Programme } from "@streamline/core";

interface PlayerDialogProps {
  channel: Channel;
  onClose: () => void;
  onWatchProgress: (positionSeconds: number, durationSeconds?: number) => void;
  programmes: Programme[];
}

function timeLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

export function PlayerDialog({ channel, onClose, onWatchProgress, programmes }: PlayerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<PlaybackError>();
  const [attempt, setAttempt] = useState(0);
  const guide = programmeWindowForChannel(programmes, channel.tvgId);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return undefined;
    }

    let active = true;
    let hls: { destroy: () => void } | undefined;
    setError(undefined);

    const attach = async () => {
      try {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = channel.streamUrl;
          return;
        }

        const Hls = (await import("hls.js")).default;
        if (!Hls.isSupported()) {
          throw new Error("Unsupported media format");
        }

        const instance = new Hls({ enableWorker: true });
        hls = instance;
        instance.on(Hls.Events.ERROR, (_event, details) => {
          if (active && details.fatal) {
            setError(classifyPlaybackError(details.details));
          }
        });
        instance.loadSource(channel.streamUrl);
        instance.attachMedia(video);
      } catch (cause) {
        if (active) {
          setError(classifyPlaybackError(cause));
        }
      }
    };

    void attach();
    return () => {
      active = false;
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [attempt, channel.streamUrl]);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-label={`Playing ${channel.name}`}
        aria-modal="true"
        className="player-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="player-header">
          <div>
            <p className="eyebrow">NOW PLAYING</p>
            <h2>{channel.name}</h2>
          </div>
          <button autoFocus className="icon-button" onClick={onClose} type="button" aria-label="Close player">×</button>
        </header>
        <div className="video-frame">
          <video
            controls
            onError={() => setError(classifyPlaybackError(new Error("Network playback error")))}
            onPause={(event) => onWatchProgress(event.currentTarget.currentTime, event.currentTarget.duration)}
            onEnded={(event) => onWatchProgress(event.currentTarget.duration, event.currentTarget.duration)}
            ref={videoRef}
          />
          {error && (
            <div className="player-error" role="alert">
              <strong>Playback unavailable</strong>
              <p>{error.message}</p>
              <div className="button-row">
                {error.retryable && <button className="primary-button" onClick={() => setAttempt((value) => value + 1)} type="button">Try again</button>}
                <button className="secondary-button" onClick={onClose} type="button">Close</button>
              </div>
            </div>
          )}
        </div>
        {(guide.current || guide.next) && (
          <section className="programme-window" aria-label="Programme guide">
            {guide.current && (
              <div>
                <span>Now</span>
                <strong>{guide.current.title}</strong>
                <small>{guide.current.end ? `Ends ${timeLabel(guide.current.end)}` : "In progress"}</small>
              </div>
            )}
            {guide.next && (
              <div>
                <span>Next</span>
                <strong>{guide.next.title}</strong>
                <small>{timeLabel(guide.next.start)}</small>
              </div>
            )}
          </section>
        )}
        <p className="player-note">Playback uses the provider URL you imported. Streamline never reveals or shares its credentials.</p>
      </section>
    </div>
  );
}
