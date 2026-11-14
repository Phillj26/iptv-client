import { describe, expect, it } from "vitest";
import { nextFocusIndex } from "./focus";

describe("nextFocusIndex", () => {
  it("keeps remote navigation inside a row grid", () => {
    expect(nextFocusIndex(0, 8, 4, "ArrowLeft")).toBe(0);
    expect(nextFocusIndex(0, 8, 4, "ArrowRight")).toBe(1);
    expect(nextFocusIndex(1, 8, 4, "ArrowDown")).toBe(5);
    expect(nextFocusIndex(6, 8, 4, "ArrowDown")).toBe(7);
  });
});
