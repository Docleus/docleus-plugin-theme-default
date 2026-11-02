// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY } from "../shared/constants.ts";
import { setupThemeToggle } from "./toggle.ts";

const BUTTON =
  '<button type="button" data-theme-toggle aria-pressed="false" hidden></button>';

/** Makes `matchMedia` report `matches`; the returned function changes it. */
function mockSystemDark(matches: boolean): (matches: boolean) => void {
  const listeners: (() => void)[] = [];
  const query = {
    matches,
    addEventListener: (_type: string, listener: () => void) => {
      listeners.push(listener);
    },
  };
  vi.spyOn(window, "matchMedia").mockImplementation(
    () => query as unknown as MediaQueryList,
  );
  return (next) => {
    query.matches = next;
    for (const listener of listeners) listener();
  };
}

const button = (): HTMLButtonElement => {
  const element = document.querySelector("button");
  if (!element) throw new Error("no button");
  return element;
};

describe("setupThemeToggle", () => {
  beforeEach(() => {
    document.body.innerHTML = BUTTON;
    delete document.documentElement.dataset.theme;
    localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the button and follows the system preference when nothing is set", () => {
    mockSystemDark(true);
    setupThemeToggle(document);
    expect(button().hidden).toBe(false);
    expect(button().getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("follows a change of the system preference until the visitor chooses", () => {
    const change = mockSystemDark(false);
    setupThemeToggle(document);
    change(true);
    expect(button().getAttribute("aria-pressed")).toBe("true");
    button().click();
    change(true);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(button().getAttribute("aria-pressed")).toBe("false");
  });

  it("toggles between light and dark and remembers the choice", () => {
    mockSystemDark(false);
    setupThemeToggle(document);
    expect(button().getAttribute("aria-pressed")).toBe("false");

    button().click();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(button().getAttribute("aria-pressed")).toBe("true");

    button().click();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(button().getAttribute("aria-pressed")).toBe("false");
  });

  it("starts from the mode the pre-paint script set", () => {
    mockSystemDark(true);
    document.documentElement.dataset.theme = "light";
    setupThemeToggle(document);
    expect(button().getAttribute("aria-pressed")).toBe("false");
    button().click();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("keeps working when storage throws", () => {
    mockSystemDark(false);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    setupThemeToggle(document);
    button().click();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("does nothing without a toggle button", () => {
    document.body.innerHTML = "";
    expect(() => setupThemeToggle(document)).not.toThrow();
  });
});
