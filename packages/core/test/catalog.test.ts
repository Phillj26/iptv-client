import { describe, expect, it } from "vitest";
import { categorizeChannel, channelsForCategory, searchChannels } from "../src/catalog";
import type { Channel } from "../src/types";

const channel: Channel = {
  id: "provider:1",
  name: "City Sports",
  streamUrl: "https://provider.example/sports.m3u8",
  sourceId: "provider",
  categories: ["sports"],
  primaryCategory: "sports"
};

describe("catalog", () => {
  it("adds the right browsing labels without granting content access", () => {
    expect(categorizeChannel("Premium Sports", "City Sports")).toEqual(["premium", "sports"]);
    expect(categorizeChannel("", "Untitled")).toEqual(["live-tv"]);
  });

  it("searches names, guide ids, and group labels", () => {
    expect(searchChannels([channel], "sports")).toEqual([channel]);
    expect(searchChannels([channel], "news")).toEqual([]);
    expect(channelsForCategory([channel], "sports")).toEqual([channel]);
  });
});
