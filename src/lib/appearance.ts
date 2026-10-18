import type { CSSProperties } from "react";
import type { Appearance } from "./schema";

export const APPEARANCE_THEMES = ["ask", "paper", "grove", "ember"] as const;

export type AppearanceTheme = (typeof APPEARANCE_THEMES)[number];

export type AppearanceMode = "system" | "light" | "dark";

export function resolveTheme(appearance?: Appearance): AppearanceTheme {
  if (appearance?.theme) {
    return appearance.theme;
  }
  return "ask";
}

export const COLOR_MODE_STORAGE_KEY = "askmeatsack:color-mode";

export function resolveMode(appearance?: Appearance): AppearanceMode {
  if (appearance?.mode === "light" || appearance?.mode === "dark") {
    return appearance.mode;
  }
  return "system";
}

const colorModeListeners = new Set<() => void>();

export function readStoredColorMode(): "light" | "dark" | null {
  if (typeof window === "undefined") {
    return null;
  }
  let value: string | null = null;
  try {
    value = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
  } catch {
    value = document.documentElement.dataset.colorMode ?? null;
  }
  if (value === "light" || value === "dark") {
    return value;
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

export function storeColorMode(mode: "light" | "dark"): void {
  applyHtmlMode(mode);
  try {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
  } catch {
    // The current page still switches when storage is unavailable.
  }
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
  stored: "light" | "dark" | null,
): AppearanceMode {
  if (stored) {
    return stored;
  }
  return resolveMode(appearance);
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

export function applyHtmlMode(mode: "system" | "light" | "dark"): void {
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (mode === "system") {
    delete root.dataset.colorMode;
  } else {
    root.dataset.colorMode = mode;
  }
  root.style.colorScheme = mode === "system" ? (systemDark ? "dark" : "light") : mode;
  if (mode === "light") {
    root.classList.add("light");
    root.classList.remove("dark");
    return;
  }
  if (mode === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
    return;
  }
  root.classList.remove("light");
  root.classList.toggle("dark", systemDark);
}
