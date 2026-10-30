import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: Number(process.env.PGPORT) || 5432,
});

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

    const { rows } = await pool.query(query);
    return NextResponse.json(rows);
  } catch (error) {
    // WHY: 503 + generic body so the dashboard cannot mistake an outage for real data.
    console.error('[API /water-level] DB error:', error);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
}
