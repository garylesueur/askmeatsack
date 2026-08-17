import { describe, expect, it } from "vitest";
import {
  appearanceClassName,
  appearanceStyle,
  contrastingForeground,
  resolveTheme,
} from "./appearance";

describe("questionnaire appearance", () => {
  it("defaults to the ask theme", () => {
    expect(resolveTheme()).toBe("ask");
    expect(appearanceClassName()).toBe("dark theme-ask");
    expect(appearanceStyle()).toBeUndefined();
  });

  it("maps light mode to paper", () => {
    expect(resolveTheme({ mode: "light" })).toBe("paper");
    expect(appearanceClassName({ mode: "light" })).toBe("theme-paper");
  });

  it("uses a named theme", () => {
    expect(resolveTheme({ theme: "grove" })).toBe("grove");
    expect(appearanceClassName({ theme: "ember" })).toBe("dark theme-ember");
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
