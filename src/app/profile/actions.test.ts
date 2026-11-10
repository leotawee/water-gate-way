import { describe, it, expect, vi, beforeEach } from "vitest";

const USER_ID = "00000000-0000-4000-8000-000000000001";

const h = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; role: string },
  query: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
}));

vi.mock("@/lib/db", () => {
  h.query = vi.fn(async () => ({ rows: [], rowCount: 1 }));
  return { db: { query: h.query } };
});

// Fake DAL: same contract as src/lib/auth/dal.ts without cookies/DB (same shape as the admin actions test).
vi.mock("@/lib/auth/dal", async () => {
  class AuthError extends Error {
    constructor(readonly code: "unauthenticated" | "forbidden") {
      super(code);
      this.name = "AuthError";
    }
  }
  return {
    AuthError,
    requireUser: vi.fn(async () => {
      if (!h.user) throw new AuthError("unauthenticated");
      return h.user;
    }),
  };
});

vi.mock("@/lib/http/clientIp", () => ({ clientIp: vi.fn(async () => "203.0.113.9") }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateProfile, uploadAvatar } from "./actions";
import { isWebpBytes } from "@/lib/profile/webp";

const formData = (kv: Record<string, string | File>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(kv)) f.set(k, v);
  return f;
};

const WEBP = new Uint8Array(Buffer.from("RIFF0000WEBPtestdata"));

describe("isWebpBytes", () => {
  it("accepts the RIFF/WEBP magic", () => {
    expect(isWebpBytes(WEBP)).toBe(true);
  });
  it("rejects other magic bytes", () => {
    expect(isWebpBytes(new Uint8Array(Buffer.from("RIFF0000PNGGdata")))).toBe(false);
    expect(isWebpBytes(new Uint8Array(Buffer.from("short")))).toBe(false);
  });
});

describe("updateProfile", () => {
  beforeEach(() => {
    h.user = { id: USER_ID, email: "op@example.com", role: "operator" };
    h.query.mockClear();
  });

  it("rejects unauthenticated callers", async () => {
    h.user = null;
    const res = await updateProfile(undefined, formData({ display_name: "สมชาย" }));
    expect(res?.error).toBe("ต้องเข้าสู่ระบบก่อน");
    expect(h.query).not.toHaveBeenCalled();
  });

  it("rejects a malformed phone without touching the database", async () => {
    const res = await updateProfile(undefined, formData({ phone: "abc" }));
    expect(res?.error).toContain("เบอร์โทร");
    expect(h.query).not.toHaveBeenCalled();
  });

  it("rejects a malformed LINE ID", async () => {
    const res = await updateProfile(undefined, formData({ line_id: "has space" }));
    expect(res?.error).toContain("LINE ID");
    expect(h.query).not.toHaveBeenCalled();
  });

  it("saves trimmed values and writes an audit row", async () => {
    const res = await updateProfile(
      undefined,
      formData({ display_name: "  สมชาย ใจดี  ", phone: "0812345678", line_id: "my.line" }),
    );
    expect(res?.ok).toBe(true);
    const update = h.query.mock.calls.find((c) => String(c[0]).includes("update users"));
    expect(update?.[1]).toEqual(["สมชาย ใจดี", "0812345678", "my.line", USER_ID]);
    expect(h.query.mock.calls.some((c) => String(c[0]).includes("insert into action_audit"))).toBe(true);
  });

  it("stores empty strings as NULL when a field is cleared", async () => {
    const res = await updateProfile(undefined, formData({ phone: "" }));
    expect(res?.ok).toBe(true);
    const update = h.query.mock.calls.find((c) => String(c[0]).includes("update users"));
    expect(update?.[1]).toEqual(["", "", "", USER_ID]);
  });
});

describe("uploadAvatar", () => {
  beforeEach(() => {
    h.user = { id: USER_ID, email: "op@example.com", role: "operator" };
    h.query.mockClear();
  });

  it("rejects uploads that are not WebP", async () => {
    const png = new File([new Uint8Array(Buffer.from("\x89PNG\r\n\x1a\n"))], "a.png", { type: "image/png" });
    const res = await uploadAvatar(undefined, formData({ file: png }));
    expect(res?.error).toContain("WebP");
    expect(h.query).not.toHaveBeenCalled();
  });

  it("rejects oversized uploads", async () => {
    const big = new File([new Uint8Array(400_000).fill(0x52)], "a.webp", { type: "image/webp" });
    const res = await uploadAvatar(undefined, formData({ file: big }));
    expect(res?.error).toContain("300 KB");
    expect(h.query).not.toHaveBeenCalled();
  });

  it("stores a valid WebP payload and writes an audit row", async () => {
    const f = new File([WEBP], "a.webp", { type: "image/webp" });
    const res = await uploadAvatar(undefined, formData({ file: f }));
    expect(res?.ok).toBe(true);
    const update = h.query.mock.calls.find((c) => String(c[0]).includes("avatar_webp"));
    expect(update).toBeTruthy();
    expect(h.query.mock.calls.some((c) => String(c[0]).includes("insert into action_audit"))).toBe(true);
  });
});
