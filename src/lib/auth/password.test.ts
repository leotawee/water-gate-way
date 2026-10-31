import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { hashPassword, verifyPassword, needsRehash } from "./password";

// WHY: cost 4 keeps the fixture fast; verifyPassword accepts costs 4..12.
const LEGACY = bcrypt.hashSync("correct horse", 4);

describe("verifyPassword: legacy bcrypt rows", () => {
  it("bcrypt hash verifies with the right password, rejects the wrong one", async () => {
    expect(await verifyPassword("correct horse", LEGACY)).toBe(true);
    expect(await verifyPassword("wrong", LEGACY)).toBe(false);
  });

  it("cost 31 is rejected without running bcrypt (a tampered row must not pick the cost)", async () => {
    // WHY: a real cost-31 hash would take hours to compute; returning false immediately proves it is never run.
    const cost31 = "$2b$31$" + "A".repeat(53);
    await expect(verifyPassword("x", cost31)).resolves.toBe(false);
  });

  it("input over 72 bytes is rejected even when its first 72 bytes match", async () => {
    const long = bcrypt.hashSync("a".repeat(72), 4);
    expect(await verifyPassword("a".repeat(72), long)).toBe(true);
    expect(await verifyPassword("a".repeat(72) + "anything", long)).toBe(false);
  });

  it("cost below 4 is rejected", async () => {
    const cost3 = bcrypt.hashSync("x", 4).replace("$04$", "$03$");
    await expect(verifyPassword("x", cost3)).resolves.toBe(false);
  });

  it.each(["$2b$10$short", "$2b$10$" + "A".repeat(53) + "extra", "$2z$10$" + "A".repeat(53)])(
    "malformed $2 string %j returns false, never throws",
    async (s) => {
      await expect(verifyPassword("x", s)).resolves.toBe(false);
    },
  );
});

describe("needsRehash", () => {
  it("true for bcrypt rows", () => {
    expect(needsRehash(LEGACY)).toBe(true);
  });

  it("false for scrypt rows", async () => {
    expect(needsRehash(await hashPassword("any-password-1"))).toBe(false);
  });

  it("true for any non-scrypt value", () => {
    expect(needsRehash("GOOD_HASH")).toBe(true);
  });
});
