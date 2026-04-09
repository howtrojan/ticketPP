import { getRedis } from "@/lib/redis";

export const HOLD_TTL_SECONDS = 7 * 60;

export function holdKey(ticketId: string) {
  return `hold:ticket:${ticketId}`;
}

export async function getHold(ticketId: string) {
  const redis = getRedis();
  const key = holdKey(ticketId);
  const [value, ttl] = await Promise.all([redis.get(key), redis.ttl(key)]);
  return { userId: value, ttlSeconds: ttl };
}

export async function createHold(ticketId: string, userId: string) {
  const redis = getRedis();
  const key = holdKey(ticketId);
  const ok = await redis.set(key, userId, "EX", HOLD_TTL_SECONDS, "NX");
  return ok === "OK";
}

export async function releaseHold(ticketId: string, userId: string) {
  const redis = getRedis();
  const key = holdKey(ticketId);
  const current = await redis.get(key);
  if (!current) return true;
  if (current !== userId) return false;
  await redis.del(key);
  return true;
}

