export type CounterStore = {
  increment(key: string, ttlSeconds: number): Promise<number>;
  ttlSeconds(key: string): Promise<number>;
};

type MemoryBucket = {
  count: number;
  resetAt: number;
};

export function createMemoryCounterStore(now: () => number = Date.now): CounterStore {
  const buckets = new Map<string, MemoryBucket>();
  return {
    async increment(key: string, ttlSeconds: number): Promise<number> {
      const current = now();
      const existing = buckets.get(key);
      if (!existing || existing.resetAt <= current) {
        buckets.set(key, {
          count: 1,
          resetAt: current + ttlSeconds * 1000,
        });
        return 1;
      }
      existing.count += 1;
      return existing.count;
    },
    async ttlSeconds(key: string): Promise<number> {
      const existing = buckets.get(key);
      if (!existing) {
        return 0;
      }
      return Math.max(0, Math.ceil((existing.resetAt - now()) / 1000));
    },
  };
}

export type RedisCounterClient = {
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<unknown>;
  ttl: (key: string) => Promise<number>;
};

export function createRedisCounterStore(redis: RedisCounterClient): CounterStore {
  return {
    async increment(key: string, ttlSeconds: number): Promise<number> {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, ttlSeconds);
      }
      return count;
    },
    async ttlSeconds(key: string): Promise<number> {
      const ttl = await redis.ttl(key);
      return ttl > 0 ? ttl : 0;
    },
  };
}
