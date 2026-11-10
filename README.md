<p align="center">
  <a href="https://docleus.io"><img src="./.github/assets/docleus.svg" width="88" alt="Docleus logo" /></a>
</p>

<h1 align="center">Default Theme</h1>

<p align="center">
  <strong>Give your documentation a place to live.</strong><br />
  Navigation, page outlines, dark mode, and a responsive published site.
</p>

<p align="center">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" /></a>
  <img alt="Public preview in preparation" src="https://img.shields.io/badge/preview-0.0.9-cfcfcf?style=flat-square" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square" />
  <a href="https://docleus.io"><img alt="Online documentation" src="https://img.shields.io/badge/docs-docleus.io-111111?style=flat-square" /></a>
</p>

<p align="center">
  <a href="https://docleus.io">Documentation</a> &middot;
  <a href="#settings">Settings</a> &middot;
  <a href="https://github.com/Docleus/docleus">Run Docleus</a> &middot;
  <a href="https://github.com/Docleus/.github/blob/main/CONTRIBUTING.md">Contribute</a>
</p>

---

Default site theme for Docleus: a header, a page tree sidebar, the page body with previous and next links, a table of contents, a footer, and dark mode.

## Entries

- `server`: the plugin. It needs the `render` service and registers the theme as `@docleus/plugin-theme-default`. It is undone when the plugin unloads. Also exports `createTheme({ logger })` and `parseThemeSettings(value)`.
- `site`: a plain browser module, loaded on every published page, that wires the dark-mode toggle. It loads no React. `dist/site/theme.css` is the stylesheet the layout links.

## Settings

The theme reads its settings for the site's first space (`page.site.settings`):

| Setting       | Type                              | Default    |
| ------------- | --------------------------------- | ---------- |
| `accentColor` | `#rrggbb`                         | theme blue |
| `logoText`    | non-empty string                  | site name  |
| `footerText`  | string                            | none       |
| `defaultMode` | `"system"`, `"light"` or `"dark"` | `"system"` |

Unknown keys are ignored. When any setting is invalid, the theme uses the defaults for all of them and logs a warning once per site and problem. The accent color is used as given in light mode. In dark mode it is used as given when it reaches a WCAG AA contrast of 4.5:1 against the dark background; otherwise the theme raises its lightness, keeping hue and saturation, by the smallest step that does. The layout writes both as `--dt-accent-light` and `--dt-accent-dark` on `<html>`.

## Layout

Every page is a complete HTML document. Text is escaped; the host head, slot items and the rendered body are trusted HTML. `<head>` holds, in order: charset, viewport, `<title>` (`Page – Site`, or just the site name for a page named like the site), the host head (import map, site runtime, island props, the `site.head` slot), the pre-paint script, the sidebar script, and the stylesheet.

The body has a skip link to `<main id="main">`, then:

- a header with the sidebar toggle, the logo text linking to the site root, the `site.header` slot and the dark-mode toggle;
- a sidebar (`<aside id="dt-sidebar">`) with `<nav aria-label="Pages">` (the nested page tree, `aria-current="page"` on the current page) and the `site.sidebar` slot;
- the main column: the page title, the `site.page.header` slot, the body in `<article>`, the `site.page.footer` slot, and `<nav aria-label="Previous and next pages">`;
- `<nav aria-label="On this page">` with the page's headings of depth 2 and 3, omitted when there are none;
- a footer with the footer text and the `site.footer` slot.

The not-found page has no table of contents and no previous and next links. On wide screens the sidebar, content and table of contents are columns; the table of contents hides below 75rem and the sidebar moves above the content below 48rem.

## Sidebar on narrow screens

Below 48rem the sidebar is collapsed behind the toggle button (`aria-label="Pages"`, `aria-controls="dt-sidebar"`, `aria-expanded`) at the start of the header. An inline script in `<head>` closes it before the first paint and handles the toggle; Escape closes an open sidebar and returns focus to the toggle. The script is inline so that it also runs in a static export opened from disk. Without JavaScript the sidebar is always shown and the toggle hidden.

## Dark mode

- An inline script in `<head>` runs before the first paint and sets `<html data-theme>` from `localStorage["docleus-theme"]` (`light` or `dark`), else from `defaultMode` when it is not `system`.
- Without `data-theme` the stylesheet follows `prefers-color-scheme`.
- The toggle button is hidden until the site module wires it, so pages without JavaScript show no dead control. Clicking it switches between light and dark, stores the choice, and updates `aria-pressed`. Without storage the choice lasts for the current page.

Everything works the same on instance-served sites and static exports; nothing needs the server.

## Testing

Unit and render snapshot tests run with `pnpm test`. The Playwright tests in `tests/e2e` build core, docleus-plugin-editor, docleus-plugin-blocks-commonmark, docleus-plugin-template and this theme, then start `docleus serve --dev` on port 4329 with a temporary data directory. They publish a site through the space settings and check navigation, the table of contents, dark mode, the template counter island, the not-found page, rollback, and `docleus export`:

```bash
pnpm exec playwright install chromium
pnpm e2e
```

## Development

Use Node.js 24 and pnpm 11.21.0. Keep this repository next to `docleus-core`
with its original directory name; the `link:` development dependencies need
that layout. Install core before this repository:

```sh
pnpm --dir ../docleus-core install --frozen-lockfile
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

`pnpm check` runs typecheck, lint, formatting, dependency boundaries, licenses,
and unit/in-process integration tests. Browser and external-service tests,
where provided, are separate and need the sibling repositories listed in
their setup files. The SDK is a host-provided peer dependency; packages remain
private and are not installed from npm. All extension points are experimental
before 1.0.

## Community

[Contributing](https://github.com/Docleus/.github/blob/main/CONTRIBUTING.md) &middot;
[Code of conduct](https://github.com/Docleus/.github/blob/main/CODE_OF_CONDUCT.md) &middot;
[Security](https://github.com/Docleus/.github/blob/main/SECURITY.md) &middot;
[Support](https://github.com/Docleus/.github/blob/main/SUPPORT.md)

## License

[MIT](LICENSE)

## Compatibility

Version `0.0.9` supports Docleus core and SDK `0.0.1`, `0.0.2`, `0.0.3`, `0.0.4`, `0.0.5`, `0.0.6`, `0.0.7`, `0.0.8` and `0.0.9` through
the matching `>=0.0.1 <0.0.10` manifest and SDK peer ranges.
