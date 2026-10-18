"use client";

import { useLayoutEffect, useSyncExternalStore, type ReactNode } from "react";
import {
  applyHtmlMode,
  appearanceClassName,
  appearanceStyle,
  readStoredColorMode,
  readSystemDark,
  resolveEffectiveMode,
  storeColorMode,
  subscribeColorMode,
  subscribeSystemDark,
} from "@/lib/appearance";
import type { Appearance } from "@/lib/schema";
import { ColorModeToggle } from "@/components/color-mode-toggle";
import { cn } from "@/lib/utils";

type AppearanceShellProps = {
  appearance?: Appearance;
  children: ReactNode;
  className?: string;
  showModeToggle?: boolean;
};

function modeIsDark(mode: "system" | "light" | "dark", systemDark: boolean): boolean {
  if (mode === "light") {
    return false;
  }
  if (mode === "dark") {
    return true;
  }
  return systemDark;
}

export function AppearanceShell({
  appearance,
  children,
  className,
  showModeToggle = true,
}: AppearanceShellProps) {
  const stored = useSyncExternalStore(subscribeColorMode, readStoredColorMode, () => null);
  const systemDark = useSyncExternalStore(subscribeSystemDark, readSystemDark, () => false);
  const mode = resolveEffectiveMode(appearance, stored);
  const isDark = modeIsDark(mode, systemDark);

  useLayoutEffect(() => {
    applyHtmlMode(mode);
    return () => {
      applyHtmlMode(readStoredColorMode() ?? "system");
    };
  }, [mode]);

  return (
    <div
      className={cn(
        "flex min-h-full flex-1 flex-col bg-background text-foreground",
        appearanceClassName(appearance, mode),
        className,
      )}
      style={appearanceStyle(appearance)}
    >
      {showModeToggle ? (
        <div className="flex w-full justify-end pt-3">
          <ColorModeToggle
            isDark={isDark}
            onToggle={() => {
              storeColorMode(isDark ? "light" : "dark");
            }}
          />
        </div>
      ) : null}
      {children}
    </div>
  );
}
