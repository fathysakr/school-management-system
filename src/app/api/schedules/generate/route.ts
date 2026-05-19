import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { authenticate } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'] as const;
const START_TIMES = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];
const END_TIMES = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

function schoolToGrade(school: string): string | null {
  if (school === 'middle') return 'متوسط';
  if (school === 'high') return 'ثانوي';
  return null;
}

function getTeacherSubjectNames(specialization: string | null): string[] {
  if (!specialization) return [];
  if (specialization.startsWith('[')) {
    try { return JSON.parse(specialization).map((item: any) => item.n); } catch { return []; }
  }
  return specialization.split(',').map((s: string) => s.trim());
}

function findAvailableTeacher(
  subjectName: string,
  teachers: any[],
  day: number,
  period: number,
  usedSlots: Set<string>,
  preferredTeacherId?: number | null
): number | null {
  if (preferredTeacherId) {
    const key = `${preferredTeacherId}-${day}-${period}`;
    if (!usedSlots.has(key)) return preferredTeacherId;
  }
  const matching = teachers.filter(t =>
    t.specialization && getTeacherSubjectNames(t.specialization).includes(subjectName)
  );
  for (const t of matching) {
    const key = `${t.id}-${day}-${period}`;
    if (!usedSlots.has(key)) return t.id;
  }
  for (const t of teachers) {
    const key = `${t.id}-${day}-${period}`;
    if (!usedSlots.has(key)) return t.id;
  }
  return null;
}

function interleave<T>(items: T[], key: (item: T) => string): T[] {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item);
    if (!groups[k]) groups[k] = [];
    groups[k].push(item);
  }
  const names = Object.keys(groups);
  names.sort(() => Math.random() - 0.5);
  const maxLen = Math.max(...names.map(n => groups[n].length));
  const result: T[] = [];
  for (let i = 0; i < maxLen; i++) {
    for (const name of names) {
      if (i < groups[name].length) result.push(groups[name][i]);
    }
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (!hasPermission(user.role, 'schedules:create')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 });
    }

    const body = await req.json();
    const school = body.school || 'all';
    const clearExisting = body.clear_existing !== false;

    if (!['all', 'middle', 'high'].includes(school)) {
      return NextResponse.json({ error: 'المرحلة غير صحيحة' }, { status: 400 });
    }

    const gradeFilter = school === 'all' ? null : schoolToGrade(school);
    const classes = await db.prepare(
      school === 'all'
        ? `SELECT c.*, c.grade as school_stage FROM classes c WHERE c.status = 'active'`
        : `SELECT c.*, c.grade as school_stage FROM classes c WHERE c.status = 'active' AND c.grade LIKE ?`
    ).all(...(school === 'all' ? [] : [`%${gradeFilter}%`])) as any[];

    if (classes.length === 0) {
      return NextResponse.json({ error: 'لا توجد فصول متاحة' }, { status: 400 });
    }

    const teachers = await db.prepare(
      school === 'all'
        ? `SELECT t.* FROM teachers t LEFT JOIN users u ON u.teacher_id = t.id WHERE t.status = 'active' AND (u.id IS NULL OR u.role LIKE '%teacher%')`
        : `SELECT t.* FROM teachers t LEFT JOIN users u ON u.teacher_id = t.id WHERE t.status = 'active' AND t.school = ? AND (u.id IS NULL OR u.role LIKE '%teacher%')`
    ).all(...(school === 'all' ? [] : [school])) as any[];

    const subjects = await db.prepare(
      school === 'all'
        ? `SELECT * FROM subjects`
        : `SELECT * FROM subjects WHERE school = ?`
    ).all(...(school === 'all' ? [] : [school])) as any[];

    if (subjects.length === 0) {
      return NextResponse.json({ error: 'لا توجد مواد دراسية. يرجى التأكد من تشغيل قاعدة البيانات' }, { status: 400 });
    }

    if (clearExisting) {
      const classIds = classes.map((c: any) => c.id);
      if (classIds.length > 0) {
        const placeholders = classIds.map(() => '?').join(',');
        await db.prepare(`DELETE FROM schedules WHERE class_id IN (${placeholders})`).run(...classIds);
      }
    }

    const teacherSlots = new Set<string>();
    const existingSchedules = await db.prepare(
      school === 'all'
        ? `SELECT * FROM schedules WHERE status = 'active'`
        : `SELECT s.* FROM schedules s JOIN classes c ON c.id = s.class_id WHERE s.status = 'active' AND c.grade LIKE ?`
    ).all(...(school === 'all' ? [] : [`%${gradeFilter}%`])) as any[];

    for (const s of existingSchedules as any[]) {
      const dayIdx = DAYS.indexOf(s.day_of_week);
      if (dayIdx === -1) continue;
      const periodIdx = START_TIMES.indexOf(s.start_time);
      if (periodIdx === -1) continue;
      if (s.teacher_id) {
        teacherSlots.add(`${s.teacher_id}-${dayIdx}-${periodIdx}`);
      }
    }

    type GridSlot = { subject: string; teacher_id: number | null } | null;
    const allEntries: any[] = [];
    const warnings: string[] = [];
    let totalGenerated = 0;

    for (const cls of classes) {
      const schoolStage = cls.school_stage?.includes('ثانوي') ? 'high' : 'middle';
      const classSubjects = subjects.filter((s: any) => s.school === schoolStage);

      const sessions: { subject: string; teacher_id: number | null }[] = [];
      for (const sub of classSubjects) {
        for (let i = 0; i < sub.sessions_per_week; i++) {
          sessions.push({ subject: sub.name, teacher_id: sub.teacher_id || null });
        }
      }

      const interleaved = interleave(sessions, s => s.subject);
      const grid: GridSlot[][] = Array.from({ length: 5 }, () => Array(8).fill(null));
      let si = 0;

      for (let d = 0; d < 5 && si < interleaved.length; d++) {
        for (let p = 0; p < 8 && si < interleaved.length; p++) {
          const session = interleaved[si];
          const tid = findAvailableTeacher(session.subject, teachers, d, p, teacherSlots, session.teacher_id);
          if (!tid) {
            const msg = `الصف ${cls.class_name || cls.id}: المادة "${session.subject}" ليس لها معلم متاح`;
            if (!warnings.includes(msg)) warnings.push(msg);
          }
          session.teacher_id = tid;
          grid[d][p] = { subject: session.subject, teacher_id: tid };
          if (tid) teacherSlots.add(`${tid}-${d}-${p}`);
          si++;
        }
      }

      for (let d = 0; d < 5; d++) {
        for (let p = 0; p < 8; p++) {
          const slot = grid[d][p];
          if (!slot) continue;
          allEntries.push({
            class_id: cls.id,
            teacher_id: slot.teacher_id,
            subject: slot.subject,
            day_of_week: DAYS[d],
            start_time: START_TIMES[p],
            end_time: END_TIMES[p],
          });
          totalGenerated++;
        }
      }
    }

    if (allEntries.length > 0) {
      const placeholders = allEntries.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
      const flatValues = allEntries.flatMap(e => [e.class_id, e.teacher_id, e.subject, e.day_of_week, e.start_time, e.end_time]);
      await db.prepare(
        `INSERT INTO schedules (class_id, teacher_id, subject, day_of_week, start_time, end_time) VALUES ${placeholders}`
      ).run(...flatValues);
    }

    return NextResponse.json({
      success: true,
      generated: totalGenerated,
      classes_count: classes.length,
      warnings: [...new Set(warnings)],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطأ في توليد الجدول';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
