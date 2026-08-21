import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, forbidden, badRequest, serverError, success } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    const rows = await db.prepare('SELECT period_number, start_time, end_time FROM period_times ORDER BY period_number').all() as any[];
    const periods: Record<number, { start: string; end: string }> = {};
    for (const row of rows) {
      periods[row.period_number] = { start: row.start_time, end: row.end_time };
    }
    return success({ periods });
  } catch (error) {
    console.error('Get period times error:', error);
    return serverError('فشل في جلب أوقات الحصص');
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const body = await request.json();
    const { periods } = body;

    if (!periods || typeof periods !== 'object') {
      return badRequest('بيانات الأوقات غير صالحة');
    }

    const stmt = await db.prepare('UPDATE period_times SET start_time = ?, end_time = ? WHERE period_number = ?');
    for (const [num, times] of Object.entries(periods)) {
      const pn = parseInt(num);
      const t = times as { start: string; end: string };
      if (isNaN(pn) || !t.start || !t.end) continue;
      const result = await stmt.run(t.start, t.end, pn);
      if (result.changes === 0) {
        await db.prepare('INSERT INTO period_times (period_number, start_time, end_time) VALUES (?, ?, ?)').run(pn, t.start, t.end);
      }
    }

    return success({ message: 'تم تحديث أوقات الحصص بنجاح' });
  } catch (error) {
    console.error('Update period times error:', error);
    return serverError('فشل في تحديث أوقات الحصص');
  }
}
