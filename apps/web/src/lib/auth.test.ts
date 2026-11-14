import { beforeEach, describe, expect, it } from "vitest";
import { clearSession, isAuthConfigured, loadSession, saveSession, signIn, type AuthSession } from "./auth";

const session: AuthSession = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: 1_800_000_000_000,
  user: { id: "user-1", email: "viewer@example.com" }
};

describe("auth session adapter", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips valid sessions and clears them", () => {
    saveSession(session);
    expect(loadSession()).toEqual(session);
    clearSession();
    expect(loadSession()).toBeUndefined();
  });

  it("ignores malformed persisted sessions", () => {
    window.localStorage.setItem("streamline-auth-v1", JSON.stringify({ accessToken: "only-a-token" }));
    expect(loadSession()).toBeUndefined();
  });

  it("fails clearly when a build has no authentication configuration", async () => {
    expect(isAuthConfigured()).toBe(false);
    await expect(signIn("viewer@example.com", "password123")).rejects.toThrow(/not configured/);
  });
});
