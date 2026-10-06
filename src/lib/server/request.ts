import "server-only";
import { headers } from "next/headers";

/** IP klien dari nginx (X-Real-IP), aplikasi hanya mendengar di 127.0.0.1 */
export async function clientIp() {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

const buckets = new Map<string, number[]>();

/** Pembatas sederhana di memori (satu proses): `max` kali per `windowMs` per kunci. */
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  return true;
}
