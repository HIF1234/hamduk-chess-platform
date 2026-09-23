// Upstash Redis (REST) client. Worker-safe. Lazily initialized so missing env
// vars only fail at first use, not at import time.
import { Redis } from "@upstash/redis";

let _redis: Redis | undefined;

function createRedis(): Redis {
  // KV_REST_API_* are the names the Vercel Marketplace Upstash integration injects.
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error("Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_*)");
  }
  return new Redis({ url, token });
}

export const redis = new Proxy({} as Redis, {
  get(_t, prop, recv) {
    if (!_redis) _redis = createRedis();
    return Reflect.get(_redis, prop, recv);
  },
});
