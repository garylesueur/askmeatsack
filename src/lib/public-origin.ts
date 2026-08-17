export function publicOrigin(): string {
  const fromEnv = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (fromEnv) {
    return fromEnv;
  }
  return "https://askmeatsack.com";
}
