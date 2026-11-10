import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const NEW_ID = "00000000-0000-4000-8000-000000000009";

const h = vi.hoisted(() => ({
  ip: "198.51.100.1",
  query: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
}));

vi.mock("@/lib/db", () => {
  h.query = vi.fn();
  return { db: { query: h.query } };
});

// WHY: real scrypt is ~128 MiB per call; the fake returns a fixed hash so tests can assert it is the value stored.
vi.mock("@/lib/auth/password", () => ({ hashPassword: vi.fn(async () => "scrypt$NEW") }));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": h.ip }) }));

// redirect() throws in Next; the fake throws a marker so the test can read the target.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { to });
  }),
}));

import { register } from "./actions";
import { hashPassword } from "@/lib/auth/password";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const ok = (extra: Record<string, string> = {}) =>
  form({ email: "New.User@Example.com ", password: "longenough1", confirm: "longenough1", ...extra });
const userInserts = () => h.query.mock.calls.filter(([sql]) => /^insert into users/i.test(sql as string));
const audits = () => h.query.mock.calls.filter(([sql]) => /^insert into admin_audit/i.test(sql as string));

async function redirectOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return (e as { to?: string }).to ?? "";
  }
  return "";
}

let ipSeq = 0;
afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.clearAllMocks();
  // WHY: the limiters are module singletons; a fresh IP per test keeps the per-IP bucket independent.
  h.ip = `198.51.100.${++ipSeq}`;
  h.query.mockImplementation(async (sql: string) =>
    /^insert into users/i.test(sql) ? { rows: [{ id: NEW_ID }], rowCount: 1 } : { rows: [], rowCount: 1 },
  );
});

describe("register", () => {
  it("creates a viewer with the normalised email and the hashed password, then sends the user to login", async () => {
    expect(await redirectOf(register(undefined, ok()))).toBe("/login?registered=1");
    const [sql, params] = userInserts()[0];
    expect(sql).toMatch(/'viewer'/);
    expect(params).toEqual(["new.user@example.com", "scrypt$NEW"]);
    expect(audits()[0][1]).toEqual([NEW_ID, `user:${NEW_ID}`, h.ip]);
  });

  it("ignores a role field in the form (no privilege escalation)", async () => {
    await redirectOf(register(undefined, ok({ role: "admin" })));
    const [sql, params] = userInserts()[0];
    expect(sql).not.toMatch(/admin'/);
    expect(params).not.toContain("admin");
  });

  it("answers an existing email exactly like a new one (no enumeration)", async () => {
    h.query.mockImplementation(async () => ({ rows: [], rowCount: 0 }));
    expect(await redirectOf(register(undefined, ok()))).toBe("/login?registered=1");
    expect(hashPassword).toHaveBeenCalledTimes(1);
    expect(audits()).toHaveLength(0);
  });

  it.each([
    ["no email", { email: "" }, "email"],
    ["malformed email", { email: "not-an-email" }, "email"],
    ["email over 254", { email: `${"a".repeat(250)}@x.co` }, "email"],
    ["short password", { password: "short", confirm: "short" }, "password"],
    ["password over 1024", { password: "x".repeat(1025), confirm: "x".repeat(1025) }, "password"],
    ["confirm mismatch", { confirm: "different1" }, "mismatch"],
  ])("rejects %s before any DB or scrypt work", async (_n, extra, error) => {
    expect(await register(undefined, ok(extra as Record<string, string>))).toMatchObject({ error });
    expect(h.query).not.toHaveBeenCalled();
    expect(hashPassword).not.toHaveBeenCalled();
  });

  it("passes SQL-looking input only as a bound parameter", async () => {
    // No spaces, so it passes the email shape check and reaches the query.
    const evil = "x'or'1'='1;--@x.co";
    await redirectOf(register(undefined, ok({ email: evil })));
    const [sql, params] = userInserts()[0];
    expect(sql).not.toContain("'1'='1");
    expect(params[0]).toBe(evil);
  });

  it("limits one IP to 5 sign-ups an hour and returns the wait", async () => {
    for (let i = 0; i < 5; i++) await redirectOf(register(undefined, ok({ email: `u${i}@x.co` })));
    const res = await register(undefined, ok({ email: "u6@x.co" }));
    expect(res).toMatchObject({ error: "rate_limited" });
    expect((res as { retryAfterSec: number }).retryAfterSec).toBeGreaterThan(0);
    expect(userInserts()).toHaveLength(5);
  });

  it("does not spend the global quota on a request already refused per IP", async () => {
    const { registerGlobal } = await import("@/lib/auth/rateLimit");
    const spy = vi.spyOn(registerGlobal, "hit");
    for (let i = 0; i < 5; i++) await redirectOf(register(undefined, ok({ email: `g${i}@x.co` })));
    spy.mockClear();
    for (let i = 0; i < 3; i++) await register(undefined, ok({ email: `blocked${i}@x.co` }));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

