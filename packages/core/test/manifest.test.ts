import { describe, expect, it } from "vitest";
import { parseSourceManifest, validateSourceManifest } from "../src/manifest";

const validSource = {
  id: "local-news",
  name: "Local news provider",
  kind: "official-link",
  categories: ["local", "news"],
  access: "free-official",
  providerUrl: "https://provider.example/",
  regions: ["US"],
  provenanceUrl: "https://provider.example/about",
  rightsNotes: "The rights holder operates this official provider page.",
  availabilityNotes: "Availability depends on the provider and viewer region.",
  validation: {
    validatedAt: "2026-11-14",
    method: "Reviewed the provider's official page and access terms."
  }
};

describe("source manifest", () => {
  it("accepts official regional provider handoffs", () => {
    expect(validateSourceManifest({ schemaVersion: 1, sources: [validSource] })).toEqual([validSource]);
    expect(parseSourceManifest({ schemaVersion: 1, updatedAt: "2026-11-14T00:00:00Z", sources: [validSource] }).updatedAt).toBe("2026-11-14T00:00:00Z");
  });

  it("rejects malformed or non-HTTPS remote catalog entries", () => {
    expect(() => validateSourceManifest({ schemaVersion: 1, sources: [{ ...validSource, providerUrl: "http://provider.example/" }] })).toThrow();
    expect(() => validateSourceManifest({ schemaVersion: 1, sources: [{ ...validSource, categories: ["unknown"] }] })).toThrow();
    expect(() => parseSourceManifest({ schemaVersion: 1, updatedAt: "not-a-date", sources: [validSource] })).toThrow();
  });
});
