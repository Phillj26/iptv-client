import assert from "node:assert/strict";
import test from "node:test";
import { loadManifest, validateManifest } from "./source-policy.mjs";

test("the checked-in source manifest complies with policy", async () => {
  const sources = validateManifest(await loadManifest(new URL("../sources/manifest.json", import.meta.url)));
  assert.equal(sources.some((source) => source.kind === "direct-stream"), false);
});

test("direct streams require documented provenance and HTTPS", () => {
  assert.throws(
    () => validateManifest({
      schemaVersion: 1,
      sources: [{
        id: "unsafe-stream",
        name: "Unsafe stream",
        kind: "direct-stream",
        categories: ["live-tv"],
        access: "free-official",
        provenanceUrl: "http://example.test",
        rightsNotes: "This intentionally lacks sufficient provenance and is rejected.",
        availabilityNotes: "This intentionally lacks sufficient availability details and is rejected.",
        validation: { validatedAt: "2026-11-05", method: "This test demonstrates policy rejection for unsafe direct entries." }
      }]
    }),
    /HTTPS provenance/
  );
});
