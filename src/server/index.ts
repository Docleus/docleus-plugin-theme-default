import { definePlugin } from "@docleus/sdk";
import { PLUGIN_NAME } from "../shared/constants.ts";
import { createTheme } from "./layout.ts";

export { PLUGIN_NAME } from "../shared/constants.ts";
export { createTheme, type ThemeLogger, type ThemeOptions } from "./layout.ts";
export {
  DEFAULT_SETTINGS,
  parseThemeSettings,
  type ColorMode,
  type SettingsResult,
  type ThemeSettings,
} from "./settings.ts";

/**
 * Registers the default site theme under its package name. It is undone
 * when the plugin unloads.
 */
export const plugin = definePlugin({
  name: PLUGIN_NAME,
  inject: ["render"],
  apply(ctx) {
    ctx.render.registerTheme(
      PLUGIN_NAME,
      createTheme({ logger: ctx.logger(PLUGIN_NAME) }),
    );
  },
});
