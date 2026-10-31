import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// WHY: vitest only collects src/**/*.test.ts, so the guard lives here and reads the migration by path.
const sql = readFileSync(new URL("../../db/migrations/002_admin.sql", import.meta.url), "utf8").toLowerCase();

describe("002_admin.sql", () => {
  // WHY: cheap guard against a destructive edit: the migration must only add objects and never touch public.*
  it.each(["drop", "delete", "truncate", "alter table public", "update public"])("never contains %j", (word) => {
    expect(sql).not.toContain(word);
  });

  it("creates the new tables idempotently", () => {
    expect(sql).toContain("create table if not exists gates");
    expect(sql).toContain("create table if not exists admin_audit");
  });
});
