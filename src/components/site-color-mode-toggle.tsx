"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { ColorModeToggle } from "./color-mode-toggle";
import {
  applyHtmlMode,
  readStoredColorMode,
  readSystemDark,
  storeColorMode,
  subscribeColorMode,
  subscribeSystemDark,
} from "@/lib/appearance";

export function SiteColorModeToggle({ className = "" }: { className?: string }) {
  const stored = useSyncExternalStore(subscribeColorMode, readStoredColorMode, () => null);
  const systemDark = useSyncExternalStore(subscribeSystemDark, readSystemDark, () => false);
  const isDark = stored === "dark" || (stored === null && systemDark);

  useLayoutEffect(() => {
    applyHtmlMode(stored ?? "system");
  }, [stored, systemDark]);

  return (
    <ColorModeToggle
      className={className}
      isDark={isDark}
      onToggle={() => storeColorMode(isDark ? "light" : "dark")}
    />
  );
}
