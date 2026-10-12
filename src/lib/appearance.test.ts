import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appearanceClassName,
  appearanceStyle,
  contrastingForeground,
  resolveEffectiveMode,
  resolveMode,
  resolveTheme,
  readStoredColorMode,
  storeColorMode,
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

  it("lets a stored Auto follow the device, not the agent's last hint", () => {
    expect(resolveEffectiveMode({ mode: "dark" }, "auto")).toBe("system");
  });

  it("keeps mode as a light or dark override, not a different theme", () => {
    expect(resolveTheme({ mode: "light" })).toBe("ask");
    expect(resolveMode({ mode: "light" })).toBe("light");
    expect(appearanceClassName({ mode: "light" })).toBe("light theme-ask");
    expect(appearanceClassName({ mode: "dark", theme: "grove" })).toBe("dark theme-grove");
  });

  it("uses a named theme in both modes", () => {
    expect(resolveTheme({ theme: "grove" })).toBe("grove");
    expect(appearanceClassName({ theme: "ember" })).toBe("theme-ember");
    expect(appearanceClassName({ theme: "paper", mode: "dark" })).toBe("dark theme-paper");
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

describe("reader colour preferences", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["dark", "dark"],
    ["auto", "auto"],
    ["invalid", null],
  ])("restores the shared cookie %s when no local choice exists", (cookie, expected) => {
    vi.stubGlobal("window", { localStorage: { getItem: () => null } });
    vi.stubGlobal("document", {
      cookie: `meatsack_color_mode=${cookie}`,
      documentElement: { getAttribute: () => "auto" },
    });
    expect(readStoredColorMode()).toBe(expected);
  });

  it("keeps the selected mode usable when saving is refused", () => {
    const attributes = new Map<string, string>([["data-color-mode", "light"]]);
    const root = {
      getAttribute: (name: string) => attributes.get(name) ?? null,
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      classList: { toggle: () => undefined },
      style: { colorScheme: "light" },
    };
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => "light",
        setItem: () => {
          throw new Error("Storage full");
        },
      },
      matchMedia: () => ({ matches: false }),
      location: { hostname: "ask.imeatsack.com", protocol: "https:" },
    });
    vi.stubGlobal("document", {
      documentElement: root,
      get cookie() {
        return "";
      },
      set cookie(_value: string) {
        throw new Error("Cookies blocked");
      },
    });
    storeColorMode("dark");
    expect(readStoredColorMode()).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
  });
});
