import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import {
  editorBody,
  newPage,
  newSubpage,
  openNewSpace,
  openPageFromTree,
  publishSpace,
  save,
  storedBody,
  typeLines,
  type NewSpace,
} from "./helpers.ts";

const LIGHT_BACKGROUND = "rgb(255, 255, 255)";
const DARK_BACKGROUND = "rgb(17, 17, 17)";

function sidebar(page: Page) {
  return page.getByRole("navigation", { name: "Pages", exact: true });
}

function pager(page: Page) {
  return page.getByRole("navigation", { name: "Previous and next pages" });
}

function pageTitle(page: Page) {
  return page.getByRole("main").getByRole("heading", { level: 1 });
}

function bodyBackground(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

/** Introduction (with headings), Guide with a subpage Advanced, and Counter. */
async function writeDocs(page: Page): Promise<void> {
  await newPage(page, "Introduction");
  await typeLines(page, [
    "Welcome to the docs.",
    "## Install",
    "Run the installer.",
    "## Configure",
    "Edit the config file.",
    "### Options",
    "Every option is optional.",
  ]);
  await save(page);

  await newPage(page, "Guide");
  await typeLines(page, ["Guide body."]);
  await save(page);

  await newSubpage(page, "Guide", "Advanced");
  await typeLines(page, ["Advanced body."]);
  await save(page);

  await newPage(page, "Counter");
  await typeLines(page, ["Click the button below.", "/counter"]);
  const menu = page.getByRole("listbox", { name: "Insert block" });
  await expect(menu.getByRole("option", { name: "Counter" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  await save(page);
  expect(JSON.stringify(await storedBody(page))).toContain(
    '"type":"template.counter"',
  );
}

async function publishDocs(page: Page, space: NewSpace): Promise<string> {
  await writeDocs(page);
  const url = await publishSpace(page, space);
  return url;
}

test("a published site has page navigation, a table of contents and prev/next links", async ({
  page,
}) => {
  const space = await openNewSpace(page);
  const url = await publishDocs(page, space);

  const response = await page.goto(url);
  expect(response?.status()).toBe(200);
  expect(response?.headers()["content-type"]).toContain("text/html");
  await expect(page).toHaveTitle("Introduction – Docs");
  await expect(pageTitle(page)).toHaveText("Introduction");
  await expect(page.getByText("Welcome to the docs.")).toBeVisible();

  const nav = sidebar(page);
  await expect(nav.getByRole("link")).toHaveText([
    "Introduction",
    "Guide",
    "Advanced",
    "Counter",
  ]);
  await expect(nav.getByRole("link", { name: "Introduction" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  const toc = page.getByRole("navigation", { name: "On this page" });
  await expect(toc.getByRole("link")).toHaveText([
    "Install",
    "Configure",
    "Options",
  ]);
  await toc.getByRole("link", { name: "Configure" }).click();
  await expect(page).toHaveURL(`${url}#configure`);
  const configure = page.locator("#configure");
  await expect(configure).toHaveText("Configure");
  await expect(configure).toBeInViewport();

  await expect(pager(page).locator('a[rel="prev"]')).toHaveCount(0);
  await expect(pager(page).locator('a[rel="next"]')).toContainText("Guide");
  await pager(page).locator('a[rel="next"]').click();
  await expect(page).toHaveURL(`${url}guide/`);
  await expect(pageTitle(page)).toHaveText("Guide");
  await expect(page.getByText("Guide body.")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "On this page" }),
  ).toHaveCount(0);
  await expect(pager(page).locator('a[rel="prev"]')).toContainText(
    "Introduction",
  );
  await expect(pager(page).locator('a[rel="next"]')).toContainText("Advanced");

  await pager(page).locator('a[rel="next"]').click();
  await expect(page).toHaveURL(`${url}guide/advanced/`);
  await expect(page.getByText("Advanced body.")).toBeVisible();
  await expect(
    sidebar(page).getByRole("link", { name: "Advanced" }),
  ).toHaveAttribute("aria-current", "page");

  await sidebar(page).getByRole("link", { name: "Counter" }).click();
  await expect(page).toHaveURL(`${url}counter/`);
  await expect(pager(page).locator('a[rel="next"]')).toHaveCount(0);
  await expect(pager(page).locator('a[rel="prev"]')).toContainText("Advanced");

  await sidebar(page).getByRole("link", { name: "Introduction" }).click();
  await expect(page).toHaveURL(url);
  await expect(pageTitle(page)).toHaveText("Introduction");
});

test("the counter island mounts and counts; other pages load no island code", async ({
  page,
}) => {
  const space = await openNewSpace(page);
  const url = await publishDocs(page, space);

  const islandRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/counter.js")) {
      islandRequests.push(request.url());
    }
  });
  await page.goto(url);
  await expect(pageTitle(page)).toHaveText("Introduction");
  await expect(page.locator("#docleus-islands")).toHaveCount(0);
  await expect(page.locator('link[rel="modulepreload"]')).toHaveCount(0);
  await expect(page.locator("[data-island]")).toHaveCount(0);
  await page.goto(`${url}guide/`);
  await expect(pageTitle(page)).toHaveText("Guide");
  await page.waitForLoadState("networkidle");
  expect(islandRequests).toEqual([]);

  // The island module is held back until the server-rendered button is
  // marked, so the test can tell it apart from the mounted one.
  let release: (() => void) | undefined;
  const isReleased = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/counter.js", async (route) => {
    await isReleased;
    await route.continue();
  });
  await sidebar(page).getByRole("link", { name: "Counter" }).click();
  await expect(page).toHaveURL(`${url}counter/`);
  await expect(page.locator("#docleus-islands")).toHaveCount(1);
  await expect(
    page.locator('link[rel="modulepreload"][href$="/counter.js"]'),
  ).toHaveCount(1);
  const island = page.locator('[data-island="template.counter"]');
  await expect(island.getByRole("button")).toHaveText("Count: 0");
  await island
    .getByRole("button")
    .evaluate((button) => button.setAttribute("data-server", ""));
  release?.();

  const mounted = island.locator("button:not([data-server])");
  await expect(mounted).toHaveText("Count: 0");
  await expect(island.locator("button[data-server]")).toHaveCount(0);
  await mounted.click();
  await expect(mounted).toHaveText("Count: 1");
  await mounted.click();
  await expect(mounted).toHaveText("Count: 2");
  expect(
    islandRequests.some((request) =>
      request.endsWith(
        "/_assets/plugins/docleus-plugin-template@0.0.1/counter.js",
      ),
    ),
  ).toBe(true);
});

test("the dark-mode toggle switches the theme and keeps it across reloads", async ({
  page,
}) => {
  const space = await openNewSpace(page);
  await newPage(page, "Home");
  await typeLines(page, ["Hello."]);
  await save(page);
  const url = await publishSpace(page, space);

  await page.goto(url);
  const toggle = page.getByRole("button", { name: "Dark mode" });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(await bodyBackground(page)).toBe(LIGHT_BACKGROUND);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await bodyBackground(page)).toBe(DARK_BACKGROUND);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await bodyBackground(page)).toBe(DARK_BACKGROUND);

  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(await bodyBackground(page)).toBe(LIGHT_BACKGROUND);
});

test("dark mode uses the dark variant of the accent color", async ({
  page,
}) => {
  const space = await openNewSpace(page);
  const url = await publishDocs(page, space);
  await page.goto(url);
  await page.getByRole("button", { name: "Dark mode" }).click();
  const link = sidebar(page).getByRole("link", { name: "Introduction" });
  await expect(link).toHaveCSS("color", "rgb(242, 242, 240)");

  // The layout writes these properties for a site's accent color; the
  // settings have no UI yet, so the test sets the ones layout.test.ts checks.
  await page.evaluate(() =>
    document.documentElement.setAttribute(
      "style",
      "--dt-accent-light: #0a7d55; --dt-accent-dark: #0c9565",
    ),
  );
  await expect(link).toHaveCSS("color", "rgb(12, 149, 101)");
  await page.getByRole("button", { name: "Dark mode" }).click();
  await expect(link).toHaveCSS("color", "rgb(10, 125, 85)");
});

test("on narrow screens the sidebar is collapsed behind a toggle", async ({
  page,
}) => {
  const space = await openNewSpace(page);
  const url = await publishDocs(page, space);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(url);

  const toggle = page.getByRole("button", { name: "Pages" });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toHaveAttribute("aria-controls", "dt-sidebar");
  await expect(sidebar(page)).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(sidebar(page)).toBeVisible();
  await sidebar(page).getByRole("link", { name: "Guide" }).focus();
  await page.keyboard.press("Escape");
  await expect(sidebar(page)).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();

  await toggle.click();
  await sidebar(page).getByRole("link", { name: "Guide" }).click();
  await expect(page).toHaveURL(`${url}guide/`);
  await expect(sidebar(page)).toBeHidden();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(toggle).toBeHidden();
  await expect(sidebar(page)).toBeVisible();
});

test("a missing path shows the theme's not-found page with working assets", async ({
  page,
}) => {
  const space = await openNewSpace(page);
  await newPage(page, "Home");
  await typeLines(page, ["Hello."]);
  await save(page);
  await newPage(page, "Second");
  await typeLines(page, ["Second body."]);
  await save(page);
  const url = await publishSpace(page, space);

  const response = await page.goto(`${url}no/such/page/`);
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle("Page not found – Docs");
  await expect(pageTitle(page)).toHaveText("Page not found");
  expect(await page.evaluate(() => document.querySelector("base")?.href)).toBe(
    new URL(url, page.url()).href,
  );
  expect(await bodyBackground(page)).toBe(LIGHT_BACKGROUND);
  // The theme script resolved through the base, or the toggle stays hidden.
  await expect(page.getByRole("button", { name: "Dark mode" })).toBeVisible();

  await sidebar(page).getByRole("link", { name: "Second" }).click();
  await expect(page).toHaveURL(`${url}second/`);
  await expect(page.getByText("Second body.")).toBeVisible();
});

test("switching to an older publication serves its content again", async ({
  page,
}) => {
  const space = await openNewSpace(page);
  await newPage(page, "Home");
  await typeLines(page, ["Version one."]);
  await save(page);
  const url = await publishSpace(page, space);

  await page.goto(url);
  await expect(page.getByText("Version one.")).toBeVisible();

  await page.goto(space.spacePath);
  await openPageFromTree(page, "Home");
  await editorBody(page).getByText("Version one.").click({ clickCount: 3 });
  await page.keyboard.type("Version two.");
  await save(page);
  expect(await publishSpace(page, space)).toBe(url);

  await page.goto(url);
  await expect(page.getByText("Version two.")).toBeVisible();
  await expect(page.getByText("Version one.")).toHaveCount(0);

  // The older publication is restored from the space's site history.
  await page.goto(`${space.spacePath}/settings/site`);
  const history = page
    .getByRole("region", { name: "Site" })
    .locator(".history li");
  await expect(history).toHaveCount(2);
  await history.nth(1).getByRole("button", { name: "Roll back" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Restored the version published" }),
  ).toBeVisible();
  await expect(history.nth(1).getByText("Live")).toBeVisible();

  await page.goto(url);
  await expect(page.getByText("Version one.")).toBeVisible();
  await expect(page.getByText("Version two.")).toHaveCount(0);
});

const PACKAGE_DIR = fileURLToPath(new URL("../..", import.meta.url));
const CLI_TIMEOUT = 30_000;

interface CliResult {
  readonly code: number | null;
  readonly output: string;
  readonly hasTimedOut: boolean;
}

/**
 * Runs `docleus` from core and waits for it to exit by itself. A timeout
 * is reported, not treated as success: pnpm exits 0 when it is killed.
 */
function runDocleus(args: readonly string[]): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      ["--dir", "../docleus-core", "docleus", ...args],
      {
        cwd: PACKAGE_DIR,
      },
    );
    let output = "";
    let hasTimedOut = false;
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    const timer = setTimeout(() => {
      hasTimedOut = true;
      child.kill();
    }, CLI_TIMEOUT);
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, output, hasTimedOut });
    });
  });
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

test("docleus export writes the active publication with relative URLs", async ({
  page,
}) => {
  test.setTimeout(CLI_TIMEOUT + 30_000);
  const space = await openNewSpace(page);
  const url = await publishDocs(page, space);
  const siteName = url.split("/").slice(2, 4).join("/");

  const root = await mkdtemp(join(tmpdir(), "docleus-export-"));
  const out = join(root, "site");
  try {
    const result = await runDocleus([
      "export",
      "--site",
      siteName,
      "--out",
      out,
      "--bundle",
      process.env.DOCLEUS_E2E_BUNDLE ?? "",
      "--data",
      process.env.DOCLEUS_E2E_DATA ?? "",
    ]);
    expect(result.output).toMatch(/exported \d+ files to /);
    expect(result.hasTimedOut, "docleus export did not exit").toBe(false);
    expect(result.code).toBe(0);

    for (const file of [
      "index.html",
      "404.html",
      "_assets/docleus/runtime.js",
      "guide/index.html",
      "guide/advanced/index.html",
      "counter/index.html",
      "_assets/plugins/docleus-plugin-theme-default@0.0.1/theme.css",
      "_assets/plugins/docleus-plugin-template@0.0.1/counter.js",
    ]) {
      expect(await exists(join(out, file)), file).toBe(true);
    }
    expect((await readdir(out)).toSorted()).toEqual([
      "404.html",
      "_assets",
      "counter",
      "guide",
      "index.html",
    ]);

    const html = await readFile(join(out, "index.html"), "utf8");
    expect(html).toContain("Welcome to the docs.");
    const urls = [...html.matchAll(/\s(?:href|src)="([^"]*)"/g)].map(
      (match) => match[1] ?? "",
    );
    const importMap = /<script type="importmap">(.*?)<\/script>/s.exec(html);
    const imports = Object.values(
      (JSON.parse(importMap?.[1] ?? "{}") as { imports?: object }).imports ??
        {},
    );
    expect(urls.length).toBeGreaterThan(0);
    expect(imports.length).toBeGreaterThan(0);
    for (const value of [...urls, ...imports]) {
      expect(String(value)).toMatch(/^(?:\.\/|#|[a-z0-9_-][^:]*$)/i);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
