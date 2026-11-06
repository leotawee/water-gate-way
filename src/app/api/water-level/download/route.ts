import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser, authErrorResponse } from '@/lib/auth/dal';

const CSV_DAYS = 90;
const CSV_MAX_ROWS = 200_000;

export async function GET() {
  try {
    await requireUser();
    // WHY bounded: the old query read the whole table into a 256 MB container, so one viewer could take the app down
    // as the table grows. 90 days matches the retention in the system diagram.
    // shortcut: fixed window, no ?from/?to; add them when a customer needs a custom range.
    const query = `
      SELECT id, device_id, water_height, measured_at
      FROM water_levels
      WHERE measured_at >= now() - ($1::int * interval '1 day')
      ORDER BY measured_at DESC
      LIMIT $2;
    `;

    const { rows } = await db.query(query, [CSV_DAYS, CSV_MAX_ROWS]);

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
    const denied = authErrorResponse(error);
    if (denied) return denied;
    // WHY: no file on failure; a 503 JSON error is distinguishable from a CSV download.
    console.error('[API /water-level/download] DB error:', error);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
}
