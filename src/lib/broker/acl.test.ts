import { describe, expect, it } from "vitest";
import { renderAcl } from "./acl";

/** Split Mosquitto ACL text into { user -> lines } blocks; asserts nothing precedes the first `user` line. */
function blocks(acl: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  let cur: string[] | null = null;
  for (const line of acl.split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    if (line.startsWith("user ")) {
      cur = [];
      out.set(line.slice(5), cur);
    } else {
      if (!cur) throw new Error(`rule before any user line (anonymous grant): ${line}`);
      cur.push(line);
    }
  }
  return out;
}

describe("renderAcl", () => {
  const acl = renderAcl(["gate-1", "gate-2"]);
  const b = blocks(acl);

  it("gives each gate its own three lines", () => {
    for (const id of ["gate-1", "gate-2"]) {
      expect(b.get(id)).toEqual([
        `topic write gate/${id}/status`,
        `topic write gate/${id}/person`,
        `topic read gate/${id}/cmd`,
      ]);
    }
  });

  it("a gate block never mentions another gate", () => {
    expect(b.get("gate-1")!.join("\n")).not.toContain("gate-2");
    expect(b.get("gate-2")!.join("\n")).not.toContain("gate-1");
  });

  it("gate blocks never grant readwrite, # or +", () => {
    for (const id of ["gate-1", "gate-2"]) {
      for (const line of b.get(id)!) {
        expect(line).not.toMatch(/readwrite/);
        expect(line).not.toMatch(/[#+]/);
      }
    }
  });

  it("server block (default nextjs) reads telemetry, writes only commands, legacy included", () => {
    const s = b.get("nextjs")!;
    expect(s).toEqual([
      "topic read gate/+/status",
      "topic read gate/+/person",
      "topic write gate/+/cmd",
      "topic read stm32/status/all",
      "topic read water/gate/person",
      "topic write stm32/cmd",
    ]);
    for (const line of s.filter((l) => l.startsWith("topic write"))) {
      expect(line).not.toMatch(/status|person/);
    }
  });

  it("custom server user is used", () => {
    expect(blocks(renderAcl(["gate-1"], "web_app")).has("web_app")).toBe(true);
  });

  it("no rule appears before a user line", () => {
    expect(() => blocks(acl)).not.toThrow();
    expect(acl.split("\n").find((l) => l.trim() && !l.startsWith("#"))).toMatch(/^user /);
  });

  it("throws on an invalid gate id", () => {
    expect(() => renderAcl(["gate-1", "bad id"])).toThrow();
    expect(() => renderAcl(["gate-1\nuser root"])).toThrow();
    expect(() => renderAcl(["gate-12345"])).toThrow();
  });

  it("emits one block for a duplicated gate id", () => {
    const d = blocks(renderAcl(["gate-1", "gate-1"]));
    expect([...d.keys()]).toEqual(["nextjs", "gate-1"]);
  });

  it("throws when the legacy user equals the server user (blocks would merge)", () => {
    expect(() => renderAcl(["gate-1"], "nextjs", "nextjs")).toThrow();
    expect(() => renderAcl(["gate-1"], "web", "web")).toThrow();
  });

  describe("legacy device block", () => {
    it("is absent unless requested", () => {
      expect(b.size).toBe(3);
      expect(acl).not.toContain("stm32/#");
      expect(acl).not.toContain("TECH DEBT");
    });

    it("is present when requested, with the Pi topics and a TECH DEBT comment", () => {
      const out = renderAcl(["gate-1", "gate-2"], "nextjs", "pi_gate");
      const lb = blocks(out).get("pi_gate")!;
      expect(lb).toEqual([
        "topic readwrite stm32/#",
        "topic readwrite tank/#",
        "topic readwrite pump/cmd",
        "topic readwrite relay/cmd",
        "topic readwrite mode/cmd",
      ]);
      const lines = out.split("\n");
      const i = lines.indexOf("user pi_gate");
      expect(lines[i - 1]).toMatch(/^# TECH DEBT:.*delete/i);
    });

    it("has no line for a gate's own prefix, and gate blocks stay narrow", () => {
      const out = renderAcl(["gate-1", "gate-2"], "nextjs", "pi_gate");
      const bl = blocks(out);
      expect(bl.get("pi_gate")!.join("\n")).not.toMatch(/gate[/-]/);
      expect(bl.get("gate-1")!.join("\n")).not.toMatch(/readwrite|[#+]/);
    });

    it.each(["x\nuser root", "a b", "", "a\tb", "x".repeat(33), "pi;gate", "pi\r"])(
      "rejects legacy username %j",
      (u) => {
        expect(() => renderAcl(["gate-1"], "nextjs", u)).toThrow();
      },
    );

    it.each(["x\nuser root", "a b", "", "x".repeat(33)])("rejects server username %j", (u) => {
      expect(() => renderAcl(["gate-1"], u)).toThrow();
    });
  });
});
