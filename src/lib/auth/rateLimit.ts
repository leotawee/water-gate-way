export type HitResult = { ok: true } | { ok: false; retryAfterSec: number };

// TECH DEBT: in-process store; move to Redis if >1 instance.
export function createRateLimiter(opts: { limit: number; windowMs: number }) {
  const { limit, windowMs } = opts;
  const buckets = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = Number.NEGATIVE_INFINITY;

  return {
    hit(key: string, now: number = Date.now()): HitResult {
      // WHY: sweep expired keys at most once per window so the Map cannot grow without bound.
      if (now - lastSweep >= windowMs) {
        for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
        lastSweep = now;
      }
      let b = buckets.get(key);
      if (!b || b.resetAt <= now) {
        b = { count: 0, resetAt: now + windowMs };
        buckets.set(key, b);
      }
      if (b.count >= limit) return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
      b.count++;
      return { ok: true };
    },
    size: () => buckets.size,
  };
}

export const loginByIp = createRateLimiter({ limit: 20, windowMs: 15 * 60_000 });
export const loginByEmail = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });
export const controlByUser = createRateLimiter({ limit: 10, windowMs: 60_000 });
