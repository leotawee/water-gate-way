import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const query = `
      SELECT id, device_id, water_height, measured_at 
      FROM water_levels 
      ORDER BY measured_at DESC;
    `;

    const { rows } = await db.query(query);

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
    // WHY: no file on failure; a 503 JSON error is distinguishable from a CSV download.
    console.error('[API /water-level/download] DB error:', error);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
}
