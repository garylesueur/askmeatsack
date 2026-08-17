import { describe, expect, it } from "vitest";
import {
  appearanceClassName,
  appearanceStyle,
  contrastingForeground,
  resolveEffectiveMode,
  resolveMode,
  resolveTheme,
} from "./appearance";

describe("questionnaire appearance", () => {
  it("defaults to the ask theme and the system light or dark", () => {
    expect(resolveTheme()).toBe("ask");
    expect(resolveMode()).toBe("system");
    expect(appearanceClassName()).toBe("theme-ask");
    expect(appearanceStyle()).toBeUndefined();
  });

  it("lets a stored choice win over the system and the agent hint", () => {
    expect(resolveEffectiveMode(undefined, "dark")).toBe("dark");
    expect(resolveEffectiveMode({ mode: "dark" }, "light")).toBe("light");
    expect(resolveEffectiveMode({ mode: "light" }, null)).toBe("light");
    expect(resolveEffectiveMode(undefined, null)).toBe("system");
  });

  it("keeps mode as a light or dark override, not a different theme", () => {
    expect(resolveTheme({ mode: "light" })).toBe("ask");
    expect(resolveMode({ mode: "light" })).toBe("light");
    expect(appearanceClassName({ mode: "light" })).toBe("light theme-ask");
    expect(appearanceClassName({ mode: "dark", theme: "grove" })).toBe(
      "dark theme-grove",
    );
  });

  it("uses a named theme in both modes", () => {
    expect(resolveTheme({ theme: "grove" })).toBe("grove");
    expect(appearanceClassName({ theme: "ember" })).toBe("theme-ember");
    expect(appearanceClassName({ theme: "paper", mode: "dark" })).toBe(
      "dark theme-paper",
    );
  });

  it("still tints primary from a hex accent", () => {
    expect(appearanceStyle({ accent: "#0f766e" })).toMatchObject({
      "--primary": "#0f766e",
      "--ring": "#0f766e",
    });
  });

  it("picks dark text on a light accent", () => {
    expect(contrastingForeground("#fde68a")).toBe("#171717");
  });

  it("picks light text on a dark accent", () => {
    expect(contrastingForeground("#0f766e")).toBe("#fafafa");
  });
});
