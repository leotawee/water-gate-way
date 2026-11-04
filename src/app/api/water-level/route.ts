import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser, authErrorResponse } from '@/lib/auth/dal';
import { isGateId } from '@/lib/gates';

// WHY: rows written before the per-gate migration still carry 'stm32-radar'; they belong to gate-1 until the backfill runs.
// TECH DEBT: drop the legacy clause once the backfill has run on every environment.
const GATE_FILTER = "(device_id = $1 OR ($1 = 'gate-1' AND device_id = 'stm32-radar'))";

export async function GET(request: Request) {
  try {
    await requireUser();
    const gate = new URL(request.url).searchParams.get('gate') ?? 'gate-1';
    if (!isGateId(gate)) return NextResponse.json({ error: 'invalid_gate' }, { status: 400 });
    const query = `
      SELECT id, device_id, water_height, measured_at 
      FROM (
        SELECT id, device_id, water_height, measured_at 
        FROM water_levels 
        WHERE ${GATE_FILTER}
        ORDER BY measured_at DESC 
        LIMIT 24
      ) sub 
      ORDER BY measured_at ASC;
    `;

    const { rows } = await db.query(query, [gate]);
    return NextResponse.json(rows);
  } catch (error) {
    const denied = authErrorResponse(error);
    if (denied) return denied;
    // WHY: 503 + generic body so the dashboard cannot mistake an outage for real data.
    console.error('[API /water-level] DB error:', error);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
}
