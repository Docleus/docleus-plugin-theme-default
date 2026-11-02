import { SIDEBAR_TOGGLE_ATTRIBUTE } from "../shared/constants.ts";

const TOGGLE = JSON.stringify(`[${SIDEBAR_TOGGLE_ATTRIBUTE}]`);

/**
 * Collapses the sidebar on narrow screens and wires its toggle. It runs in
 * `<head>`, so the sidebar is closed before the first paint, and it is
 * inline, so it also works in a static export opened from disk, where module
 * scripts do not run. Without JavaScript `<html data-sidebar>` stays unset:
 * the stylesheet then shows the sidebar and hides the toggle.
 */
export const SIDEBAR_SCRIPT =
  `(function(){var r=document.documentElement;r.dataset.sidebar="closed";` +
  `function set(open,focus){r.dataset.sidebar=open?"open":"closed";` +
  `var b=document.querySelector(${TOGGLE});` +
  `if(b){b.setAttribute("aria-expanded",String(open));if(focus)b.focus()}}` +
  `document.addEventListener("click",function(e){var t=e.target;` +
  `if(t instanceof Element&&t.closest(${TOGGLE}))set(r.dataset.sidebar!=="open",false)});` +
  `document.addEventListener("keydown",function(e){` +
  `if(e.key==="Escape"&&r.dataset.sidebar==="open")set(false,true)})})()`;
