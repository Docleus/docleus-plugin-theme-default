import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const PORT = 4329;
const bundle = fileURLToPath(new URL("tests/e2e/bundle.yaml", import.meta.url));
// Workers load this file again; the environment carries the runner's data
// directory to them, so `docleus export` in a test reads the served data.
process.env.DOCLEUS_E2E_BUNDLE = bundle;
process.env.DOCLEUS_E2E_DATA ??= mkdtempSync(join(tmpdir(), "docleus-e2e-"));
const data = process.env.DOCLEUS_E2E_DATA;

// The server loads the built app, its site runtime (`dist-site`, built by
// the app's build) and the built plugins of every repository in the bundle.
const command = [
  "pnpm --dir ../docleus-core build",
  "pnpm --dir ../docleus-plugin-editor build",
  "pnpm --dir ../docleus-plugin-blocks-commonmark build",
  "pnpm --dir ../docleus-plugin-template build",
  "pnpm build",
  `pnpm --dir ../docleus-core docleus serve --dev --bundle ${bundle} --data ${data} --port ${PORT}`,
].join(" && ");

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command,
    url: `http://127.0.0.1:${PORT}/api/auth/methods`,
    timeout: 240_000,
    reuseExistingServer: false,
    stdout: "pipe",
  },
});
