import { describe, expect, it } from "vitest";
import { parseM3u, redactUrl, validateRemotePlaylistUrl } from "../src/m3u";

describe("parseM3u", () => {
  it("normalizes channels and preserves playlist metadata", () => {
    const playlist = parseM3u(
      `#EXTM3U\n#EXTINF:-1 tvg-id="nasa.us" tvg-logo="https://images.example/nasa.png" group-title="Science",NASA Live\nhttps://stream.example/live.m3u8`,
      { sourceId: "authorized-provider", name: "My playlist" }
    );

    expect(playlist.warnings).toEqual([]);
    expect(playlist.channels).toEqual([
      expect.objectContaining({
        name: "NASA Live",
        tvgId: "nasa.us",
        groupTitle: "Science",
        streamUrl: "https://stream.example/live.m3u8",
        primaryCategory: "live-tv"
      })
    ]);
  });

  it("does not accept unsupported transport URLs", () => {
    const playlist = parseM3u(
      `#EXTM3U\n#EXTINF:-1 group-title="Sports",Unverified stream\nrtsp://example.test/stream`,
      { sourceId: "test" }
    );

    expect(playlist.channels).toEqual([]);
    expect(playlist.warnings[0]?.message).toContain("non-HTTP(S)");
  });

  it("requires HTTPS for remote playlist imports", () => {
    expect(() => validateRemotePlaylistUrl("http://example.test/playlist.m3u")).toThrow("HTTPS");
    expect(validateRemotePlaylistUrl("https://example.test/playlist.m3u").hostname).toBe("example.test");
  });

  it("redacts credential-looking query parameters", () => {
    expect(redactUrl("https://provider.example/live.m3u8?token=private&quality=hd")).toContain("token=redacted");
  });
});
