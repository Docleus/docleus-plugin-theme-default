import type { RenderResult, SiteLayoutInput, SitePage } from "@docleus/sdk";
import { describe, expect, it, vi } from "vitest";
import { createTheme } from "./layout.ts";

const page = (overrides: Partial<SitePage> = {}): SitePage => ({
  kind: "page",
  site: { id: "s1", name: "Docs", settings: undefined },
  space: { id: "sp1", orgId: "o1", slug: "docs", name: "Docs" },
  revision: "r1",
  entry: undefined,
  path: "/guide/",
  title: "Guide",
  nav: [],
  prev: undefined,
  next: undefined,
  url: (path) => `..${path}`,
  asset: (_plugin, file) => `../_assets/${file}`,
  ...overrides,
});

const input = (
  sitePage: SitePage,
  body: RenderResult = { html: "<p>Body</p>", islands: [] },
): SiteLayoutInput => ({
  page: sitePage,
  body,
  head: "<!-- head -->",
  slot: (name) => `<!-- ${name} -->`,
});

const layout = (sitePage: SitePage, body?: RenderResult): string =>
  createTheme({ logger: { warn: () => {} } }).layout(input(sitePage, body));

describe("createTheme", () => {
  it("renders every slot in its place", () => {
    const html = layout(page());
    const order = [
      "<!-- site.header -->",
      "<!-- site.sidebar -->",
      "<h1>Guide</h1>",
      "<!-- site.page.header -->",
      '<article class="dt-content"><p>Body</p></article>',
      "<!-- site.page.footer -->",
      "<!-- site.footer -->",
    ].map((part) => html.indexOf(part));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual(order.toSorted((a, b) => a - b));
  });

  it("does not repeat the site name in the title of a page named like the site", () => {
    expect(layout(page({ title: "Docs" }))).toContain("<title>Docs</title>");
    expect(layout(page())).toContain("<title>Guide – Docs</title>");
  });

  it("uses the logo text, footer text and accent color from the settings", () => {
    const html = layout(
      page({
        site: {
          id: "s1",
          name: "Docs",
          settings: {
            logoText: "Acme",
            footerText: "© Acme",
            accentColor: "#112233",
          },
        },
      }),
    );
    expect(html).toContain('<a class="dt-logo" href="../">Acme</a>');
    expect(html).toContain('<footer class="dt-footer"><p>© Acme</p>');
    expect(html).toContain(
      '<html lang="en" style="--dt-accent-light: #112233; --dt-accent-dark: #4583c1">',
    );
  });

  it("keeps an accent that reads well on the dark background for dark mode", () => {
    const html = layout(
      page({
        site: { id: "s1", name: "Docs", settings: { accentColor: "#FFB000" } },
      }),
    );
    expect(html).toContain(
      'style="--dt-accent-light: #FFB000; --dt-accent-dark: #ffb000"',
    );
  });

  it("renders a sidebar toggle that controls the sidebar", () => {
    const html = layout(page());
    expect(html).toContain(
      '<header class="dt-header"><button type="button" class="dt-sidebar-toggle" data-sidebar-toggle aria-controls="dt-sidebar" aria-expanded="false" aria-label="Pages">',
    );
    expect(html).toContain('<aside id="dt-sidebar" class="dt-sidebar">');
    expect(html).toMatch(
      /<script>\(function\(\)\{var r=document\.documentElement;r\.dataset\.sidebar="closed"/,
    );
  });

  it("embeds a non-system default mode in the pre-paint script", () => {
    const dark = page({
      site: { id: "s1", name: "Docs", settings: { defaultMode: "dark" } },
    });
    expect(layout(dark)).toContain('var m="dark"');
    expect(layout(page())).toContain("var m=null");
  });

  it("warns once per site and problem about invalid settings", () => {
    const warn = vi.fn();
    const theme = createTheme({ logger: { warn } });
    const broken = page({
      site: { id: "s1", name: "Docs", settings: { accentColor: "red" } },
    });
    const html = theme.layout(input(broken));
    theme.layout(input(broken));
    expect(html).toContain('<html lang="en">');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.slice(1)).toEqual([
      "s1",
      "accentColor must be a color like #1a2b3c",
    ]);
  });

  it("orders the table of contents and keeps only depths 2 and 3", () => {
    const html = layout(page(), {
      html: "",
      islands: [],
      outline: [
        { anchor: "top", depth: 1, text: "Top" },
        { anchor: "a", depth: 2, text: "A" },
        { anchor: "b", depth: 3, text: "B" },
        { anchor: "c", depth: 4, text: "C" },
      ],
    });
    expect(html).toContain(
      '<ul><li data-depth="2"><a href="#a">A</a></li><li data-depth="3"><a href="#b">B</a></li></ul>',
    );
    expect(html).toContain('class="dt-layout dt-has-toc"');
  });

  it("omits the table of contents when no heading qualifies", () => {
    const html = layout(page(), {
      html: "",
      islands: [],
      outline: [{ anchor: "x", depth: 4, text: "X" }],
    });
    expect(html).not.toContain("On this page");
    expect(html).toContain('<div class="dt-layout">');
  });
});
