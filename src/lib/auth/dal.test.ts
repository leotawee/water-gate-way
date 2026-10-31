import { describe, it, expect, vi, beforeEach } from "vitest";

type U = { id: string; email: string; password_hash: string; role: string; disabled: boolean };
type S = { user_id: string; token_hash: Buffer; expires_at: Date };

const h = vi.hoisted(() => ({
  users: [] as U[],
  sessions: [] as S[],
  cookieJar: new Map<string, string>(),
  headerMap: new Map<string, string>(),
  set: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  del: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  query: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
}));

// In-memory stand-in for pg, dispatching on the SQL shape used by session.ts and actions.ts.
vi.mock("@/lib/db", () => {
  h.query = vi.fn(async (sql: string, p: unknown[]) => {
    const q = sql.trim().toLowerCase().replace(/\s+/g, " ");
    if (q.startsWith("insert into sessions")) {
      h.sessions.push({ user_id: p[0] as string, token_hash: p[1] as Buffer, expires_at: p[2] as Date });
      return { rows: [], rowCount: 1 };
    }
    if (q.startsWith("delete from sessions")) {
      h.sessions = h.sessions.filter((s) => !s.token_hash.equals(p[0] as Buffer));
      return { rows: [], rowCount: 1 };
    }
    if (q.includes("from sessions")) {
      const s = h.sessions.find((x) => x.token_hash.equals(p[0] as Buffer) && x.expires_at > (p[1] as Date));
      const u = s && h.users.find((x) => x.id === s.user_id && !x.disabled);
      return { rows: u ? [{ id: u.id, email: u.email, role: u.role }] : [] };
    }
    if (q.includes("from users")) {
      const u = h.users.find((x) => x.email === p[0]);
      return { rows: u ? [{ id: u.id, password_hash: u.password_hash, disabled: u.disabled }] : [] };
    }
    if (q.startsWith("update users set password_hash")) return { rows: [], rowCount: 1 };
    throw new Error("unexpected sql: " + sql);
  });
  return { db: { query: h.query } };
});

vi.mock("next/headers", () => {
  h.set = vi.fn((name: string, value: string) => h.cookieJar.set(name, value));
  h.del = vi.fn((name: string) => h.cookieJar.delete(name));
  return {
    cookies: async () => ({
      get: (name: string) => (h.cookieJar.has(name) ? { name, value: h.cookieJar.get(name) } : undefined),
      set: h.set,
      delete: h.del,
    }),
    headers: async () => new Headers(Object.fromEntries(h.headerMap)),
  };
});

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error("NEXT_REDIRECT " + url);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

// WHY: real scrypt allocates ~128 MiB per call; the fake keeps tests fast and lets us see the hash used.
vi.mock("@/lib/auth/password", () => ({
  verifyPassword: vi.fn(
    async (plain: string, stored: string) => ["GOOD_HASH", "scrypt$GOOD"].includes(stored) && plain === "right-password",
  ),
  needsRehash: (stored: string) => !stored.startsWith("scrypt$"),
  hashPassword: vi.fn(async () => "scrypt$NEW"),
}));

import { redirect } from "next/navigation";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { createSession } from "./session";
import { requireUser, requirePageUser, requireAdminPage, getUser, AuthError, authErrorResponse } from "./dal";
import { signIn, signOut } from "@/app/login/actions";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
let ipSeq = 0;

beforeEach(() => {
  h.users = [
    { id: "u-viewer", email: "viewer@x.co", password_hash: "GOOD_HASH", role: "viewer", disabled: false },
    { id: "u-admin", email: "admin@x.co", password_hash: "GOOD_HASH", role: "admin", disabled: false },
    { id: "u-off", email: "off@x.co", password_hash: "GOOD_HASH", role: "admin", disabled: true },
    { id: "u-scrypt", email: "modern@x.co", password_hash: "scrypt$GOOD", role: "viewer", disabled: false },
  ];
  h.sessions = [];
  h.cookieJar.clear();
  h.headerMap.clear();
  // WHY: limiters are module singletons; a fresh IP per test keeps the IP bucket from leaking across tests.
  h.headerMap.set("x-forwarded-for", `10.0.0.${++ipSeq}, 1.1.1.1`);
  vi.clearAllMocks();
});

async function loginAs(userId: string) {
  const { token } = await createSession(userId);
  h.cookieJar.set("wg_session", token);
}

describe("requirePageUser", () => {
  it("no session -> redirect to /login with the encoded next path", async () => {
    await expect(requirePageUser("/dashboard?gate=gate-2")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login?next=%2Fdashboard%3Fgate%3Dgate-2");
  });
  it("session -> returns the user, no redirect", async () => {
    await loginAs("u-viewer");
    await expect(requirePageUser("/")).resolves.toMatchObject({ id: "u-viewer", role: "viewer" });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("requireAdminPage", () => {
  it("no session -> redirect to /login with the encoded next path", async () => {
    await expect(requireAdminPage("/admin/users")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login?next=%2Fadmin%2Fusers");
  });
  it("logged-in viewer -> notFound, not a redirect (the page must not reveal it exists)", async () => {
    await loginAs("u-viewer");
    await expect(requireAdminPage("/admin")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(redirect).not.toHaveBeenCalled();
  });
  it("admin -> returns the user", async () => {
    await loginAs("u-admin");
    await expect(requireAdminPage("/admin")).resolves.toMatchObject({ id: "u-admin", role: "admin" });
  });
});

describe("requireUser", () => {
  it("no session -> AuthError unauthenticated", async () => {
    await expect(requireUser()).rejects.toMatchObject({ name: "AuthError", code: "unauthenticated" });
    expect(await getUser()).toBeNull();
  });
  it("unknown token -> unauthenticated", async () => {
    h.cookieJar.set("wg_session", "bogus");
    await expect(requireUser()).rejects.toMatchObject({ code: "unauthenticated" });
  });
  it("viewer asking for operator -> forbidden", async () => {
    await loginAs("u-viewer");
    await expect(requireUser("operator")).rejects.toMatchObject({ code: "forbidden" });
    await expect(requireUser()).resolves.toMatchObject({ id: "u-viewer", role: "viewer" });
  });
  it("unknown minRole -> forbidden even for admin (fail closed)", async () => {
    await loginAs("u-admin");
    await expect(requireUser("superuser" as never)).rejects.toMatchObject({ code: "forbidden" });
  });
  it("admin passes operator", async () => {
    await loginAs("u-admin");
    await expect(requireUser("operator")).resolves.toEqual({ id: "u-admin", email: "admin@x.co", role: "admin" });
  });
});

describe("authErrorResponse", () => {
  it("maps AuthError to 401/403 JSON; other errors -> null", async () => {
    const r401 = authErrorResponse(new AuthError("unauthenticated"));
    expect(r401?.status).toBe(401);
    expect(await r401?.json()).toEqual({ error: "unauthorized" });
    const r403 = authErrorResponse(new AuthError("forbidden"));
    expect(r403?.status).toBe(403);
    expect(await r403?.json()).toEqual({ error: "forbidden" });
    expect(authErrorResponse(new Error("db down"))).toBeNull();
  });
});

describe("signIn", () => {
  it("wrong password -> invalid", async () => {
    expect(await signIn(undefined, form({ email: "viewer@x.co", password: "nope" }))).toEqual({ error: "invalid" });
    expect(h.set).not.toHaveBeenCalled();
  });
  it("unknown email -> same invalid, still runs verifyPassword on a well-formed dummy hash", async () => {
    expect(await signIn(undefined, form({ email: "ghost@x.co", password: "right-password" }))).toEqual({ error: "invalid" });
    expect(verifyPassword).toHaveBeenCalledTimes(1);
    const stored = vi.mocked(verifyPassword).mock.calls[0][1];
    expect(stored).toMatch(/^scrypt\$131072\$8\$1\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{86}==$/);
  });
  it("disabled user with right password -> invalid", async () => {
    expect(await signIn(undefined, form({ email: "off@x.co", password: "right-password" }))).toEqual({ error: "invalid" });
    expect(h.set).not.toHaveBeenCalled();
  });
  it("email > 254 chars -> invalid without DB lookup", async () => {
    const long = "a".repeat(250) + "@x.co";
    expect(await signIn(undefined, form({ email: long, password: "x" }))).toEqual({ error: "invalid" });
    expect(h.query).not.toHaveBeenCalled();
  });
  it("6th attempt for one email in 15 min -> rate_limited, no DB lookup", async () => {
    for (let i = 0; i < 5; i++) {
      h.headerMap.set("x-forwarded-for", `10.1.0.${i}`);
      expect(await signIn(undefined, form({ email: "Target@X.co ", password: "bad" }))).toEqual({ error: "invalid" });
    }
    h.query.mockClear();
    vi.mocked(verifyPassword).mockClear();
    h.headerMap.set("x-forwarded-for", "10.1.0.99");
    // trim + lowercase: a case/space variant hits the same bucket
    expect(await signIn(undefined, form({ email: " target@x.CO", password: "right-password" }))).toEqual({
      error: "rate_limited",
    });
    expect(h.query).not.toHaveBeenCalled();
    expect(verifyPassword).not.toHaveBeenCalled();
  });
  it("21st attempt from one IP -> rate_limited (x-real-ip fallback)", async () => {
    h.headerMap.clear();
    h.headerMap.set("x-real-ip", "192.0.2.7");
    for (let i = 0; i < 20; i++) {
      expect(await signIn(undefined, form({ email: `ip${i}@x.co`, password: "bad" }))).toEqual({ error: "invalid" });
    }
    expect(await signIn(undefined, form({ email: "fresh@x.co", password: "bad" }))).toEqual({ error: "rate_limited" });
  });
  it("success sets wg_session cookie with constraint attributes and redirects to safeNext(next)", async () => {
    await expect(
      signIn(undefined, form({ email: " Viewer@X.co", password: "right-password", next: "/dashboard?gate=gate-1" })),
    ).rejects.toThrow("NEXT_REDIRECT /dashboard?gate=gate-1");
    expect(h.set).toHaveBeenCalledTimes(1);
    const [name, token, opts] = h.set.mock.calls[0];
    expect(name).toBe("wg_session");
    expect(typeof token).toBe("string");
    expect(opts).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(opts.maxAge).toBeGreaterThan(43000);
    expect(opts.maxAge).toBeLessThanOrEqual(43200);
    expect(h.sessions).toHaveLength(1);
    // the cookie it set is a working session
    await expect(requireUser()).resolves.toMatchObject({ id: "u-viewer" });
  });
  it("success with hostile next -> /dashboard", async () => {
    await expect(
      signIn(undefined, form({ email: "viewer@x.co", password: "right-password", next: "//evil.com" })),
    ).rejects.toThrow("NEXT_REDIRECT /dashboard");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});

describe("signIn legacy rehash", () => {
  const rehashCalls = () => h.query.mock.calls.filter(([sql]) => /^update users/i.test(sql as string));

  it("bcrypt row: successful login rewrites the hash as scrypt", async () => {
    await expect(signIn(undefined, form({ email: "viewer@x.co", password: "right-password" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(hashPassword).toHaveBeenCalledWith("right-password");
    expect(h.query).toHaveBeenCalledWith("update users set password_hash = $1 where id = $2", ["scrypt$NEW", "u-viewer"]);
  });

  it("scrypt row: no rehash write", async () => {
    await expect(signIn(undefined, form({ email: "modern@x.co", password: "right-password" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(hashPassword).not.toHaveBeenCalled();
    expect(rehashCalls()).toHaveLength(0);
  });

  it("failed rehash is logged, does not block the login, and logs no secret", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(hashPassword).mockRejectedValueOnce(new Error("scrypt failed"));
    await expect(signIn(undefined, form({ email: "viewer@x.co", password: "right-password" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(h.set).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalledWith("[auth/signIn] rehash failed");
    expect(JSON.stringify(err.mock.calls)).not.toContain("right-password");
    err.mockRestore();
  });
});

describe("signOut", () => {
  it("revokes the DB session, deletes the cookie, redirects to /login", async () => {
    await loginAs("u-admin");
    await expect(signOut()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(h.sessions).toHaveLength(0);
    expect(h.del).toHaveBeenCalledWith("wg_session");
  });
});
