"use client";

import { useLayoutEffect, type ReactNode } from "react";
import {
  appearanceClassName,
  appearanceStyle,
  resolveTheme,
  themeIsDark,
} from "@/lib/appearance";
import type { Appearance } from "@/lib/schema";
import { cn } from "@/lib/utils";

type AppearanceShellProps = {
  appearance?: Appearance;
  children: ReactNode;
  className?: string;
};

export function AppearanceShell({
  appearance,
  children,
  className,
}: AppearanceShellProps) {
  const theme = resolveTheme(appearance);
  const shouldBeDark = themeIsDark(theme);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.toggle("dark", shouldBeDark);
    return () => {
      root.classList.toggle("dark", hadDark);
    };
  }, [shouldBeDark]);

  return (
    <div
      className={cn(
        "flex min-h-full flex-1 flex-col bg-background text-foreground",
        appearanceClassName(appearance),
        className,
      )}
      style={appearanceStyle(appearance)}
    >
      {children}
    </div>
  );
}
