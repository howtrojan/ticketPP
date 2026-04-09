import Redis from "ioredis";
import { env } from "@/lib/env";

const globalForRedis = globalThis as unknown as { redis?: Redis };

export function getRedis() {
  if (globalForRedis.redis) return globalForRedis.redis;
  if (!env.REDIS_URL) throw new Error("REDIS_URL não configurado");

  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
  });

  if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
  return redis;
}

