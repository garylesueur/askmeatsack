"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { ColorModeToggle } from "./color-mode-toggle";
import {
  applyAppearanceMode,
  readStoredColorMode,
  readSystemDark,
  resolveEffectiveMode,
  storeColorMode,
  subscribeColorMode,
  subscribeSystemDark,
} from "@/lib/appearance";

export function ColorModePicker({ className = "" }: { className?: string }) {
  const stored = useSyncExternalStore(subscribeColorMode, readStoredColorMode, () => null);
  const systemDark = useSyncExternalStore(subscribeSystemDark, readSystemDark, () => false);
  const mode = resolveEffectiveMode(undefined, stored);
  const isDark = mode === "dark" || (mode === "system" && systemDark);

  useLayoutEffect(() => {
    applyAppearanceMode(mode, stored ?? "auto");
  }, [mode, stored, systemDark]);

  return (
    <ColorModeToggle
      className={className}
      isDark={isDark}
      onToggle={() => storeColorMode(isDark ? "light" : "dark")}
    />
  );
}
