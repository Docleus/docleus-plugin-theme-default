import { readFileSync } from "node:fs";
import { createRenderService } from "@docleus/core-render";
import {
  Context,
  parseManifest,
  type BlockNode,
  type SiteNavItem,
  type SitePage,
} from "@docleus/sdk";
import { plugin } from "../src/server/index.ts";

const manifest = parseManifest(
  JSON.parse(
    readFileSync(new URL("../docleus.plugin.json", import.meta.url), "utf8"),
  ),
);

/** The directory of this plugin's assets in a published site. */
export const ASSET_DIR = `_assets/plugins/docleus-plugin-theme-default@${manifest.version}/`;

export interface Instance {
  readonly root: Context;
  /** The arguments of every warning logged. */
  readonly warnings: unknown[][];
  unloadPlugin(): Promise<void>;
  dispose(): Promise<void>;
}

/**
 * Loads the real render service, renderers for `test.doc`, `test.heading`
 * and `test.paragraph`, and this plugin into a fresh context.
 */
export async function loadPlugin(): Promise<Instance> {
  const root = new Context();
  const warnings: unknown[][] = [];
  root.logger.exporter({
    export: (message) => {
      if (message.type === "warn") {
        warnings.push(message.args);
      }
    },
  });
  const core = await root.plugin((ctx: Context) => {
    ctx.provide("render", createRenderService(ctx));
  });
  const blocks = await root.plugin({
    name: "test.blocks",
    inject: ["render"],
    apply(ctx: Context) {
      ctx.render.registerBlock("test.doc", (node, context) =>
        context.children(node),
      );
      ctx.render.registerBlock("test.heading", (node, context) => {
        const depth =
          typeof node.attrs.depth === "number" ? node.attrs.depth : 2;
        const text = typeof node.attrs.text === "string" ? node.attrs.text : "";
        const anchor = context.anchor(text);
        return {
          html: `<h${depth} id="${anchor}">${text}</h${depth}>`,
          islands: [],
          outline: [{ anchor, depth, text }],
        };
      });
      ctx.render.registerBlock("test.paragraph", (node) => ({
        html: `<p>${typeof node.attrs.text === "string" ? node.attrs.text : ""}</p>`,
        islands: [],
      }));
    },
  });
  const fiber = await root.plugin(plugin);
  return {
    root,
    warnings,
    unloadPlugin: () => fiber.dispose(),
    async dispose() {
      await fiber.dispose();
      await blocks.dispose();
      await core.dispose();
    },
  };
}

let nextId = 0;
const block = (
  type: string,
  attrs: Record<string, unknown> = {},
): BlockNode => ({
  id: `b${++nextId}`,
  type,
  v: 1,
  attrs,
});

export const heading = (depth: number, text: string): BlockNode =>
  block("test.heading", { depth, text });

export const paragraph = (text: string): BlockNode =>
  block("test.paragraph", { text });

export const doc = (...content: BlockNode[]): BlockNode => ({
  ...block("test.doc"),
  content,
});

export const NAV: readonly SiteNavItem[] = [
  { entryId: "e1", title: "Introduction", path: "/", children: [] },
  {
    entryId: "e2",
    title: "Guides",
    path: "/guides/",
    children: [
      {
        entryId: "e3",
        title: "Install",
        path: "/guides/install/",
        children: [],
      },
      {
        entryId: "e4",
        title: "Configure",
        path: "/guides/configure/",
        children: [],
      },
    ],
  },
  { entryId: "e5", title: "Reference", path: "/reference/", children: [] },
];

const prefix = (path: string): string => {
  const depth = path.split("/").filter((part) => part !== "").length;
  return depth === 0 ? "./" : "../".repeat(depth);
};

/** A page at `path` of a site whose pages are {@link NAV}. */
export function sitePage(
  path: string,
  overrides: Partial<SitePage> = {},
): SitePage {
  const rel = prefix(path);
  return {
    kind: "page",
    site: { id: "site1", name: "Acme Docs", settings: undefined },
    space: { id: "space1", orgId: "org1", slug: "docs", name: "Docs" },
    revision: "rev1",
    entry: {
      id: "e3",
      type: "page",
      title: "Install",
      parent: "e2",
      order: 0,
      fields: {},
      body: doc(paragraph("Hello.")),
    },
    path,
    title: "Install",
    nav: NAV,
    prev: { title: "Guides", path: "/guides/" },
    next: { title: "Configure", path: "/guides/configure/" },
    url: (target) => `${rel}${target.slice(1)}`,
    asset: (_plugin, file) =>
      `${rel}${ASSET_DIR}${file.replace(/^dist\/site\//, "")}`,
    ...overrides,
  };
}
