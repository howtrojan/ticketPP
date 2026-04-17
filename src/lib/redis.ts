import Redis from "ioredis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const globalForRedis = globalThis as unknown as { redis?: Redis; redisErrorLogged?: boolean };

function stripOuterQuotes(value: string) {
  return value.trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
}

function normalizeRedisUrl(input: string) {
  const raw = stripOuterQuotes(input);
  const u = new URL(raw);
  const isUpstash = u.hostname.endsWith("upstash.io");
  if (u.protocol === "redis:" && (isUpstash || u.port === "6380")) u.protocol = "rediss:";
  return u.toString();
}

export function getRedis() {
  if (globalForRedis.redis && globalForRedis.redis.status !== "end") return globalForRedis.redis;
  if (!env.REDIS_URL) throw new Error("REDIS_URL não configurado");

  const url = normalizeRedisUrl(env.REDIS_URL);
  const redis = new Redis(url, {
    enableReadyCheck: true,
    maxRetriesPerRequest: 2,
    connectTimeout: 10_000,
    retryStrategy: (times) => Math.min(2_000, 50 * Math.pow(2, times)),
    tls: url.startsWith("rediss://") ? {} : undefined,
  });

  redis.on("error", (err) => {
    if (!globalForRedis.redisErrorLogged) {
      globalForRedis.redisErrorLogged = true;
      logger.warn({ err }, "redis.connection_error");
    }
  });

  redis.on("end", () => {
    if (globalForRedis.redis === redis) delete globalForRedis.redis;
  });

  if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
  return redis;
}
