import { describe, it, expect, vi, beforeEach } from "vitest";

type U = { id: string; email: string; role: string; disabled: boolean };
type S = { user_id: string; token_hash: Buffer; expires_at: Date };
const store = vi.hoisted(() => ({ users: [] as U[], sessions: [] as S[] }));

// In-memory stand-in for pg: dispatches on the leading SQL verb/table.
vi.mock("@/lib/db", () => ({
  db: {
    async query(sql: string, p: unknown[]) {
      const q = sql.trim().toLowerCase();
      if (q.startsWith("insert into sessions")) {
        store.sessions.push({ user_id: p[0] as string, token_hash: p[1] as Buffer, expires_at: p[2] as Date });
        return { rows: [], rowCount: 1 };
      }
      if (q.startsWith("delete from sessions")) {
        const before = store.sessions.length;
        store.sessions = store.sessions.filter((s) => !s.token_hash.equals(p[0] as Buffer));
        return { rows: [], rowCount: before - store.sessions.length };
      }
      if (q.startsWith("select")) {
        const now = p[1] as Date;
        const s = store.sessions.find((x) => x.token_hash.equals(p[0] as Buffer) && x.expires_at > now);
        const u = s && store.users.find((x) => x.id === s.user_id && !x.disabled);
        return { rows: u ? [{ id: u.id, email: u.email, role: u.role }] : [] };
      }
      throw new Error("unexpected sql: " + sql);
    },
  },
}));

import { hashPassword, verifyPassword } from "./password";
import { createSession, getSessionUser, revokeSession, sessionCookieOptions, SESSION_COOKIE } from "./session";

describe("password", () => {
  it("hash then verify -> true; wrong -> false", async () => {
    const h = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
  it("two hashes of same password differ; format prefix", async () => {
    const a = await hashPassword("same-password-123");
    const b = await hashPassword("same-password-123");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$131072$8$1$")).toBe(true);
    expect(a.split("$")).toHaveLength(6);
  });
  it("malformed stored -> false, never throws", async () => {
    for (const s of ["", "garbage", "scrypt$1$2$3$a$b", "scrypt$131072$8$1$!!$!!", "scrypt$131072$8$1$AAAA$", "bcrypt$131072$8$1$AAAA$AAAA"]) {
      await expect(verifyPassword("x", s)).resolves.toBe(false);
    }
  });
});

describe("sessions", () => {
  beforeEach(() => {
    store.users = [{ id: "u1", email: "a@b.co", role: "operator", disabled: false }];
    store.sessions = [];
  });

  it("stores sha256 hash, not the token; getSessionUser returns user", async () => {
    const { token, expiresAt } = await createSession("u1");
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(store.sessions[0].token_hash).toHaveLength(32);
    expect(store.sessions[0].token_hash.toString("base64url")).not.toBe(token);
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(11.9 * 3600_000);
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(12 * 3600_000);
    expect(await getSessionUser(token)).toEqual({ id: "u1", email: "a@b.co", role: "operator" });
  });
  it("undefined / unknown token -> null", async () => {
    expect(await getSessionUser(undefined)).toBeNull();
    expect(await getSessionUser("nope")).toBeNull();
  });
  it("expired -> null", async () => {
    const { token } = await createSession("u1");
    store.sessions[0].expires_at = new Date(Date.now() - 1000);
    expect(await getSessionUser(token)).toBeNull();
  });
  it("disabled user -> null", async () => {
    const { token } = await createSession("u1");
    store.users[0].disabled = true;
    expect(await getSessionUser(token)).toBeNull();
  });
  it("revoked -> null", async () => {
    const { token } = await createSession("u1");
    await revokeSession(token);
    expect(await getSessionUser(token)).toBeNull();
  });
  it("cookie options", () => {
    const exp = new Date(Date.now() + 12 * 3600_000);
    const o = sessionCookieOptions(exp);
    expect(SESSION_COOKIE).toBe("wg_session");
    expect(o).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/", expires: exp });
    expect(o.maxAge).toBeGreaterThan(0);
    expect(o.maxAge).toBeLessThanOrEqual(43200);
  });
});
