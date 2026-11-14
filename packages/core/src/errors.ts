import type { PlaybackError, PlaybackErrorKind } from "./types";

function errorText(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }
  return "";
}

export function classifyPlaybackError(error: unknown): PlaybackError {
  const message = errorText(error).toLocaleLowerCase();
  const kinds: Array<[PlaybackErrorKind, RegExp, string, boolean]> = [
    ["unauthorized", /401|403|unauthori[sz]ed|forbidden|entitlement/, "This source requires authorization from its provider.", false],
    ["drm", /drm|widevine|fairplay|license/, "This source requires the provider's approved playback experience.", false],
    ["geo-restricted", /geo|region|country|location|not available in your/, "This source is not available in your current region.", false],
    ["unsupported-format", /codec|decode|format|manifest|media source/, "This device cannot play this stream format.", false],
    ["network", /network|timeout|offline|fetch|connection|dns|cors/, "The stream could not be reached. Check your connection and try again.", true]
  ];

  for (const [kind, matcher, userMessage, retryable] of kinds) {
    if (matcher.test(message)) {
      return { kind, message: userMessage, retryable };
    }
  }

  return {
    kind: "unknown",
    message: "Playback stopped unexpectedly. Try refreshing your authorized playlist.",
    retryable: true
  };
}
