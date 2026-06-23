import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: Number(process.env.PGPORT) || 5432,
});

const mockData = Array.from({ length: 24 }).map((_, i) => ({
  id: i + 1,
  device_id: 'mock_device',
  water_height: parseFloat((Math.random() * 2 + 10).toFixed(2)),
  measured_at: new Date(Date.now() - (15 - i) * 3600000).toISOString(),
}));

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
    console.error('[API /water-level] DB error, returning mock fallback:', error);
    return NextResponse.json(mockData);
  }
}
