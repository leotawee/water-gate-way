import { isGateId } from "@/lib/gates";

// WHY: a username lands on a `user <name>` line; whitespace or a newline would inject extra ACL lines.
const USER_RE = /^[A-Za-z0-9_]{1,32}$/;

function checkUser(label: string, v: string): string {
  if (!USER_RE.test(v)) throw new Error(`invalid ${label}: must match ${USER_RE}`);
  return v;
}

/**
 * Mosquitto `acl_file` text. Every rule sits under a `user` line: rules before the first
 * `user` line apply to anonymous clients.
 * - server user: read telemetry from every gate, write commands only (legacy topics included).
 * - one block per gate: write its own status/person, read its own cmd. Never `readwrite`, `#` or `+`.
 * - optional legacy device block: keeps the existing Pi account working during dual-publish.
 */
export function renderAcl(gateIds: string[], serverUser = "nextjs", legacyDeviceUser?: string): string {
  checkUser("server user", serverUser);
  if (legacyDeviceUser !== undefined) checkUser("legacy device user", legacyDeviceUser);
  for (const id of gateIds) if (!isGateId(id)) throw new Error(`invalid gate id: ${JSON.stringify(id)}`);

  const out: string[] = [
    `user ${serverUser}`,
    "topic read gate/+/status",
    "topic read gate/+/person",
    "topic write gate/+/cmd",
    "topic read stm32/status/all",
    "topic read water/gate/person",
    "topic write stm32/cmd",
  ];
  for (const id of new Set(gateIds)) {
    out.push(
      "",
      `user ${id}`,
      `topic write gate/${id}/status`,
      `topic write gate/${id}/person`,
      `topic read gate/${id}/cmd`,
    );
  }
  if (legacyDeviceUser !== undefined) {
    out.push(
      "",
      "# TECH DEBT: delete this block once the Pi publishes gate/<id>/... topics (see docs/ops/gate-topic-contract.md).",
      `user ${legacyDeviceUser}`,
      "topic readwrite stm32/#",
      "topic readwrite tank/#",
      "topic readwrite pump/cmd",
      "topic readwrite relay/cmd",
      "topic readwrite mode/cmd",
    );
  }
  return out.join("\n") + "\n";
}
