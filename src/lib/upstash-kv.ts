import { Redis } from "@upstash/redis";
import type { KvClient } from "./session-store";

/**
 * Reads whichever pair of variables the environment happens to use. Vercel's
 * Marketplace injects `KV_REST_API_*`; Upstash's own dashboard gives
 * `UPSTASH_REDIS_REST_*`. Both appear across our environments.
 *
 * The values are passed explicitly rather than through `Redis.fromEnv()`, which
 * reads only the `UPSTASH_` pair — so a deployment configured with the
 * Marketplace pair alone would pass the check below and then build a client
 * from nothing.
 */
function readRedisCredentials(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    return null;
  }
  return { url, token };
}

export function createUpstashRedisFromEnv(): Redis | null {
  const credentials = readRedisCredentials();
  return credentials ? new Redis(credentials) : null;
}

export function createUpstashKvFromEnv(): KvClient | null {
  return createUpstashRedisFromEnv();
}
