"use client";

import { useLayoutEffect, useSyncExternalStore, type ReactNode } from "react";
import {
  appearanceClassName,
  appearanceStyle,
  applyAppearanceMode,
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

export function AppearanceShell({
  appearance,
  children,
  className,
  showModeToggle = true,
}: AppearanceShellProps) {
  const stored = useSyncExternalStore(subscribeColorMode, readStoredColorMode, () => null);
  const systemDark = useSyncExternalStore(subscribeSystemDark, readSystemDark, () => false);
  const mode = resolveEffectiveMode(appearance, stored);
  const preference = stored ?? "auto";

  useLayoutEffect(() => {
    applyAppearanceMode(mode, preference);
    return () => {
      const storedMode = readStoredColorMode();
      applyAppearanceMode(resolveEffectiveMode(undefined, storedMode), storedMode ?? "auto");
    };
  }, [mode, preference, systemDark]);

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
            isDark={mode === "dark" || (mode === "system" && systemDark)}
            onToggle={() =>
              storeColorMode(
                mode === "dark" || (mode === "system" && systemDark) ? "light" : "dark",
              )
            }
          />
        </div>
      ) : null}
      {children}
    </div>
  );
}
