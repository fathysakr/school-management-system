import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, serverError, success } from '@/lib/auth';
import { getSchoolStage } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const schoolOverride = searchParams.get('school') || undefined;
    const stage = getSchoolStage(user.role);
    const effectiveStage = stage === 'both' && schoolOverride ? schoolOverride : stage;
    const stageLikeMiddle = effectiveStage === 'both' ? null : (effectiveStage === 'middle' ? '%متوسط%' : '%ثانوي%');
    const stageParams = stageLikeMiddle ? [stageLikeMiddle] : [];

    const days = Math.min(parseInt(searchParams.get('days') || '14', 10), 60);

    // Build list of the last N dates in Saudi local time (AST = UTC+3)
    const now = new Date();
    now.setUTCHours(now.getUTCHours() + 3);
    const dates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
      dates.push(d.toISOString().slice(0, 10));
    }

    const rows = await db.prepare(`
      SELECT a.attendance_date as date,
        COUNT(*) as total,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN a.status = 'escape' THEN 1 ELSE 0 END) as escape_count
      FROM attendance a
      JOIN classes c ON a.class_id = c.id
      WHERE a.attendance_date IN (${dates.map(() => '?').join(',')})
      ${stageLikeMiddle ? 'AND c.grade LIKE ?' : ''}
      GROUP BY a.attendance_date
    `).all(...dates, ...stageParams) as any[];

    const byDate = new Map<string, any>();
    for (const r of rows) byDate.set(String(r.date), r);

    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    const trend = dates.map((date) => {
      const r = byDate.get(date);
      const total = Number(r?.total || 0);
      const present = Number(r?.present || 0);
      return {
        date,
        label: `${dayNames[new Date(date + 'T00:00:00Z').getUTCDay()]} ${date.slice(5)}`,
        rate: total > 0 ? Math.round((present / total) * 100) : null,
        present,
        absent: Number(r?.absent || 0),
        late: Number(r?.late || 0),
        escape: Number(r?.escape_count || 0),
        records: total,
      };
    });

    const withData = trend.filter((t) => t.records > 0);

    return success({
      trend,
      summary: {
        avgRate: withData.length > 0 ? Math.round(withData.reduce((s, t) => s + t.rate!, 0) / withData.length) : null,
        bestDay: withData.reduce<(typeof trend)[number] | null>((best, t) => (!best || (t.rate ?? 0) > (best.rate ?? 0) ? t : best), null),
        worstDay: withData.reduce<(typeof trend)[number] | null>((worst, t) => (!worst || (t.rate ?? 100) < (worst.rate ?? 100) ? t : worst), null),
        totalAbsences: trend.reduce((s, t) => s + t.absent, 0),
        totalEscapes: trend.reduce((s, t) => s + t.escape, 0),
        daysWithData: withData.length,
      },
    });
  } catch (error) {
    console.error('Analytics trends error:', error);
    return serverError('فشل في جلب مؤشرات الحضور');
  }
}
