import {
  escapeHtml,
  escapeScriptJson,
  type OutlineItem,
  type SiteLayoutInput,
  type SiteNavItem,
  type SiteNavLink,
  type SitePage,
  type SiteTheme,
} from "@docleus/sdk";
import {
  PLUGIN_NAME,
  SIDEBAR_ID,
  SIDEBAR_TOGGLE_ATTRIBUTE,
  THEME_STORAGE_KEY,
  TOGGLE_ATTRIBUTE,
} from "../shared/constants.ts";
import { darkModeAccent } from "./contrast.ts";
import { parseThemeSettings, type ThemeSettings } from "./settings.ts";
import { SIDEBAR_SCRIPT } from "./sidebar.ts";

export interface ThemeLogger {
  warn(format: string, ...args: unknown[]): void;
}

export interface ThemeOptions {
  /** Receives a warning when a site's settings are invalid. */
  readonly logger: ThemeLogger;
}

const STYLESHEET = "dist/site/theme.css";
const TOC_DEPTHS: ReadonlySet<number> = new Set([2, 3]);

function documentTitle(page: SitePage): string {
  const { title } = page;
  const site = page.site.name;
  return title === site
    ? escapeHtml(title)
    : `${escapeHtml(title)} – ${escapeHtml(site)}`;
}

/**
 * Sets the color mode before the first paint, so a dark page never
 * flashes light. It must stay inline; a module script would run too late.
 */
function prePaintScript(settings: ThemeSettings): string {
  const fallback =
    settings.defaultMode === "system" ? null : settings.defaultMode;
  return (
    `<script>(function(){var m=${escapeScriptJson(fallback)};` +
    `try{var s=localStorage.getItem(${escapeScriptJson(THEME_STORAGE_KEY)});if(s==="light"||s==="dark")m=s}catch(e){}` +
    `if(m)document.documentElement.dataset.theme=m})()</script>`
  );
}

function navList(
  items: readonly SiteNavItem[],
  page: SitePage,
  current: string | undefined,
): string {
  if (items.length === 0) return "";
  const rows = items.map((item) => {
    const isCurrent = item.path === current;
    return (
      `<li><a href="${escapeHtml(page.url(item.path))}"${isCurrent ? ' aria-current="page"' : ""}>` +
      `${escapeHtml(item.title)}</a>${navList(item.children, page, current)}</li>`
    );
  });
  return `<ul>${rows.join("")}</ul>`;
}

function pagerLink(
  page: SitePage,
  link: SiteNavLink | undefined,
  rel: "prev" | "next",
): string {
  if (!link) return "";
  const label = rel === "prev" ? "Previous" : "Next";
  return (
    `<a class="dt-pager-${rel}" rel="${rel}" href="${escapeHtml(page.url(link.path))}">` +
    `<span class="dt-pager-label">${label}</span>` +
    `<span class="dt-pager-title">${escapeHtml(link.title)}</span></a>`
  );
}

function pager(page: SitePage): string {
  if (!page.prev && !page.next) return "";
  return (
    `<nav class="dt-pager" aria-label="Previous and next pages">` +
    `${pagerLink(page, page.prev, "prev")}${pagerLink(page, page.next, "next")}</nav>`
  );
}

function tableOfContents(outline: readonly OutlineItem[]): string {
  const items = outline.filter((item) => TOC_DEPTHS.has(item.depth));
  if (items.length === 0) return "";
  const rows = items.map(
    (item) =>
      `<li data-depth="${item.depth}"><a href="#${escapeHtml(item.anchor)}">${escapeHtml(item.text)}</a></li>`,
  );
  return (
    `<aside class="dt-toc"><nav aria-label="On this page">` +
    `<p class="dt-toc-title">On this page</p><ul>${rows.join("")}</ul></nav></aside>`
  );
}

const TOGGLE_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' +
  '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>' +
  '<path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>';

// Hidden until the site script wires it up, so visitors without JavaScript
// never see a button that does nothing.
const TOGGLE_BUTTON =
  `<button type="button" class="dt-theme-toggle" ${TOGGLE_ATTRIBUTE} ` +
  `aria-label="Dark mode" aria-pressed="false" hidden>${TOGGLE_ICON}</button>`;

const MENU_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' +
  '<path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

// The stylesheet shows it only on narrow screens and once the sidebar script
// has run.
const SIDEBAR_TOGGLE =
  `<button type="button" class="dt-sidebar-toggle" ${SIDEBAR_TOGGLE_ATTRIBUTE} ` +
  `aria-controls="${SIDEBAR_ID}" aria-expanded="false" aria-label="Pages">${MENU_ICON}</button>`;

/**
 * The accent as custom properties for each mode, rather than `--dt-accent`
 * itself, which as an inline style would beat the stylesheet's dark mode.
 */
function accentStyle(settings: ThemeSettings): string {
  const accent = settings.accentColor;
  if (accent === undefined) return "";
  const style = `--dt-accent-light: ${accent}; --dt-accent-dark: ${darkModeAccent(accent)}`;
  return ` style="${escapeHtml(style)}"`;
}

/**
 * The default site theme. Settings come from `page.site.settings`; when
 * they are invalid the theme uses its defaults and warns once per site and
 * problem.
 */
export function createTheme({ logger }: ThemeOptions): SiteTheme {
  const warned = new Set<string>();

  function settingsOf(page: SitePage): ThemeSettings {
    const result = parseThemeSettings(page.site.settings);
    if (result.isValid) return result.settings;
    const issues = result.issues.join("; ");
    const key = `${page.site.id}\u0000${issues}`;
    if (!warned.has(key)) {
      warned.add(key);
      logger.warn(
        'invalid theme settings for site "%s", using defaults: %s',
        page.site.id,
        issues,
      );
    }
    return result.settings;
  }

  return {
    layout({ page, body, head, slot }: SiteLayoutInput): string {
      const settings = settingsOf(page);
      const isPage = page.kind === "page";
      const accent = accentStyle(settings);
      const toc = isPage ? tableOfContents(body.outline ?? []) : "";
      const footerText = settings.footerText
        ? `<p>${escapeHtml(settings.footerText)}</p>`
        : "";
      return [
        `<!doctype html>`,
        `<html lang="en"${accent}>`,
        `<head>`,
        `<meta charset="utf-8">`,
        `<meta name="viewport" content="width=device-width, initial-scale=1">`,
        `<title>${documentTitle(page)}</title>`,
        head,
        prePaintScript(settings),
        `<script>${SIDEBAR_SCRIPT}</script>`,
        `<link rel="stylesheet" href="${escapeHtml(page.asset(PLUGIN_NAME, STYLESHEET))}">`,
        `</head>`,
        `<body>`,
        `<a class="dt-skip-link" href="#main">Skip to content</a>`,
        `<header class="dt-header">${SIDEBAR_TOGGLE}` +
          `<a class="dt-logo" href="${escapeHtml(page.url("/"))}">${escapeHtml(settings.logoText ?? page.site.name)}</a>` +
          `${slot("site.header")}${TOGGLE_BUTTON}</header>`,
        `<div class="dt-layout${toc ? " dt-has-toc" : ""}">`,
        `<aside id="${SIDEBAR_ID}" class="dt-sidebar"><nav aria-label="Pages">${navList(page.nav, page, isPage ? page.path : undefined)}</nav>${slot("site.sidebar")}</aside>`,
        `<main id="main" class="dt-main">`,
        `<h1>${escapeHtml(page.title)}</h1>`,
        slot("site.page.header"),
        `<article class="dt-content">${body.html}</article>`,
        slot("site.page.footer"),
        isPage ? pager(page) : "",
        `</main>`,
        toc,
        `</div>`,
        `<footer class="dt-footer">${footerText}${slot("site.footer")}</footer>`,
        `</body>`,
        `</html>`,
      ]
        .filter((part) => part !== "")
        .join("\n");
    },
  };
}
