"use client";

import { useLayoutEffect, type ReactNode } from "react";
import {
  appearanceClassName,
  appearanceStyle,
  resolveMode,
} from "@/lib/appearance";
import type { Appearance } from "@/lib/schema";
import { cn } from "@/lib/utils";

type AppearanceShellProps = {
  appearance?: Appearance;
  children: ReactNode;
  className?: string;
};

function applyHtmlMode(mode: "system" | "light" | "dark"): void {
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (mode === "system") {
    delete root.dataset.colorMode;
  } else {
    root.dataset.colorMode = mode;
  }
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

export function AppearanceShell({
  appearance,
  children,
  className,
}: AppearanceShellProps) {
  const mode = resolveMode(appearance);

  useLayoutEffect(() => {
    applyHtmlMode(mode);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (mode === "system") {
        applyHtmlMode("system");
      }
    };
    mq.addEventListener("change", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
      applyHtmlMode("system");
    };
  }, [mode]);

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
