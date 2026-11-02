/** The page background in dark mode; `--dt-bg` in `theme.css`. */
export const DARK_BACKGROUND = "#14161a";

/** WCAG AA contrast for normal text, which links are. */
export const MIN_CONTRAST = 4.5;

type Rgb = readonly [number, number, number];
type Hsl = readonly [number, number, number];

function rgbOf(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function hexOf(rgb: Rgb): string {
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** The WCAG relative luminance of a `#rrggbb` color. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = rgbOf(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** The WCAG contrast ratio of two `#rrggbb` colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const x = relativeLuminance(a);
  const y = relativeLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function hslOf([r, g, b]: Rgb): Hsl {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === rn
      ? ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
      : max === gn
        ? ((bn - rn) / d + 2) * 60
        : ((rn - gn) / d + 4) * 60;
  return [h, s, l];
}

function rgbOfHsl([h, s, l]: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b]: Rgb =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  const channel = (value: number) => Math.round((value + m) * 255);
  return [channel(r), channel(g), channel(b)];
}

/**
 * The accent color to use on the dark background: the color itself when it
 * reaches {@link MIN_CONTRAST} there, otherwise the same hue and saturation
 * made lighter, by the smallest step that does.
 */
export function darkModeAccent(hex: string): string {
  const color = hex.toLowerCase();
  if (contrastRatio(color, DARK_BACKGROUND) >= MIN_CONTRAST) return color;
  const [h, s, l] = hslOf(rgbOf(color));
  for (let step = 1; step <= 100; step += 1) {
    const candidate = hexOf(rgbOfHsl([h, s, Math.min(1, l + step / 100)]));
    if (contrastRatio(candidate, DARK_BACKGROUND) >= MIN_CONTRAST) {
      return candidate;
    }
  }
  // Unreachable: white has a contrast of about 17 on the dark background.
  return "#ffffff";
}
