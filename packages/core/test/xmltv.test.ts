import { describe, expect, it } from "vitest";
import { parseXmlTv, programmeWindowForChannel, programmesForChannel } from "../src/xmltv";

describe("parseXmlTv", () => {
  it("reads channels and programmes with timezone offsets", () => {
    const guide = parseXmlTv(`<?xml version="1.0"?><tv>
      <channel id="station.local"><display-name>Station Local</display-name><icon src="https://images.example/logo.png"/></channel>
      <programme channel="station.local" start="20261105080000 -0500" stop="20261105090000 -0500"><title>Morning News</title><desc>Local &amp; regional news.</desc></programme>
    </tv>`);

    expect(guide.channels).toEqual([expect.objectContaining({ id: "station.local", displayName: "Station Local" })]);
    expect(programmesForChannel(guide.programmes, "station.local")[0]).toEqual(
      expect.objectContaining({ title: "Morning News", description: "Local & regional news." })
    );
  });

  it("selects the current and next programmes for a channel", () => {
    const guide = parseXmlTv(`<?xml version="1.0"?><tv>
      <programme channel="station.local" start="20261105120000 Z" stop="20261105130000 Z"><title>News at Noon</title></programme>
      <programme channel="station.local" start="20261105130000 Z" stop="20261105140000 Z"><title>Afternoon Report</title></programme>
    </tv>`);

    expect(programmeWindowForChannel(guide.programmes, "station.local", new Date("2026-11-05T12:30:00Z"))).toEqual({
      current: expect.objectContaining({ title: "News at Noon" }),
      next: expect.objectContaining({ title: "Afternoon Report" })
    });
  });
});
