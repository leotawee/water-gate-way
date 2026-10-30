import { describe, it, expect } from "vitest";
import { createRateLimiter, loginByIp, loginByEmail, controlByUser } from "./rateLimit";
import { safeNext } from "./safeNext";

describe("rate limiter", () => {
  it("allows `limit` hits, then blocks with retryAfterSec > 0, resets after window", () => {
    const rl = createRateLimiter({ limit: 3, windowMs: 1000 });
    for (let i = 0; i < 3; i++) expect(rl.hit("k", 0)).toEqual({ ok: true });
    const r = rl.hit("k", 400);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryAfterSec).toBeGreaterThan(0);
    expect(rl.hit("other", 400)).toEqual({ ok: true });
    expect(rl.hit("k", 1000)).toEqual({ ok: true });
  });
  it("11th command in a minute is 429", () => {
    const rl = createRateLimiter({ limit: 10, windowMs: 60_000 });
    for (let i = 0; i < 10; i++) expect(rl.hit("u", i).ok).toBe(true);
    expect(rl.hit("u", 11).ok).toBe(false);
  });
  it("prunes expired keys", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 10 });
    for (let i = 0; i < 2000; i++) rl.hit("k" + i, 0);
    rl.hit("x", 1000);
    expect(rl.size()).toBeLessThan(10);
  });
  it("named instances have exact limits", () => {
    const n = (rl: typeof loginByIp, now: number) => {
      let c = 0;
      while (rl.hit("same", now).ok) c++;
      return c;
    };
    expect(n(loginByIp, 0)).toBe(20);
    expect(n(loginByEmail, 0)).toBe(5);
    expect(n(controlByUser, 0)).toBe(10);
    const r = loginByEmail.hit("same", 0);
    if (!r.ok) expect(r.retryAfterSec).toBe(900);
    const c = controlByUser.hit("same", 0);
    if (!c.ok) expect(c.retryAfterSec).toBe(60);
  });
});

describe("safeNext", () => {
  it("keeps same-origin paths", () => {
    expect(safeNext("/dashboard?gate=gate-1")).toBe("/dashboard?gate=gate-1");
  });
  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "", null, undefined, "dashboard", "/a\\b", "/\t/x", "/\r\n/x", "/\u0000/x"])(
    "rejects %j",
    (v) => expect(safeNext(v as string | null | undefined)).toBe("/dashboard"),
  );
  it("returns the normalized parsed path, not the raw input", () => {
    expect(safeNext("/a/../dashboard?x=1#h")).toBe("/dashboard?x=1#h");
  });
  it("custom fallback", () => expect(safeNext("//x", "/home")).toBe("/home"));
});
