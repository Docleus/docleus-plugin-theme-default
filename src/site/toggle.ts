import { THEME_STORAGE_KEY, TOGGLE_ATTRIBUTE } from "../shared/constants.ts";

type Mode = "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function readStored(storage: Storage | undefined): Mode | undefined {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : undefined;
  } catch {
    // Storage can throw when it is disabled; the page then follows the system.
    return undefined;
  }
}

function store(storage: Storage | undefined, mode: Mode): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Without storage the choice lasts for this page only, which is fine.
  }
}

function storageOf(view: Window): Storage | undefined {
  try {
    return view.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Wires the dark-mode toggle of the default theme. The mode the pre-paint
 * script put on `<html data-theme>` wins; without one, the system
 * preference decides. Does nothing when the page has no toggle.
 */
export function setupThemeToggle(doc: Document): void {
  const view = doc.defaultView;
  const button = doc.querySelector<HTMLButtonElement>(
    `button[${TOGGLE_ATTRIBUTE}]`,
  );
  if (!view || !button) return;
  const root = doc.documentElement;
  const storage = storageOf(view);
  const media =
    typeof view.matchMedia === "function"
      ? view.matchMedia(DARK_QUERY)
      : undefined;

  const current = (): Mode => {
    const chosen = root.dataset.theme;
    if (chosen === "light" || chosen === "dark") return chosen;
    return readStored(storage) ?? (media?.matches ? "dark" : "light");
  };
  const sync = (): void => {
    button.setAttribute("aria-pressed", String(current() === "dark"));
  };

  button.addEventListener("click", () => {
    const next: Mode = current() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    store(storage, next);
    sync();
  });
  media?.addEventListener("change", sync);
  button.hidden = false;
  sync();
}
