import type { CSSProperties } from "react";
import type { Appearance } from "./schema";

export const APPEARANCE_THEMES = ["ask", "paper", "grove", "ember"] as const;

export type AppearanceTheme = (typeof APPEARANCE_THEMES)[number];

export function resolveTheme(appearance?: Appearance): AppearanceTheme {
  if (appearance?.theme) {
    return appearance.theme;
  }
  if (appearance?.mode === "light") {
    return "paper";
  }
  return "ask";
}

export function themeIsDark(theme: AppearanceTheme): boolean {
  return theme !== "paper";
}

export function appearanceClassName(appearance?: Appearance): string {
  const theme = resolveTheme(appearance);
  if (theme === "paper") {
    return "theme-paper";
  }
  return `dark theme-${theme}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = Number.parseInt(hex.slice(1), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  const linear = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const scaled = channel / 255;
    if (scaled <= 0.03928) {
      return scaled / 12.92;
    }
    return ((scaled + 0.055) / 1.055) ** 2.4;
  });
  const red = linear[0] ?? 0;
  const green = linear[1] ?? 0;
  const blue = linear[2] ?? 0;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastingForeground(accent: string): string {
  return relativeLuminance(accent) > 0.45 ? "#171717" : "#fafafa";
}

export function appearanceStyle(
  appearance?: Appearance,
): CSSProperties | undefined {
  const accent = appearance?.accent;
  if (!accent) {
    return undefined;
  }
  const foreground = contrastingForeground(accent);
  return {
    "--primary": accent,
    "--primary-foreground": foreground,
    "--ring": accent,
    "--sidebar-primary": accent,
    "--sidebar-primary-foreground": foreground,
  } as CSSProperties;
}
