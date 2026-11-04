import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// WHY: vitest only collects src/**/*.test.ts, so the guard lives here and reads the migration by path.
const raw = readFileSync(new URL("../../db/migrations/004_multi_gate.sql", import.meta.url), "utf8").toLowerCase();
const lines = raw.split("\n");
const code = lines.filter((l) => !l.trim().startsWith("--"));
const body = code.join("\n");

describe("004_multi_gate.sql", () => {
  // WHY: cheap guard against a destructive edit: the migration must only add objects.
  it.each(["drop", "truncate", "delete from"])("never contains %j", (word) => {
    expect(raw).not.toContain(word);
  });

  it("every alter table line adds a column idempotently", () => {
    const alters = code.filter((l) => l.includes("alter table"));
    expect(alters.length).toBe(5);
    for (const l of alters) expect(l).toContain("add column if not exists");
  });

  it("adds the expected columns", () => {
    expect(body).toContain("alter table gates add column if not exists media_base_url text;");
    expect(body).toContain("alter table gates add column if not exists cameras text[] not null default '{}';");
    expect(body).toContain("alter table gates add column if not exists enrolled_at timestamptz;");
    expect(body).toContain("alter table gates add column if not exists last_seen_at timestamptz;");
    expect(body).toContain("alter table control_audit add column if not exists gate_id text;");
  });

  it("creates the water_levels index idempotently", () => {
    expect(body).toContain(
      "create index if not exists water_levels_device_time_idx on water_levels (device_id, measured_at);",
    );
  });

  it("keeps the backfill inside a comment only", () => {
    const stmt = "update water_levels set device_id = 'gate-1' where device_id = 'stm32-radar'";
    expect(body).not.toContain("update ");
    const hits = lines.filter((l) => l.includes(stmt));
    expect(hits.length).toBeGreaterThan(0);
    for (const l of hits) expect(l.trim().startsWith("--")).toBe(true);
  });
});
