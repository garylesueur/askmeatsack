"use client";

import { COLOR_MODES, type StoredColorMode } from "@/lib/color-mode";
import { cn } from "@/lib/utils";

export function ColorModeToggle({
  value,
  onChange,
}: {
  value: StoredColorMode;
  onChange: (mode: StoredColorMode) => void;
}) {
  return (
    <fieldset className="m-0 inline-flex rounded-full border border-border bg-card p-0.5 text-xs font-medium text-muted-foreground">
      <legend className="sr-only">Colour</legend>
      {COLOR_MODES.map((mode) => {
        const selected = value === mode;
        const label = mode === "auto" ? "Auto" : mode === "light" ? "Light" : "Dark";
        return (
          <label
            key={mode}
            className={cn(
              "cursor-pointer rounded-full px-2.5 py-1 transition-colors",
              selected ? "bg-muted text-foreground" : "hover:text-foreground",
            )}
          >
            <input
              type="radio"
              name="color-mode"
              value={mode}
              checked={selected}
              className="sr-only"
              onChange={() => {
                onChange(mode);
              }}
            />
            {label}
          </label>
        );
      })}
    </fieldset>
  );
}
