import {
  createMemorySessionStore,
  createRedisSessionStore,
  type SessionStore,
} from "./session-store";
import { createUpstashKvFromEnv } from "./upstash-kv";
import {
  createSessionService,
  defaultSessionServiceDeps,
  tokensMatch,
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

export function readPublicToken(request: Request): string | undefined {
  const url = new URL(request.url);
  return url.searchParams.get("token") ?? url.searchParams.get("t") ?? undefined;
}

export function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}
