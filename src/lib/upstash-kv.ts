import { Redis } from "@upstash/redis";
import type { KvClient } from "./session-store";

export function createUpstashKvFromEnv(): KvClient | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    return null;
  }
  return Redis.fromEnv();
}
