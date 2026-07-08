import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, forbidden, badRequest, success } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { sanitizeString } from '@/lib/validation';
import { parseSchedulePdf } from '@/lib/pdf-schedule-parser';

const SCHOOL_MAP: Record<string, string> = { '1': 'middle', '2': 'middle', '3': 'high' };

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'schedules:create')) return forbidden();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return badRequest('الملف مطلوب');
    if (!file.name.toLowerCase().endsWith('.pdf')) return badRequest('يرجى رفع ملف PDF');

    const schoolParam = (formData.get('school') as string) || 'middle';
    if (!['middle', 'high'].includes(schoolParam)) return badRequest('المرحلة غير صحيحة');
    const clearExisting = formData.get('clear_existing') === 'true';

    const buffer = new Uint8Array(await file.arrayBuffer());
    const parsed = await parseSchedulePdf(buffer);

    const [existingTeachers, existingClasses, existingSubjects] = await Promise.all([
      db.prepare('SELECT id, first_name, last_name FROM teachers WHERE status = ?').all('active'),
      db.prepare('SELECT id, class_name, grade, section FROM classes WHERE status = ?').all('active'),
      db.prepare('SELECT id, name, school, grade FROM subjects').all(),
    ]) as [any[], any[], any[]];

    const teacherByName = new Map<string, number>();
    for (const t of existingTeachers) {
      const key = `${t.first_name} ${t.last_name}`.trim();
      teacherByName.set(key, t.id);
    }

    const classByKey = new Map<string, number>();
    for (const c of existingClasses) {
      const key = `${c.grade}-${c.section || c.class_name}`;
      classByKey.set(key, c.id);
    }

    const subjectByNameSchool = new Map<string, number>();
    for (const s of existingSubjects) {
      subjectByNameSchool.set(`${s.name}|${s.school}|${s.grade || ''}`, s.id);
    }

    const createdTeachers: number[] = [];
    const createdClasses: number[] = [];
    const createdSubjects: number[] = [];
    let insertedSchedules = 0;
    let skippedExisting = 0;

    if (clearExisting) {
      const classIds = new Set<number>();
      for (const cls of parsed.classes) {
        const existingId = classByKey.get(cls.classId);
        if (existingId) classIds.add(existingId);
      }
      if (classIds.size > 0) {
        const ids = Array.from(classIds);
        const placeholders = ids.map(() => '?').join(',');
        await db.prepare(`DELETE FROM schedules WHERE class_id IN (${placeholders})`).run(...ids);
      }
    }

    const getOrCreateTeacher = async (fullName: string): Promise<number> => {
      const existing = teacherByName.get(fullName);
      if (existing) return existing;

      const parts = fullName.trim().split(/\s+/);
      const firstName = parts[0] || fullName;
      const lastName = parts.slice(1).join(' ') || 'غير محدد';
      const tid = `PDF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const result = await db.prepare(
        'INSERT INTO teachers (teacher_id, first_name, last_name, email, school, status) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(tid, sanitizeString(firstName), sanitizeString(lastName), null, schoolParam, 'active');

      const id = Number(result.lastInsertRowid);
      teacherByName.set(fullName, id);
      createdTeachers.push(id);
      return id;
    };

    const getOrCreateClass = async (classId: string, grade: string, section: string): Promise<number> => {
      const existing = classByKey.get(classId);
      if (existing) return existing;

      const result = await db.prepare(
        'INSERT INTO classes (class_name, grade, section, status) VALUES (?, ?, ?, ?)'
      ).run(section, grade, null, 'active');

      const id = Number(result.lastInsertRowid);
      classByKey.set(classId, id);
      createdClasses.push(id);
      return id;
    };

    const getOrCreateSubject = async (name: string, school: string, grade: string): Promise<number> => {
      const key = `${name}|${school}|${grade}`;
      const existing = subjectByNameSchool.get(key);
      if (existing) return existing;

      const result = await db.prepare(
        'INSERT INTO subjects (name, school, grade, sessions_per_week) VALUES (?, ?, ?, ?)'
      ).run(sanitizeString(name), school, grade, 3);

      const id = Number(result.lastInsertRowid);
      subjectByNameSchool.set(key, id);
      createdSubjects.push(id);
      return id;
    };

    const insertSchedule = db.prepare(
      `INSERT INTO schedules (class_id, teacher_id, subject, day_of_week, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`
    );

    const linkSubjectClass = db.prepare(
      'INSERT OR IGNORE INTO subject_classes (subject_id, class_id, sessions_per_week) VALUES (?, ?, ?)'
    );

    const teacherSubjects = new Map<number, Map<string, { sessions: Set<string>; classes: Set<number> }>>();

    for (const cls of parsed.classes) {
      const grade = cls.grade;
      const school = SCHOOL_MAP[grade] || schoolParam;
      const dbClassId = await getOrCreateClass(cls.classId, grade, cls.section);

      const processedPairs = new Set<string>();

      for (const entry of parsed.entries.filter(e => e.classId === cls.classId)) {
        const teacherId = await getOrCreateTeacher(entry.teacher);
        const subjectId = await getOrCreateSubject(entry.subject, school, grade);

        const pairKey = `${subjectId}:${dbClassId}`;
        if (!processedPairs.has(pairKey)) {
          await linkSubjectClass.run(subjectId, dbClassId, 3);
          processedPairs.add(pairKey);
        }

        if (!clearExisting) {
          const existing = await db.prepare(
            'SELECT id FROM schedules WHERE class_id = ? AND day_of_week = ? AND start_time = ? AND status = ?'
          ).get(dbClassId, entry.day, entry.startTime, 'active') as any;
          if (existing) { skippedExisting++; continue; }
        }

        await insertSchedule.run(dbClassId, teacherId, sanitizeString(entry.subject), entry.day, entry.startTime, entry.endTime);
        insertedSchedules++;

        let subMap = teacherSubjects.get(teacherId);
        if (!subMap) { subMap = new Map(); teacherSubjects.set(teacherId, subMap); }
        let subData = subMap.get(entry.subject);
        if (!subData) { subData = { sessions: new Set(), classes: new Set() }; subMap.set(entry.subject, subData); }
        subData.sessions.add(`${entry.day}-${entry.startTime}`);
        subData.classes.add(dbClassId);
      }
    }

    const updateSpec = db.prepare('UPDATE teachers SET specialization = ? WHERE id = ?');
    for (const [tid, subMap] of teacherSubjects) {
      const arr: any[] = [];
      for (const [subName, data] of subMap) {
        arr.push({ n: subName, s: data.sessions.size, classes: Array.from(data.classes) });
      }
      if (arr.length > 0) updateSpec.run(JSON.stringify(arr), tid);
    }

    return success({
      message: 'تم استيراد الجدول بنجاح',
      summary: {
        classes: parsed.classes.length,
        created_classes: createdClasses.length,
        teachers: parsed.teachers.length,
        created_teachers: createdTeachers.length,
        subjects: parsed.subjects.length,
        created_subjects: createdSubjects.length,
        schedules: insertedSchedules,
        skipped_existing: skippedExisting,
      },
    });
  } catch (error: any) {
    console.error('Upload PDF schedule error:', error);
    const msg = error.message || 'فشل استيراد الجدول من PDF';
    const debugData = error.debugData || null;
    let fullMsg = msg;
    if (debugData) {
      fullMsg += ` (pages: ${debugData.numPages}, items per page: [${(debugData.itemsPerPage || []).join(',')}])`;
      fullMsg += `\n\n--- النص الكامل ---\n${(debugData.textSample || '').substring(0, 5000)}`;
    }
    return Response.json({
      error: fullMsg,
      stack: (error.stack || '').split('\n').slice(0, 10).join('\n'),
      debug: debugData,
    }, { status: 400 });
  }
}
