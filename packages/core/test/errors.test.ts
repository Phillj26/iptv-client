import { describe, expect, it } from "vitest";
import { classifyPlaybackError } from "../src/errors";
import { recordWatchProgress, toggleFavorite } from "../src/progress";

describe("playback helpers", () => {
  it("does not suggest a DRM bypass", () => {
    expect(classifyPlaybackError(new Error("Widevine license request failed"))).toEqual({
      kind: "drm",
      message: "This source requires the provider's approved playback experience.",
      retryable: false
    });
  });

  it("keeps favorites and recents locally ordered", () => {
    expect(toggleFavorite(["one"], "two")).toEqual(["one", "two"]);
    expect(toggleFavorite(["one", "two"], "one")).toEqual(["two"]);
    expect(recordWatchProgress([{ channelId: "one", positionSeconds: 1, watchedAt: "2026-01-01T00:00:00.000Z" }], {
      channelId: "one",
      positionSeconds: 30
    })[0]).toEqual(expect.objectContaining({ channelId: "one", positionSeconds: 30 }));
  });
});
