import type { CSSProperties } from "react";
import type { Appearance } from "./schema";
import {
  COLOR_MODE_LEGACY_STORAGE_KEY,
  COLOR_MODE_STORAGE_KEY,
  applyResolvedColorMode,
  isStoredColorMode,
  persistColorModeCookie,
  type StoredColorMode,
} from "./color-mode";

export const APPEARANCE_THEMES = ["ask", "paper", "grove", "ember"] as const;

export type AppearanceTheme = (typeof APPEARANCE_THEMES)[number];

export type AppearanceMode = "system" | "light" | "dark";

export { COLOR_MODE_STORAGE_KEY };

export function resolveTheme(appearance?: Appearance): AppearanceTheme {
  if (appearance?.theme) {
    return appearance.theme;
  }
  return "ask";
}

export function resolveMode(appearance?: Appearance): AppearanceMode {
  if (appearance?.mode === "light" || appearance?.mode === "dark") {
    return appearance.mode;
  }
  return "system";
}

const colorModeListeners = new Set<() => void>();

export function readStoredColorMode(): StoredColorMode | null {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
  if (isStoredColorMode(value)) {
    return value;
  }
  const legacy = window.localStorage.getItem(COLOR_MODE_LEGACY_STORAGE_KEY);
  if (legacy === "light" || legacy === "dark") {
    return legacy;
  }
  return null;
}

export function subscribeColorMode(listener: () => void): () => void {
  colorModeListeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }
  return () => {
    colorModeListeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}

export function storeColorMode(mode: StoredColorMode): void {
  window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
  document.cookie = persistColorModeCookie(mode, window.location.hostname, window.location.protocol);
  for (const listener of colorModeListeners) {
    listener();
  }
}

export function subscribeSystemDark(listener: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", listener);
  return () => {
    mq.removeEventListener("change", listener);
  };
}

export function readSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveEffectiveMode(
  appearance: Appearance | undefined,
  stored: StoredColorMode | null,
): AppearanceMode {
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  if (stored === "auto") {
    return "system";
  }
  return resolveMode(appearance);
}

export function applyAppearanceMode(mode: AppearanceMode, preference: StoredColorMode): void {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = mode === "dark" || (mode !== "light" && systemDark);
  applyResolvedColorMode(document.documentElement, preference, isDark);
}

export function appearanceClassName(
  appearance?: Appearance,
  mode: AppearanceMode = resolveMode(appearance),
): string {
  const theme = resolveTheme(appearance);
  if (mode === "system") {
    return `theme-${theme}`;
  }
  return `${mode} theme-${theme}`;
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

export function appearanceStyle(appearance?: Appearance): CSSProperties | undefined {
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
