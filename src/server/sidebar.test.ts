import { Window } from "happy-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { SIDEBAR_SCRIPT } from "./sidebar.ts";

const BODY =
  '<button type="button" data-sidebar-toggle aria-controls="dt-sidebar" aria-expanded="false"><svg><path></path></svg></button>' +
  '<aside id="dt-sidebar"><a href="#">Page</a></aside>';

let page: Window;

const doc = () => page.document;
const root = () => doc().documentElement;

function toggle() {
  const element = doc().querySelector("button");
  if (!element) throw new Error("no toggle");
  return element;
}

const pressEscape = () =>
  doc().dispatchEvent(new page.KeyboardEvent("keydown", { key: "Escape" }));

describe("SIDEBAR_SCRIPT", () => {
  beforeEach(() => {
    // A fresh window per test, so listeners from other tests cannot interfere.
    page = new Window();
    doc().body.innerHTML = BODY;
    // The script is inline in the page; a function over the window's globals
    // runs it the same way.
    new Function("document", "Element", SIDEBAR_SCRIPT)(doc(), page.Element);
  });

  it("closes the sidebar before the page is shown", () => {
    expect(root().dataset.sidebar).toBe("closed");
  });

  it("opens and closes the sidebar from the toggle, also from its icon", () => {
    toggle().click();
    expect(root().dataset.sidebar).toBe("open");
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    doc()
      .querySelector("path")
      ?.dispatchEvent(new page.MouseEvent("click", { bubbles: true }));
    expect(root().dataset.sidebar).toBe("closed");
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("closes an open sidebar on Escape and returns focus to the toggle", () => {
    toggle().click();
    doc().querySelector("a")?.focus();
    pressEscape();
    expect(root().dataset.sidebar).toBe("closed");
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(doc().activeElement).toBe(toggle());
  });

  it("ignores Escape and other clicks while the sidebar is closed", () => {
    pressEscape();
    doc().querySelector("a")?.click();
    expect(root().dataset.sidebar).toBe("closed");
    expect(doc().activeElement).not.toBe(toggle());
  });
});
