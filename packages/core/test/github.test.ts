import { describe, expect, it } from "vitest";
import { gitHubSourceFileKind, parseGitHubSourceUrl } from "../src/github";

describe("GitHub source URLs", () => {
  it("parses repository URLs", () => {
    expect(parseGitHubSourceUrl("https://github.com/OnlineM3U/publicdomainm3u")).toEqual({
      kind: "repository",
      owner: "OnlineM3U",
      repo: "publicdomainm3u"
    });
  });

  it("converts GitHub blob URLs to raw URLs", () => {
    expect(parseGitHubSourceUrl("https://github.com/example/playlists/blob/main/live/channels.m3u8")).toEqual(
      expect.objectContaining({
        kind: "file",
        owner: "example",
        repo: "playlists",
        ref: "main",
        path: "live/channels.m3u8",
        rawUrl: "https://raw.githubusercontent.com/example/playlists/main/live/channels.m3u8",
        sourceKind: "playlist"
      })
    );
  });

  it("rejects HTTP and unsupported file types", () => {
    expect(() => parseGitHubSourceUrl("http://github.com/example/playlists")).toThrow("HTTPS");
    expect(() => parseGitHubSourceUrl("https://github.com/example/playlists/blob/main/README.md")).toThrow("M3U");
  });

  it("classifies playlist and XMLTV paths", () => {
    expect(gitHubSourceFileKind("guide.xml")).toBe("guide");
    expect(gitHubSourceFileKind("country.M3U")).toBe("playlist");
    expect(gitHubSourceFileKind("image.png")).toBeUndefined();
  });
});
