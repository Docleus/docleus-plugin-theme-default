import { defineConfig } from "tsdown";

const common = {
  format: "esm",
  dts: false,
  outExtensions: () => ({ js: ".js" }),
} as const;

export default defineConfig([
  {
    ...common,
    entry: { "server/index": "src/server/index.ts" },
    clean: ["dist/server", "dist/*.js"],
  },
  {
    // A build of its own, so its chunks stay inside the browser root a
    // published site copies, `dist/site`.
    ...common,
    entry: { index: "src/site/index.ts" },
    outDir: "dist/site",
    platform: "browser",
    clean: true,
    copy: [{ from: "src/site/theme.css", to: "dist/site" }],
  },
]);
