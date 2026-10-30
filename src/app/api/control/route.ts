import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, authErrorResponse } from "@/lib/auth/dal";
import { controlByUser } from "@/lib/auth/rateLimit";
import { parseCommand } from "@/lib/control/commands";
import { forwardCommand } from "@/lib/control/forward";
import { clientIp } from "@/lib/http/clientIp";
import { sameOrigin } from "@/lib/http/sameOrigin";

type AuditStatus = "sent" | "rejected" | "failed" | "rate_limited";

const AUDIT_SQL = "insert into control_audit (user_id, command, status, ip) values ($1, $2, $3, $4)";

async function audit(userId: string, command: string, status: AuditStatus, ip: string | null) {
  try {
    await db.query(AUDIT_SQL, [userId, command, status, ip]);
  } catch (e) {
    // WHY: a lost audit row must not report a command that reached the pumps as an error.
    console.error("[API /control] audit insert failed:", e);
    if (ip === null) return;
    // WHY: defence in depth: an ip the inet column rejects must not drop the row; retry without it.
    try {
      await db.query(AUDIT_SQL, [userId, command, status, null]);
    } catch (e2) {
      console.error("[API /control] audit retry without ip failed:", e2);
    }
  }
}

/**
 * POST /api/control — body { command } → 200 { ok, command } | 400 | 401 | 403 | 429 | 502.
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
  try {
    raw = ((await request.json()) as { command?: unknown } | null)?.command;
  } catch {
    raw = undefined;
  }
  const cmd = parseCommand(raw);
  if (!cmd) {
    // WHY: column is NOT NULL; cap stored attacker text.
    await audit(user.id, typeof raw === "string" ? raw.slice(0, 32) : "", "rejected", ip);
    return NextResponse.json({ error: "invalid_command" }, { status: 400 });
  }

  const limit = controlByUser.hit(user.id);
  if (!limit.ok) {
    await audit(user.id, cmd, "rate_limited", ip);
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const outcome = await forwardCommand(cmd);
  await audit(user.id, cmd, outcome, ip);
  return outcome === "sent"
    ? NextResponse.json({ ok: true, command: cmd })
    : NextResponse.json({ error: "device_unavailable" }, { status: 502 });
}
