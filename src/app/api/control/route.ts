import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, authErrorResponse } from "@/lib/auth/dal";
import { controlByUser } from "@/lib/auth/rateLimit";
import { parseCommand } from "@/lib/control/commands";
import { forwardCommand } from "@/lib/control/forward";
import { clientIp } from "@/lib/http/clientIp";
import { sameOrigin } from "@/lib/http/sameOrigin";
import { isGateId } from "@/lib/gates";
import { getGate } from "@/lib/gatesDb";
import { LEGACY_GATE } from "@/lib/telemetry/topics";

type AuditStatus = "sent" | "rejected" | "failed" | "rate_limited";

// WHY: control_audit.status has a check constraint (001_auth.sql); the new gate rejections reuse
// "rejected" so no migration is needed. The error code in the response tells them apart.
const AUDIT_SQL = "insert into control_audit (user_id, command, status, ip, gate_id) values ($1, $2, $3, $4, $5)";

async function audit(userId: string, command: string, status: AuditStatus, ip: string | null, gateId: string | null) {
  try {
    await db.query(AUDIT_SQL, [userId, command, status, ip, gateId]);
  } catch (e) {
    // WHY: a lost audit row must not report a command that reached the pumps as an error.
    console.error("[API /control] audit insert failed:", e);
    if (ip === null) return;
    // WHY: defence in depth: an ip the inet column rejects must not drop the row; retry without it.
    try {
      await db.query(AUDIT_SQL, [userId, command, status, null, gateId]);
    } catch (e2) {
      console.error("[API /control] audit retry without ip failed:", e2);
    }
  }
}

/**
 * POST /api/control — body { command, gate? } (gate defaults to gate-1) → 200 { ok, command } | 400 | 401 | 403 | 404 | 409 | 429 | 502 | 503.
 * Every outcome after auth writes exactly one control_audit row.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let user;
  try {
    user = await requireUser("operator");
  } catch (e) {
    const denied = authErrorResponse(e);
    if (denied) return denied;
    console.error("[API /control] auth lookup failed:", e);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  const ip = clientIp(request.headers);

  let raw: unknown;
  let rawGate: unknown;
  try {
    const body = (await request.json()) as { command?: unknown; gate?: unknown } | null;
    raw = body?.command;
    rawGate = body?.gate;
  } catch {
    raw = undefined;
    rawGate = undefined;
  }
  // WHY: parsed before the command check so every audit row below carries the gate id when it is valid.
  const requested = rawGate === undefined ? LEGACY_GATE : rawGate;
  const gateId = isGateId(requested) ? requested : null;
  const cmd = parseCommand(raw);
  if (!cmd) {
    // WHY: column is NOT NULL; cap stored attacker text.
    await audit(user.id, typeof raw === "string" ? raw.slice(0, 32) : "", "rejected", ip, gateId);
    return NextResponse.json({ error: "invalid_command" }, { status: 400 });
  }

  const limit = controlByUser.hit(user.id);
  if (!limit.ok) {
    await audit(user.id, cmd, "rate_limited", ip, gateId);
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  if (!gateId) {
    await audit(user.id, cmd, "rejected", ip, null);
    return NextResponse.json({ error: "invalid_gate" }, { status: 400 });
  }
  let gate;
  try {
    gate = await getGate(gateId);
  } catch (e) {
    console.error("[API /control] gate lookup failed:", e);
    await audit(user.id, cmd, "failed", ip, gateId);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  if (!gate) {
    await audit(user.id, cmd, "rejected", ip, gateId);
    return NextResponse.json({ error: "unknown_gate" }, { status: 404 });
  }
  if (!gate.hasDevice) {
    await audit(user.id, cmd, "rejected", ip, gateId);
    return NextResponse.json({ error: "no_device" }, { status: 409 });
  }

  const outcome = await forwardCommand(gateId, cmd);
  await audit(user.id, cmd, outcome, ip, gateId);
  return outcome === "sent"
    ? NextResponse.json({ ok: true, command: cmd })
    : NextResponse.json({ error: "device_unavailable" }, { status: 502 });
}
