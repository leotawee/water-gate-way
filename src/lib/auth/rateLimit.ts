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
// WHY: 1 command per second per user; operators press buttons one at a time, and the old 10/min fixed window
// locked them out for up to 60 s. Physical rate of change is limited separately (see the safety note in the report).
export const controlByUser = createRateLimiter({ limit: 1, windowMs: 1_000 });
// WHY: sign-up is unauthenticated and every attempt runs a 128 MiB scrypt; the global bucket bounds total
// memory/CPU even when an attacker rotates IPs, the per-IP one stops a single client filling the users table.
export const registerByIp = createRateLimiter({ limit: 5, windowMs: 60 * 60_000 });
export const registerGlobal = createRateLimiter({ limit: 50, windowMs: 60 * 60_000 });
// WHY: every offer makes go2rtc on the Pi allocate a WebRTC consumer. One dashboard page is 3 offers and a failing
// tile retries about every 14 s, so 60 a minute leaves room for several tabs but stops a script from loading the Pi.
export const webrtcByUser = createRateLimiter({ limit: 60, windowMs: 60_000 });
// WHY: restore redeems a token with no session; bound guessing without breaking a 30-day renewal cadence.
export const restoreByIp = createRateLimiter({ limit: 30, windowMs: 15 * 60_000 });
