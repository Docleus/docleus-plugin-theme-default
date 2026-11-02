import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  DARK_BACKGROUND,
  darkModeAccent,
  MIN_CONTRAST,
} from "./contrast.ts";

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#ffffff", "#777777")).toBeCloseTo(4.48, 2);
  });
});

describe("darkModeAccent", () => {
  it("keeps an accent that already reads well on the dark background", () => {
    expect(darkModeAccent("#7AA2FF")).toBe("#7aa2ff");
  });

  it.each(["#2557d6", "#0a7d55", "#8b0000", "#000000", "#123456", "#800080"])(
    "lightens %s just enough to reach AA on the dark background",
    (accent) => {
      expect(contrastRatio(accent, DARK_BACKGROUND)).toBeLessThan(MIN_CONTRAST);
      const dark = darkModeAccent(accent);
      expect(dark).toMatch(/^#[0-9a-f]{6}$/);
      expect(contrastRatio(dark, DARK_BACKGROUND)).toBeGreaterThanOrEqual(
        MIN_CONTRAST,
      );
      // One step less light would not do.
      expect(contrastRatio(dark, DARK_BACKGROUND)).toBeLessThan(
        MIN_CONTRAST + 1,
      );
    },
  );

  it("keeps the hue of a colored accent", () => {
    const dark = darkModeAccent("#0a7d55");
    const [r, g, b] = [1, 3, 5].map((i) =>
      Number.parseInt(dark.slice(i, i + 2), 16),
    );
    expect(g).toBeGreaterThan(b ?? 0);
    expect(b).toBeGreaterThan(r ?? 0);
  });
});
