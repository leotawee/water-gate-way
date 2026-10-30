import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, authErrorResponse } from "@/lib/auth/dal";
import { controlByUser } from "@/lib/auth/rateLimit";
import { parseCommand } from "@/lib/control/commands";
import { forwardCommand } from "@/lib/control/forward";
import { clientIp } from "@/lib/http/clientIp";

type AuditStatus = "sent" | "rejected" | "failed" | "rate_limited";

// CSRF: the browser sets Origin and Host; a cross-site page cannot forge either without a CORS preflight.
function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  if (origin === new URL(req.url).origin) return true;
  // WHY: nginx terminates TLS, so req.url may say http://upstream while the browser says https://public.
  const first = (v: string | null) => v?.split(",")[0]?.trim();
  const proto = first(req.headers.get("x-forwarded-proto"));
  const host = first(req.headers.get("x-forwarded-host")) || first(req.headers.get("host"));
  return !!proto && !!host && origin === `${proto}://${host}`;
}

async function audit(userId: string, command: string, status: AuditStatus, ip: string | null) {
  try {
    await db.query("insert into control_audit (user_id, command, status, ip) values ($1, $2, $3, $4)", [
      userId,
      command,
      status,
      ip,
    ]);
  } catch (e) {
    // WHY: a lost audit row must not report a command that reached the pumps as an error.
    console.error("[API /control] audit insert failed:", e);
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
