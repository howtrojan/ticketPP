import { getRedis } from "@/lib/redis";

export type RateLimitConfig = {
  key: string;
  limit: number;
  windowSeconds: number;
};

export async function rateLimit(config: RateLimitConfig) {
  try {
    const redis = getRedis();
    const bucketKey = `rl:${config.key}:${Math.floor(Date.now() / 1000 / config.windowSeconds)}`;
    const count = await redis.incr(bucketKey);
    if (count === 1) await redis.expire(bucketKey, config.windowSeconds);
    const remaining = Math.max(0, config.limit - count);

    return {
      allowed: count <= config.limit,
      remaining,
      limit: config.limit,
      resetSeconds: config.windowSeconds,
    };
  } catch {
    return {
      allowed: true,
      remaining: config.limit,
      limit: config.limit,
      resetSeconds: config.windowSeconds,
    };
  }
}
