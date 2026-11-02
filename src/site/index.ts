import { setupThemeToggle } from "./toggle.ts";

export { setupThemeToggle } from "./toggle.ts";

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => setupThemeToggle(document),
      { once: true },
    );
  } else {
    setupThemeToggle(document);
  }
}
