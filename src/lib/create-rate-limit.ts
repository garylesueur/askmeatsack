import { clientIpFromRequest } from "./client-ip";

/**
 * Rate limits for the endpoints a stranger can reach.
 *
 * askmeatsack had none at all. Creating is open until B35 lands, uploads are
 * open by design once someone holds an answer link, and `wait` holds a
 * serverless function for up to sixty seconds per call — so an unlimited caller
 * can tie up capacity without ever answering anything.
 *
 * Counted per calling address for now. When accounts arrive the count moves to
 * the account, per B37; the anonymous home-page trial keeps an address-based
 * limit because it has no account to count against.
 */
import {
  createMemoryCounterStore,
  createRedisCounterStore,
  type CounterStore,
} from "./counter-store";
import { createUpstashRedisFromEnv } from "./upstash-kv";

export const CREATE_RATE_LIMIT_MAX = 30;
export const CREATE_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

export type CreateRateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export type CreateRateLimiter = {
  hit(clientKey: string): Promise<CreateRateLimitResult>;
};

export function createCreateRateLimiter(deps: {
  store: CounterStore;
  max?: number;
  windowSeconds?: number;
}): CreateRateLimiter {
  const max = deps.max ?? CREATE_RATE_LIMIT_MAX;
  const windowSeconds = deps.windowSeconds ?? CREATE_RATE_LIMIT_WINDOW_SECONDS;
  return {
    async hit(clientKey: string): Promise<CreateRateLimitResult> {
      const key = `askmeatsack:ratelimit:create:${clientKey}`;
      const count = await deps.store.increment(key, windowSeconds);
      if (count <= max) {
        return { ok: true };
      }
      const retryAfterSeconds = await deps.store.ttlSeconds(key);
      return {
        ok: false,
        retryAfterSeconds: retryAfterSeconds > 0 ? retryAfterSeconds : windowSeconds,
      };
    },
  };
}

const globalForLimit = globalThis as typeof globalThis & {
  askmeatsackCreateRateLimiter?: CreateRateLimiter;
};

export function getCreateRateLimiter(): CreateRateLimiter {
  if (globalForLimit.askmeatsackCreateRateLimiter) {
    return globalForLimit.askmeatsackCreateRateLimiter;
  }
  const redis = createUpstashRedisFromEnv();
  const limiter = createCreateRateLimiter({
    store: redis ? createRedisCounterStore(redis) : createMemoryCounterStore(),
  });
  if (process.env.NODE_ENV !== "production") {
    globalForLimit.askmeatsackCreateRateLimiter = limiter;
  }
  return limiter;
}

export function installTestCreateRateLimiter(limiter: CreateRateLimiter): void {
  globalForLimit.askmeatsackCreateRateLimiter = limiter;
}

export function clearInstalledCreateRateLimiter(): void {
  delete globalForLimit.askmeatsackCreateRateLimiter;
}

export async function limitCreateFromRequest(
  request: Request,
  limiter: CreateRateLimiter = getCreateRateLimiter(),
): Promise<CreateRateLimitResult> {
  return limiter.hit(clientIpFromRequest(request));
}
