import { createAccountAuthority } from "./account-authority";
import { jsonError } from "./app-sessions";

export async function verifyAccountRequest(request: Request) {
  return createAccountAuthority({
    lanyardUrl: process.env.LANYARD_URL ?? "https://meatsack.puregaz.com",
    product: "askmeatsack",
  })(request.headers.get("authorization"));
}

export function accountUnauthorized(): Response {
  return accountResponse(jsonError(401, "unauthorized", "Verified account authority is required"));
}

export function accountResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Vary", "Authorization");
  return new Response(response.body, { status: response.status, headers });
}
