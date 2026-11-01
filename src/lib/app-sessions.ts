import {
  createMemorySessionStore,
  createRedisSessionStore,
  type SessionStore,
} from "./session-store";
import { createUpstashKvFromEnv } from "./upstash-kv";
import { lanyardOrigin, lanyardSignInHref, verifyLanyardToken } from "./lanyard";
import {
  createSessionService,
  defaultSessionServiceDeps,
  tokensMatch,
  type SessionServiceError,
} from "./sessions";

const globalForSessions = globalThis as typeof globalThis & {
  askmeatsackStore?: SessionStore;
};

export function getDefaultStore(): SessionStore {
  if (globalForSessions.askmeatsackStore) {
    return globalForSessions.askmeatsackStore;
  }
  const kv = createUpstashKvFromEnv();
  globalForSessions.askmeatsackStore = kv
    ? createRedisSessionStore(kv)
    : createMemorySessionStore();
  return globalForSessions.askmeatsackStore;
}

export function getDefaultSessionService() {
  return createSessionService(defaultSessionServiceDeps(getDefaultStore()));
}

export function readCreateCredential(request: Request): {
  hasCreateCredential: boolean;
  missing: boolean;
} {
  const expected = process.env.AGENT_API_KEY;
  const header = request.headers.get("authorization");
  if (!expected) {
    return { hasCreateCredential: false, missing: false };
  }
  if (!header?.startsWith("Bearer ")) {
    return { hasCreateCredential: false, missing: false };
  }
  const offered = header.slice("Bearer ".length);
  return {
    hasCreateCredential: tokensMatch(offered, expected),
    missing: false,
  };
}

export type Creator =
  /** No bearer, or one this product does not send to lanyard. Create as today. */
  | { readonly kind: "anonymous" }
  /** lanyard accepted the bearer. Identity only; it grants no extra access. */
  | { readonly kind: "account"; readonly account: string }
  /** lanyard was asked and did not accept the bearer. */
  | { readonly kind: "refused" };

/**
 * Who is creating. Only a bearer is ever sent to lanyard, and only when
 * LANYARD_URL is set and the bearer is not the operator's AGENT_API_KEY — that
 * key keeps meaning exactly what it meant before and never leaves this service.
 */
export async function identifyCreator(request: Request): Promise<Creator> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return { kind: "anonymous" };
  }
  if (readCreateCredential(request).hasCreateCredential) {
    return { kind: "anonymous" };
  }
  const origin = lanyardOrigin();
  if (!origin) {
    return { kind: "anonymous" };
  }
  const outcome = await verifyLanyardToken(origin, header.slice("Bearer ".length));
  return outcome.outcome === "accepted"
    ? { kind: "account", account: outcome.account }
    : { kind: "refused" };
}

export function refusedLanyardTokenResponse(): Response {
  const signIn = lanyardSignInHref();
  return jsonError(
    401,
    "unauthorized",
    `lanyard did not accept that token. Sign in again${signIn ? ` at ${signIn}` : ""}, or create without an Authorization header.`,
  );
}

export function readPublicToken(request: Request): string | undefined {
  const url = new URL(request.url);
  return url.searchParams.get("token") ?? url.searchParams.get("t") ?? undefined;
}

export function apiErrorBody(error: {
  code: string;
  message: string;
  issues?: SessionServiceError["issues"];
}): { error: { code: string; message: string; issues?: SessionServiceError["issues"] } } {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.issues && error.issues.length > 0 ? { issues: error.issues } : {}),
    },
  };
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  issues?: SessionServiceError["issues"],
): Response {
  return Response.json(apiErrorBody({ code, message, issues }), { status });
}

export function jsonServiceError(error: SessionServiceError): Response {
  return jsonError(error.status, error.code, error.message, error.issues);
}
