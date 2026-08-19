export const CURSOR_PLUGIN_HREF = "https://github.com/garylesueur/askmeatsack";

function encodeConfig(mcpUrl: string): string {
  const json = JSON.stringify({ url: mcpUrl });
  return typeof Buffer === "undefined" ? btoa(json) : Buffer.from(json).toString("base64");
}

export function cursorInstallHref(mcpUrl: string): string {
  const config = encodeConfig(mcpUrl);
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent("askmeatsack.com")}&config=${config}`;
}

export function cursorInstallPageHref(mcpUrl: string): string {
  const config = encodeConfig(mcpUrl);
  return `https://cursor.com/en/install-mcp?name=${encodeURIComponent("askmeatsack.com")}&config=${config}`;
}
