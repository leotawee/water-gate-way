import { describe, it, expect, vi, beforeEach } from "vitest";

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ID = "00000000-0000-4000-8000-000000000002";
const NEW_ID = "00000000-0000-4000-8000-000000000003";

const h = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; role: string },
  query: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
}));

vi.mock("@/lib/db", () => {
  h.query = vi.fn(async () => ({ rows: [], rowCount: 1 }));
  return { db: { query: h.query } };
});

// Fake DAL: same contract as src/lib/auth/dal.ts without cookies/DB (same shape as the control route test).
vi.mock("@/lib/auth/dal", async () => {
  class AuthError extends Error {
    constructor(readonly code: "unauthenticated" | "forbidden") {
      super(code);
      this.name = "AuthError";
    }
  }
  const rank: Record<string, number> = { viewer: 0, operator: 1, admin: 2 };
  return {
    AuthError,
    requireUser: vi.fn(async (min: string) => {
      if (!h.user) throw new AuthError("unauthenticated");
      if ((rank[h.user.role] ?? -1) < (rank[min] ?? Infinity)) throw new AuthError("forbidden");
      return h.user;
    }),
  };
});

// WHY: real scrypt is ~128 MiB per call; the fake returns a fixed hash so tests can assert it is the value stored.
vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn(async () => "scrypt$NEW"),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createUser,
  setUserRole,
  setUserDisabled,
  resetUserPassword,
  createGate,
  updateGate,
  setGateActive,
} from "./actions";
import { requireUser } from "@/lib/auth/dal";
import { hashPassword } from "@/lib/auth/password";
import { revalidatePath } from "next/cache";

type Action = (prev: undefined, form: FormData) => Promise<unknown>;

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const calls = (re: RegExp) => h.query.mock.calls.filter(([sql]) => re.test(sql as string));
const audits = () => calls(/^insert into admin_audit/i).map(([, p]) => p as unknown[]);
const dupError = () => Object.assign(new Error("duplicate key"), { code: "23505" });

const VALID: Array<[string, Action, () => FormData]> = [
  ["createUser", createUser, () => form({ email: "new@x.co", role: "viewer", password: "longenough1" })],
  ["setUserRole", setUserRole, () => form({ id: OTHER_ID, role: "viewer" })],
  ["setUserDisabled", setUserDisabled, () => form({ id: OTHER_ID, disabled: "true" })],
  ["resetUserPassword", resetUserPassword, () => form({ id: OTHER_ID, password: "longenough1" })],
  ["createGate", createGate, () => form({ id: "gate-9", name: "Gate 9", location: "", lat: "18.7", lng: "99" })],
  ["updateGate", updateGate, () => form({ id: "gate-1", name: "Gate 1", location: "", lat: "18.7", lng: "99" })],
  ["setGateActive", setGateActive, () => form({ id: "gate-2", active: "false" })],
];

beforeEach(() => {
  vi.clearAllMocks();
  h.query.mockReset();
  h.query.mockResolvedValue({ rows: [{ id: NEW_ID }], rowCount: 1 });
  h.user = { id: ADMIN_ID, email: "admin@x.co", role: "admin" };
});

describe("admin actions: access control", () => {
  it.each(VALID)("%s: no session -> rejected unauthenticated, nothing written", async (_name, action, mk) => {
    h.user = null;
    await expect(action(undefined, mk())).rejects.toMatchObject({ code: "unauthenticated" });
    expect(h.query).not.toHaveBeenCalled();
    expect(hashPassword).not.toHaveBeenCalled();
  });

  it.each(VALID.flatMap(([name, action, mk]) => (["viewer", "operator"] as const).map((role) => [name, role, action, mk] as const)))(
    "%s as %s -> rejected forbidden, nothing written",
    async (_name, role, action, mk) => {
      h.user = { id: OTHER_ID, email: "op@x.co", role };
      await expect(action(undefined, mk())).rejects.toMatchObject({ code: "forbidden" });
      expect(h.query).not.toHaveBeenCalled();
      expect(hashPassword).not.toHaveBeenCalled();
    },
  );

  it.each(VALID)("%s asks the DAL for role admin", async (_name, action, mk) => {
    await action(undefined, mk());
    expect(requireUser).toHaveBeenCalledWith("admin");
  });
});

describe("createUser", () => {
  it.each([
    ["bad email", { email: "not-an-email", role: "viewer", password: "longenough1" }],
    ["bad role", { email: "a@x.co", role: "superuser", password: "longenough1" }],
    ["short password", { email: "a@x.co", role: "viewer", password: "short" }],
    ["password over 1024", { email: "a@x.co", role: "viewer", password: "x".repeat(1025) }],
    ["email over 254", { email: "a".repeat(250) + "@x.co", role: "viewer", password: "longenough1" }],
  ])("%s -> error, no query, no hash", async (_n, fields) => {
    expect(await createUser(undefined, form(fields))).toEqual({ error: expect.any(String) });
    expect(h.query).not.toHaveBeenCalled();
    expect(hashPassword).not.toHaveBeenCalled();
  });

  it("duplicate email -> friendly error, not a throw", async () => {
    h.query.mockRejectedValueOnce(dupError());
    expect(await createUser(undefined, form({ email: "taken@x.co", role: "viewer", password: "longenough1" }))).toEqual({
      error: "That email already has an account.",
    });
    expect(audits()).toHaveLength(0);
  });

  it("other DB errors propagate (not swallowed as validation errors)", async () => {
    h.query.mockRejectedValueOnce(new Error("connection reset"));
    await expect(createUser(undefined, form({ email: "a@x.co", role: "viewer", password: "longenough1" }))).rejects.toThrow(
      "connection reset",
    );
  });

  it("happy path: normalized email, parameterized insert, password hashed, audit row, no password in SQL", async () => {
    expect(
      await createUser(undefined, form({ email: "  New@X.co ", role: "operator", password: "longenough1" })),
    ).toBeUndefined();
    expect(hashPassword).toHaveBeenCalledWith("longenough1");
    const [sql, params] = calls(/^insert into users/i)[0];
    expect(sql).toBe("insert into users (email, password_hash, role) values ($1, $2, $3) returning id");
    expect(params).toEqual(["new@x.co", "scrypt$NEW", "operator"]);
    expect(String(sql)).not.toContain("longenough1");
    expect(audits()).toEqual([[ADMIN_ID, "user.create", `user:${NEW_ID}`, "203.0.113.9"]]);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
  });
});

describe("setUserRole", () => {
  it.each([
    ["bad uuid", { id: "not-a-uuid", role: "viewer" }],
    ["bad role", { id: OTHER_ID, role: "root" }],
  ])("%s -> error, no query", async (_n, fields) => {
    expect(await setUserRole(undefined, form(fields))).toEqual({ error: expect.any(String) });
    expect(h.query).not.toHaveBeenCalled();
  });

  it("admin cannot demote their own account", async () => {
    expect(await setUserRole(undefined, form({ id: ADMIN_ID, role: "viewer" }))).toEqual({
      error: "You cannot demote your own account.",
    });
    expect(h.query).not.toHaveBeenCalled();
  });

  it("unknown user -> error, no audit row", async () => {
    h.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    expect(await setUserRole(undefined, form({ id: OTHER_ID, role: "viewer" }))).toEqual({ error: "User not found." });
    expect(audits()).toHaveLength(0);
  });

  it("happy path: parameterized update, audit row with the new role", async () => {
    expect(await setUserRole(undefined, form({ id: OTHER_ID, role: "operator" }))).toBeUndefined();
    expect(h.query).toHaveBeenCalledWith("update users set role = $1 where id = $2", ["operator", OTHER_ID]);
    expect(audits()).toEqual([[ADMIN_ID, "user.role:operator", `user:${OTHER_ID}`, "203.0.113.9"]]);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
  });
});

describe("setUserDisabled", () => {
  it.each([
    ["bad uuid", { id: "x", disabled: "true" }],
    ["bad flag", { id: OTHER_ID, disabled: "yes" }],
  ])("%s -> error, no query", async (_n, fields) => {
    expect(await setUserDisabled(undefined, form(fields))).toEqual({ error: expect.any(String) });
    expect(h.query).not.toHaveBeenCalled();
  });

  it("admin cannot disable their own account", async () => {
    expect(await setUserDisabled(undefined, form({ id: ADMIN_ID, disabled: "true" }))).toEqual({
      error: "You cannot disable your own account.",
    });
    expect(h.query).not.toHaveBeenCalled();
  });

  it("disable: update, then delete that user's sessions (forces logout), then audit", async () => {
    expect(await setUserDisabled(undefined, form({ id: OTHER_ID, disabled: "true" }))).toBeUndefined();
    expect(h.query).toHaveBeenNthCalledWith(1, "update users set disabled = $1 where id = $2", [true, OTHER_ID]);
    expect(h.query).toHaveBeenNthCalledWith(2, "delete from sessions where user_id = $1", [OTHER_ID]);
    expect(audits()).toEqual([[ADMIN_ID, "user.disable", `user:${OTHER_ID}`, "203.0.113.9"]]);
  });

  it("enable: update only, sessions untouched, audit", async () => {
    expect(await setUserDisabled(undefined, form({ id: OTHER_ID, disabled: "false" }))).toBeUndefined();
    expect(h.query).toHaveBeenCalledTimes(2); // update + audit
    expect(calls(/delete from sessions/i)).toHaveLength(0);
    expect(audits()[0][1]).toBe("user.enable");
  });
});

describe("resetUserPassword", () => {
  it.each([
    ["short password", { id: OTHER_ID, password: "short" }],
    ["bad uuid", { id: "nope", password: "longenough1" }],
    ["password over 1024", { id: OTHER_ID, password: "x".repeat(1025) }],
  ])("%s -> error, no hash, no query", async (_n, fields) => {
    expect(await resetUserPassword(undefined, form(fields))).toEqual({ error: expect.any(String) });
    expect(hashPassword).not.toHaveBeenCalled();
    expect(h.query).not.toHaveBeenCalled();
  });

  it("unknown user -> error, sessions untouched", async () => {
    h.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    expect(await resetUserPassword(undefined, form({ id: OTHER_ID, password: "longenough1" }))).toEqual({
      error: "User not found.",
    });
    expect(calls(/delete from sessions/i)).toHaveLength(0);
  });

  it("happy path: stores the hash, deletes sessions, audits; the plain password never reaches SQL or the audit", async () => {
    expect(await resetUserPassword(undefined, form({ id: OTHER_ID, password: "longenough1" }))).toBeUndefined();
    expect(hashPassword).toHaveBeenCalledWith("longenough1");
    expect(h.query).toHaveBeenNthCalledWith(1, "update users set password_hash = $1 where id = $2", ["scrypt$NEW", OTHER_ID]);
    expect(h.query).toHaveBeenNthCalledWith(2, "delete from sessions where user_id = $1", [OTHER_ID]);
    expect(JSON.stringify(h.query.mock.calls)).not.toContain("longenough1");
    expect(audits()).toEqual([[ADMIN_ID, "user.password_reset", `user:${OTHER_ID}`, "203.0.113.9"]]);
  });
});

const GATE_FIELDS = { id: "gate-9", name: "Gate 9", location: "Somewhere", lat: "18.7", lng: "99.1" };

describe("createGate", () => {
  it.each([
    ["id too long", { ...GATE_FIELDS, id: "gate-12345" }],
    ["id upper case", { ...GATE_FIELDS, id: "GATE-1" }],
    ["empty name", { ...GATE_FIELDS, name: "  " }],
    ["name over 100", { ...GATE_FIELDS, name: "n".repeat(101) }],
    ["location over 200", { ...GATE_FIELDS, location: "l".repeat(201) }],
    ["lat 91", { ...GATE_FIELDS, lat: "91" }],
    ["lng not a number", { ...GATE_FIELDS, lng: "abc" }],
    ["lng empty", { ...GATE_FIELDS, lng: "" }],
  ])("%s -> error, no query", async (_n, fields) => {
    expect(await createGate(undefined, form(fields))).toEqual({ error: expect.any(String) });
    expect(h.query).not.toHaveBeenCalled();
  });

  it("duplicate id -> friendly error", async () => {
    h.query.mockRejectedValueOnce(dupError());
    expect(await createGate(undefined, form(GATE_FIELDS))).toEqual({ error: "gate-9 already exists." });
    expect(audits()).toHaveLength(0);
  });

  it("happy path: parameterized insert, active on create, checkbox -> has_device, audit", async () => {
    expect(await createGate(undefined, form({ ...GATE_FIELDS, hasDevice: "on" }))).toBeUndefined();
    const [sql, params] = calls(/^insert into gates/i)[0];
    expect(sql).toBe(
      "insert into gates (id, name, location, lat, lng, has_device, active) values ($1, $2, $3, $4, $5, $6, true)",
    );
    expect(params).toEqual(["gate-9", "Gate 9", "Somewhere", 18.7, 99.1, true]);
    expect(audits()).toEqual([[ADMIN_ID, "gate.create", "gate:gate-9", "203.0.113.9"]]);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/gates");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("unchecked checkbox -> has_device false", async () => {
    await createGate(undefined, form(GATE_FIELDS));
    expect(calls(/^insert into gates/i)[0][1]).toEqual(["gate-9", "Gate 9", "Somewhere", 18.7, 99.1, false]);
  });
});

describe("updateGate", () => {
  it("bad id -> error, no query", async () => {
    expect(await updateGate(undefined, form({ ...GATE_FIELDS, id: "gate-x" }))).toEqual({ error: expect.any(String) });
    expect(h.query).not.toHaveBeenCalled();
  });

  it("unknown gate -> error, no audit", async () => {
    h.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    expect(await updateGate(undefined, form({ ...GATE_FIELDS, id: "gate-1" }))).toEqual({ error: "Gate not found." });
    expect(audits()).toHaveLength(0);
  });

  it("happy path: parameterized update of editable fields, id only in WHERE, audit", async () => {
    expect(await updateGate(undefined, form({ ...GATE_FIELDS, id: "gate-1", hasDevice: "on" }))).toBeUndefined();
    const [sql, params] = calls(/^update gates/i)[0];
    expect(sql).toBe(
      "update gates set name = $1, location = $2, lat = $3, lng = $4, has_device = $5, updated_at = now() where id = $6",
    );
    expect(params).toEqual(["Gate 9", "Somewhere", 18.7, 99.1, true, "gate-1"]);
    expect(audits()).toEqual([[ADMIN_ID, "gate.update", "gate:gate-1", "203.0.113.9"]]);
  });
});

describe("setGateActive", () => {
  it.each([
    ["bad id", { id: "gate-", active: "false" }],
    ["bad flag", { id: "gate-2", active: "0" }],
  ])("%s -> error, no query", async (_n, fields) => {
    expect(await setGateActive(undefined, form(fields))).toEqual({ error: expect.any(String) });
    expect(h.query).not.toHaveBeenCalled();
  });

  it("unknown gate -> error", async () => {
    h.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    expect(await setGateActive(undefined, form({ id: "gate-2", active: "false" }))).toEqual({ error: "Gate not found." });
  });

  it("deactivate: parameterized update (no delete), audit", async () => {
    expect(await setGateActive(undefined, form({ id: "gate-2", active: "false" }))).toBeUndefined();
    expect(h.query).toHaveBeenNthCalledWith(1, "update gates set active = $1, updated_at = now() where id = $2", [false, "gate-2"]);
    expect(calls(/delete/i)).toHaveLength(0);
    expect(audits()).toEqual([[ADMIN_ID, "gate.deactivate", "gate:gate-2", "203.0.113.9"]]);
  });

  it("activate: audit says gate.activate", async () => {
    await setGateActive(undefined, form({ id: "gate-2", active: "true" }));
    expect(audits()[0][1]).toBe("gate.activate");
  });
});
