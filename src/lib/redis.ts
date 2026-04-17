import Redis from "ioredis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const globalForRedis = globalThis as unknown as { redis?: Redis; redisErrorLogged?: boolean };

export function getRedis() {
  if (globalForRedis.redis) return globalForRedis.redis;
  if (!env.REDIS_URL) throw new Error("REDIS_URL não configurado");

  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    retryStrategy: () => null,
  });

  redis.on("error", (err) => {
    if (!globalForRedis.redisErrorLogged) {
      globalForRedis.redisErrorLogged = true;
      logger.warn({ err }, "redis.connection_error");
    }
  });

  if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
  return redis;
}
