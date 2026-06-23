import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: Number(process.env.PGPORT) || 5432,
});

const mockCsv = `id,device_id,water_height,measured_at
1,mock_device,12.5,2026-05-16T14:00:00.000Z
2,mock_device,11.8,2026-05-16T13:00:00.000Z`;

export async function GET() {
  try {
    const query = `
      SELECT id, device_id, water_height, measured_at 
      FROM water_levels 
      ORDER BY measured_at DESC;
    `;

    const { rows } = await pool.query(query);

    const csvHeader = 'id,device_id,water_height,measured_at\n';
    const csvRows = rows
      .map(
        (r) =>
          `${r.id},${r.device_id},${r.water_height},${new Date(
            r.measured_at
          ).toISOString()}`
      )
      .join('\n');

    return new NextResponse(csvHeader + csvRows, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="water_levels_report.csv"',
      },
    });
  } catch (error) {
    console.error('[API /water-level/download] DB error, returning mock fallback:', error);
    return new NextResponse(mockCsv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="water_levels_report.csv"',
      },
    });
  }
}
