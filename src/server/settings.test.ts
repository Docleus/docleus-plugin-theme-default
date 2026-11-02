import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseThemeSettings } from "./settings.ts";

describe("parseThemeSettings", () => {
  it("uses the defaults when nothing is stored", () => {
    expect(parseThemeSettings(undefined)).toEqual({
      isValid: true,
      settings: DEFAULT_SETTINGS,
    });
    expect(parseThemeSettings(null).settings).toEqual({
      defaultMode: "system",
    });
  });

  it("keeps valid settings and ignores unknown keys", () => {
    expect(
      parseThemeSettings({
        accentColor: "#AbC123",
        logoText: "Acme Docs",
        footerText: "",
        defaultMode: "dark",
        extra: 1,
      }),
    ).toEqual({
      isValid: true,
      settings: {
        accentColor: "#AbC123",
        logoText: "Acme Docs",
        footerText: "",
        defaultMode: "dark",
      },
    });
  });

  it.each([
    ["a non-object", "dark"],
    ["an array", []],
    ["a short color", { accentColor: "#abc" }],
    ["a color with CSS in it", { accentColor: "#abcdef; color: red" }],
    ["an empty logo", { logoText: " " }],
    ["a non-string footer", { footerText: 3 }],
    ["an unknown mode", { defaultMode: "sepia" }],
  ])("falls back to the defaults for %s", (_name, value) => {
    const result = parseThemeSettings(value);
    expect(result.isValid).toBe(false);
    expect(result.settings).toBe(DEFAULT_SETTINGS);
  });

  it("reports every problem", () => {
    const result = parseThemeSettings({ accentColor: 1, defaultMode: 2 });
    expect(result.isValid ? [] : result.issues).toEqual([
      "accentColor must be a color like #1a2b3c",
      'defaultMode must be "system", "light" or "dark"',
    ]);
  });
});
