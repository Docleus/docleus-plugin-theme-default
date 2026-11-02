import { z } from "@docleus/sdk";

export type ColorMode = "system" | "light" | "dark";

export interface ThemeSettings {
  /** `#rrggbb`. */
  readonly accentColor?: string;
  /** Shown in the header instead of the site name. */
  readonly logoText?: string;
  readonly footerText?: string;
  readonly defaultMode: ColorMode;
}

export const DEFAULT_SETTINGS: ThemeSettings = { defaultMode: "system" };

export type SettingsResult =
  | { readonly isValid: true; readonly settings: ThemeSettings }
  | {
      readonly isValid: false;
      readonly settings: ThemeSettings;
      readonly issues: readonly string[];
    };

const settingsSchema = z.object(
  {
    accentColor: z
      .string({ error: "accentColor must be a color like #1a2b3c" })
      .regex(/^#[0-9a-fA-F]{6}$/, "accentColor must be a color like #1a2b3c")
      .optional(),
    logoText: z
      .string({ error: "logoText must be a non-empty string" })
      .refine(
        (text) => text.trim() !== "",
        "logoText must be a non-empty string",
      )
      .optional(),
    footerText: z.string({ error: "footerText must be a string" }).optional(),
    defaultMode: z
      .enum(["system", "light", "dark"], {
        error: 'defaultMode must be "system", "light" or "dark"',
      })
      .default("system"),
  },
  { error: "settings must be an object" },
);

/**
 * Reads the theme's settings as stored for a site. Missing settings mean
 * the defaults; invalid ones fall back to the defaults as a whole and
 * report what is wrong. Unknown keys are ignored.
 */
export function parseThemeSettings(value: unknown): SettingsResult {
  if (value === undefined || value === null) {
    return { isValid: true, settings: DEFAULT_SETTINGS };
  }
  const result = settingsSchema.safeParse(value);
  if (!result.success) {
    return {
      isValid: false,
      settings: DEFAULT_SETTINGS,
      issues: result.error.issues.map((issue) => issue.message),
    };
  }
  const { accentColor, logoText, footerText, defaultMode } = result.data;
  return {
    isValid: true,
    settings: {
      defaultMode,
      ...(accentColor !== undefined && { accentColor }),
      ...(logoText !== undefined && { logoText }),
      ...(footerText !== undefined && { footerText }),
    },
  };
}
