import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, unauthorized, serverError, success } from '@/lib/auth';
import { hasPermission, getSchoolFilter } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'fees:view')) return forbidden();

    const today = new Date();
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    const todayStr = today.toISOString().slice(0, 10);

    const schoolFilter = getSchoolFilter(user.role);
    let schoolClause = '';
    const schoolParams: any[] = [];
    if (schoolFilter.school) {
      schoolClause = ' AND s.school = ?';
      schoolParams.push(schoolFilter.school);
    }

    const monthRow: any = await db.prepare(
      `SELECT COALESCE(SUM(p.amount),0) as total, COUNT(*) as cnt
       FROM payments p JOIN students s ON p.student_id = s.id
       WHERE p.payment_date >= ?${schoolClause}`
    ).get(monthStart, ...schoolParams);

    const todayRow: any = await db.prepare(
      `SELECT COALESCE(SUM(p.amount),0) as total
       FROM payments p JOIN students s ON p.student_id = s.id
       WHERE p.payment_date = ?${schoolClause}`
    ).get(todayStr, ...schoolParams);

    const terms: any[] = await db.prepare(
      `SELECT p.term, SUM(p.amount) as total, COUNT(*) as cnt
       FROM payments p JOIN students s ON p.student_id = s.id
       WHERE 1=1${schoolClause}
       GROUP BY p.term ORDER BY total DESC`
    ).all(...schoolParams);

    const arrears: any[] = await db.prepare(
      `SELECT s.id, s.student_id, s.first_name || ' ' || s.last_name AS student_name,
              s.grade, s.school,
              COALESCE(s.annual_fee, 0) as annual_fee,
              COALESCE(p.paid, 0) as paid
       FROM students s
       LEFT JOIN (
         SELECT student_id, SUM(amount) AS paid
         FROM payments
         GROUP BY student_id
       ) p ON p.student_id = s.id
       WHERE s.status = 'active'
         AND COALESCE(s.annual_fee, 0) > 0${schoolClause}
         AND COALESCE(p.paid, 0) < COALESCE(s.annual_fee, 0)
       ORDER BY (COALESCE(s.annual_fee, 0) - COALESCE(p.paid, 0)) DESC
       LIMIT 300`
    ).all(...schoolParams).then((rows: any[]) =>
      rows.map((r) => ({ ...r, remaining: r.annual_fee - r.paid }))
    );

    return success({
      month_total: monthRow?.total ?? 0,
      month_count: monthRow?.cnt ?? 0,
      today_total: todayRow?.total ?? 0,
      terms,
      arrears,
      arrears_total: arrears.reduce((sum, a) => sum + (a.remaining || 0), 0),
    });
  } catch (error) {
    console.error('Payments summary error:', error);
    return serverError('فشل في جلب ملخص الرسوم');
  }
}
