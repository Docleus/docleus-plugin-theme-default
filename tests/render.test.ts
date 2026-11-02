import type { Context } from "@docleus/sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PLUGIN_NAME } from "../src/server/index.ts";
import {
  ASSET_DIR,
  doc,
  heading,
  loadPlugin,
  paragraph,
  sitePage,
  type Instance,
} from "./instance.ts";

const HEAD =
  '<script type="importmap">{"imports":{"react":"../../_assets/docleus/vendor/react.js"}}</script>' +
  '<script type="module" src="../../_assets/docleus/runtime.js"></script>';

describe("default theme", () => {
  let instance: Instance;

  beforeEach(async () => {
    instance = await loadPlugin();
  });

  afterEach(async () => {
    await instance.dispose();
  });

  const render = (page = sitePage("/guides/install/")): string =>
    instance.root.render.renderPage(page, { theme: PLUGIN_NAME, head: HEAD })
      .html;

  it("is the theme pages resolve to", () => {
    expect(instance.root.render.resolveTheme(PLUGIN_NAME)).toBe(PLUGIN_NAME);
    expect(instance.root.render.resolveTheme(undefined)).toBe(PLUGIN_NAME);
  });

  it("renders a representative page", () => {
    const page = sitePage("/guides/install/", {
      site: {
        id: "site1",
        name: "Acme Docs",
        settings: { accentColor: "#0a7d55", footerText: "Built with Docleus" },
      },
      entry: {
        id: "e3",
        type: "page",
        title: "Install",
        parent: "e2",
        order: 0,
        fields: {},
        body: doc(
          paragraph("Install the CLI."),
          heading(2, "Requirements"),
          paragraph("Node 24."),
          heading(3, "macOS"),
          heading(4, "Homebrew"),
          heading(2, "Next steps"),
        ),
      },
    });
    expect(render(page)).toMatchSnapshot();
  });

  it("renders the not-found page without a table of contents or pager", () => {
    const html = render(
      sitePage("/", {
        kind: "not-found",
        entry: undefined,
        title: "Page not found",
      }),
    );
    expect(html).toContain("<h1>Page not found</h1>");
    expect(html).toContain("<p>This page does not exist.</p>");
    expect(html).not.toContain("On this page");
    expect(html).not.toContain("Previous and next pages");
    expect(html).not.toContain('aria-current="page"');
  });

  it("nests the navigation and marks the current page", () => {
    const html = render();
    const nav = /<nav aria-label="Pages">(.*?)<\/nav>/s.exec(html)?.[1];
    expect(nav).toBe(
      "<ul>" +
        '<li><a href="../../">Introduction</a></li>' +
        '<li><a href="../../guides/">Guides</a><ul>' +
        '<li><a href="../../guides/install/" aria-current="page">Install</a></li>' +
        '<li><a href="../../guides/configure/">Configure</a></li>' +
        "</ul></li>" +
        '<li><a href="../../reference/">Reference</a></li>' +
        "</ul>",
    );
  });

  it("links the previous and next pages", () => {
    const html = render();
    expect(html).toContain(
      '<nav class="dt-pager" aria-label="Previous and next pages">' +
        '<a class="dt-pager-prev" rel="prev" href="../../guides/">',
    );
    expect(html).toContain(
      '<a class="dt-pager-next" rel="next" href="../../guides/configure/">',
    );
    const first = render(
      sitePage("/", {
        prev: undefined,
        next: { title: "Guides", path: "/guides/" },
      }),
    );
    expect(first).not.toContain("dt-pager-prev");
    expect(first).toContain('rel="next" href="./guides/"');
    const only = render(sitePage("/", { prev: undefined, next: undefined }));
    expect(only).not.toContain("dt-pager");
  });

  it("builds the table of contents from headings of depth 2 and 3", () => {
    const html = render(
      sitePage("/guides/install/", {
        entry: {
          id: "e3",
          type: "page",
          title: "Install",
          parent: "e2",
          order: 0,
          fields: {},
          body: doc(
            heading(1, "Title"),
            heading(2, "Usage"),
            heading(3, "Flags"),
            heading(4, "Deep"),
            heading(2, "Usage"),
          ),
        },
      }),
    );
    const toc = /<nav aria-label="On this page">(.*?)<\/nav>/s.exec(html)?.[1];
    expect(toc).toBe(
      '<p class="dt-toc-title">On this page</p><ul>' +
        '<li data-depth="2"><a href="#usage">Usage</a></li>' +
        '<li data-depth="3"><a href="#flags">Flags</a></li>' +
        '<li data-depth="2"><a href="#usage-2">Usage</a></li>' +
        "</ul>",
    );
  });

  it("omits the table of contents for a page without headings", () => {
    expect(render()).not.toContain("On this page");
  });

  it("escapes page titles, the site name and settings text", () => {
    const html = render(
      sitePage("/guides/install/", {
        title: '<script>alert("t")</script>',
        site: {
          id: "site1",
          name: "A & B <Docs>",
          settings: { footerText: "<b>f</b>", logoText: '"logo"' },
        },
        prev: { title: "<i>p</i>", path: "/guides/" },
      }),
    );
    expect(html).toContain(
      "<title>&lt;script&gt;alert(&quot;t&quot;)&lt;/script&gt; – A &amp; B &lt;Docs&gt;</title>",
    );
    expect(html).toContain(
      "<h1>&lt;script&gt;alert(&quot;t&quot;)&lt;/script&gt;</h1>",
    );
    expect(html).toContain("&quot;logo&quot;</a>");
    expect(html).toContain("<p>&lt;b&gt;f&lt;/b&gt;</p>");
    expect(html).toContain("&lt;i&gt;p&lt;/i&gt;");
    expect(html).not.toContain("<script>alert");
  });

  it("falls back to the default settings and warns about invalid ones", () => {
    const html = render(
      sitePage("/", {
        site: {
          id: "site1",
          name: "Acme Docs",
          settings: { accentColor: "url(x)", defaultMode: "dark" },
        },
      }),
    );
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("var m=null");
    expect(instance.warnings).toEqual([
      [
        'invalid theme settings for site "%s", using defaults: %s',
        "site1",
        "accentColor must be a color like #1a2b3c",
      ],
    ]);
  });

  it("puts the host head first, then the pre-paint script, then the stylesheet", () => {
    const html = render();
    const head = /<head>(.*)<\/head>/s.exec(html)?.[1] ?? "";
    const positions = [
      head.indexOf('<script type="importmap">'),
      head.indexOf(
        '<script type="module" src="../../_assets/docleus/runtime.js">',
      ),
      head.indexOf("<script>(function(){"),
      head.indexOf(
        `<link rel="stylesheet" href="../../${ASSET_DIR}theme.css">`,
      ),
    ];
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual(positions.toSorted((a, b) => a - b));
  });

  it("renders the items of every slot it exposes", async () => {
    const slots = [
      "site.head",
      "site.header",
      "site.sidebar",
      "site.page.header",
      "site.page.footer",
      "site.footer",
    ] as const;
    await instance.root.plugin({
      name: "test.slots",
      inject: ["render"],
      apply(ctx: Context) {
        for (const slot of slots) {
          ctx.render.registerSlot(slot, {
            id: "test",
            render: (page) => `<i data-slot="${slot}">${page.path}</i>`,
          });
        }
      },
    });
    const html = render();
    const positions = slots.map((slot) =>
      html.indexOf(`<i data-slot="${slot}">/guides/install/</i>`),
    );
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual(positions.toSorted((a, b) => a - b));
    expect(positions[0]).toBeLessThan(html.indexOf("</head>"));
  });

  it("unregisters the theme when the plugin unloads", async () => {
    await instance.unloadPlugin();
    expect(instance.root.render.resolveTheme(PLUGIN_NAME)).toBeUndefined();
    expect(render()).not.toContain("dt-layout");
  });
});
