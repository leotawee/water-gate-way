import { NextRequest, NextResponse } from "next/server";

const FASTAPI_BASE = process.env.FASTAPI_URL ?? "http://localhost:8000";

/**
 * POST /api/control
 * Forward a control command from the Next.js frontend to the FastAPI
 * backend (ai-receiver/main.py) which then blasts it over Serial TX.
 *
 * Body: { command: string }   e.g. { command: "P1" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.command || typeof body.command !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'command' field" },
        { status: 400 }
      );
    }

    const res = await fetch(`${FASTAPI_BASE}/api/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: body.command }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `FastAPI responded ${res.status}: ${text}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("[API /control] Forward error:", err);
    return NextResponse.json(
      { error: "Failed to forward command to FastAPI" },
      { status: 500 }
    );
  }
}
