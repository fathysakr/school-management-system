import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, forbidden, badRequest, serverError, success } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];

function getDayOfWeek(dateStr: string): string | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const day = d.getDay();
  return DAY_NAMES[day] || null;
}

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'substitutions:create')) return forbidden();

    const body = await request.json();
    const { date, absent_teacher_ids } = body;

    if (!date || !absent_teacher_ids || !Array.isArray(absent_teacher_ids) || absent_teacher_ids.length === 0) {
      return badRequest('يرجى تحديد التاريخ والمعلمين الغائبين');
    }

    const dayOfWeek = getDayOfWeek(date);
    if (!dayOfWeek) return badRequest('تاريخ غير صالح');

    const absentTeachers = await db.prepare(
      `SELECT id, first_name, last_name, specialization, school FROM teachers WHERE id IN (${absent_teacher_ids.map(() => '?').join(',')})`
    ).all(...absent_teacher_ids) as any[];
    if ((absentTeachers as any[]).length === 0) return badRequest('لم يتم العثور على المعلمين');

    const orphanedSchedules = await db.prepare(`
      SELECT s.*, c.class_name, c.grade,
        t.first_name as teacher_first, t.last_name as teacher_last, t.specialization, t.school,
        pt.period_number
      FROM schedules s
      JOIN classes c ON c.id = s.class_id
      JOIN teachers t ON t.id = s.teacher_id
      LEFT JOIN period_times pt ON pt.start_time = s.start_time AND pt.end_time = s.end_time
      WHERE s.teacher_id IN (${absent_teacher_ids.map(() => '?').join(',')})
        AND s.day_of_week = ? AND s.status = 'active'
      ORDER BY s.start_time
    `).all(...absent_teacher_ids, dayOfWeek) as any[];

    if (orphanedSchedules.length === 0) {
      return success({
        date, day_of_week: dayOfWeek, absent_teachers: absentTeachers,
        suggestions: [], message: 'لا توجد حصص للمعلمين الغائبين في هذا اليوم'
      });
    }

    const allTeachers = await db.prepare(
      `SELECT t.id, t.first_name, t.last_name, t.specialization, t.school
       FROM teachers t
       LEFT JOIN users u ON u.teacher_id = t.id OR u.id = t.user_id
       WHERE t.status = 'active'
         AND (u.id IS NULL OR u.role LIKE '%teacher%')`
    ).all() as any[];
    const absentSet = new Set(absent_teacher_ids.map(Number));

    const existingSubs = await db.prepare(
      `SELECT substitute_teacher_id, start_time FROM substitutions WHERE date = ? AND status IN ('pending','approved')`
    ).all(date) as any[];
    const subBusy = new Set<string>();
    for (const sub of existingSubs) {
      if (sub.substitute_teacher_id) subBusy.add(`${sub.substitute_teacher_id}-${sub.start_time}`);
    }

    const allSchedulesToday = await db.prepare(
      `SELECT teacher_id, start_time FROM schedules WHERE day_of_week = ? AND status = 'active'`
    ).all(dayOfWeek) as any[];
    const busySlots = new Set<string>();
    for (const s of allSchedulesToday) {
      busySlots.add(`${s.teacher_id}-${s.start_time}`);
    }

    const suggestions = [];
    for (const schedule of orphanedSchedules) {
      const available = allTeachers.filter((t: any) =>
        !absentSet.has(t.id) &&
        !busySlots.has(`${t.id}-${schedule.start_time}`) &&
        !subBusy.has(`${t.id}-${schedule.start_time}`)
      );

      const scored = available.map((t: any) => {
        let score = 0;
        if (t.specialization && schedule.subject.includes(t.specialization)) score += 3;
        if (t.school === schedule.school) score += 1;
        return { ...t, score };
      });
      scored.sort((a: any, b: any) => b.score - a.score);

      suggestions.push({
        schedule_id: schedule.id,
        class_id: schedule.class_id,
        class_name: schedule.class_name,
        subject: schedule.subject,
        day_of_week: dayOfWeek,
        period_number: schedule.period_number ?? null,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        absent_teacher: { id: schedule.teacher_id, name: `${schedule.teacher_first} ${schedule.teacher_last}` },
        suggested_teacher: scored.length > 0 ? {
          id: scored[0].id,
          name: `${scored[0].first_name} ${scored[0].last_name}`,
          specialization: scored[0].specialization,
          score: scored[0].score,
        } : null,
        alternatives: scored.slice(0, 3).map((t: any) => ({
          id: t.id, name: `${t.first_name} ${t.last_name}`, specialization: t.specialization, score: t.score,
        })),
      });
    }

    return success({
      date, day_of_week: dayOfWeek, absent_teachers: absentTeachers,
      suggestions_count: suggestions.length, suggestions,
    });
  } catch (error) {
    console.error('Suggest substitutions error:', error);
    return serverError('فشل في اقتراح البدائل');
  }
}
