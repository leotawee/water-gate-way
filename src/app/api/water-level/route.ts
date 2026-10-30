import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const query = `
      SELECT id, device_id, water_height, measured_at 
      FROM (
        SELECT id, device_id, water_height, measured_at 
        FROM water_levels 
        ORDER BY measured_at DESC 
        LIMIT 24
      ) sub 
      ORDER BY measured_at ASC;
    `;

    const { rows } = await db.query(query);
    return NextResponse.json(rows);
  } catch (error) {
    // WHY: 503 + generic body so the dashboard cannot mistake an outage for real data.
    console.error('[API /water-level] DB error:', error);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
}
