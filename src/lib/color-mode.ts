export const COLOR_MODE_STORAGE_KEY = "meatsack:color-mode";
export const COLOR_MODE_COOKIE = "meatsack_color_mode";
export const COLOR_MODE_LEGACY_STORAGE_KEY = "askmeatsack:color-mode";

export type StoredColorMode = "light" | "dark" | "auto";

export const COLOR_MODES = ["light", "auto", "dark"] as const;

export function isStoredColorMode(value: string | null | undefined): value is StoredColorMode {
  return value === "light" || value === "dark" || value === "auto";
}

/**
 * Runs before first paint so the page is not light-then-dark.
 * Same key and cookie name as showmeatsack.com documents.
 */
export const COLOR_MODE_BOOT_SCRIPT = `(function(){var K="meatsack:color-mode";var C="meatsack_color_mode";function read(){try{var s=localStorage.getItem(K);if(s==="light"||s==="dark"||s==="auto")return s;s=localStorage.getItem("askmeatsack:color-mode");if(s==="light"||s==="dark")return s;}catch(e){}var m=document.cookie.match(/(?:^|; )meatsack_color_mode=([^;]*)/);if(m){var c=decodeURIComponent(m[1]);if(c==="light"||c==="dark"||c==="auto")return c;}return"auto";}function dark(mode){if(mode==="dark")return true;if(mode==="light")return false;return window.matchMedia("(prefers-color-scheme: dark)").matches;}var mode=read();var isDark=dark(mode);var root=document.documentElement;root.setAttribute("data-theme",isDark?"dark":"light");root.setAttribute("data-color-mode",mode);root.classList.toggle("dark",isDark);root.classList.toggle("light",!isDark);root.style.colorScheme=isDark?"dark":"light";})();`;

export function colorModeCookieDomain(hostname: string): string {
  if (hostname === "showmeatsack.com" || hostname.endsWith(".showmeatsack.com")) {
    return "; Domain=.showmeatsack.com";
  }
  if (hostname === "askmeatsack.com" || hostname.endsWith(".askmeatsack.com")) {
    return "; Domain=.askmeatsack.com";
  }
  return "";
}

export function persistColorModeCookie(mode: StoredColorMode, hostname: string, protocol: string): string {
  const secure = protocol === "https:" ? "; Secure" : "";
  return `${COLOR_MODE_COOKIE}=${mode}; Path=/; Max-Age=31536000; SameSite=Lax${secure}${colorModeCookieDomain(hostname)}`;
}

export function applyResolvedColorMode(root: HTMLElement, mode: StoredColorMode, isDark: boolean): void {
  root.setAttribute("data-theme", isDark ? "dark" : "light");
  root.setAttribute("data-color-mode", mode);
  root.classList.toggle("dark", isDark);
  root.classList.toggle("light", !isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
}
