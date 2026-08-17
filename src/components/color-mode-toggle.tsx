"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ColorModeToggle({
  isDark,
  onToggle,
}: {
  isDark: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light" : "Switch to dark"}
      title={isDark ? "Switch to light" : "Switch to dark"}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
