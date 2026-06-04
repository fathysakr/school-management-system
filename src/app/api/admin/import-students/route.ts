import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, serverError, success } from '@/lib/auth';
import studentsData from '@/data/import-students.json';

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user || user.role !== 'admin') return unauthorized();

    const students = studentsData;
    let created = 0, enrolled = 0, errors = 0;

    // Ensure classes exist
    const classKeys = new Set<string>();
    for (const s of students) {
      const key = `${s.grade}|${s.class_name}`;
      if (classKeys.has(key)) continue;
      classKeys.add(key);
      const sectionLetter = s.class_name.split('/')[1];
      try {
        await db.prepare(`INSERT OR IGNORE INTO classes (class_name, grade, section, teacher_id, room_number, capacity, status, school) VALUES (?,?,?,NULL,'',40,'active',?)`).run(s.class_name, s.grade, sectionLetter, s.school || 'high');
      } catch {}
    }

    for (const s of students) {
      try {
        const existing = await db.prepare("SELECT id, grade FROM students WHERE student_id = ?").get(s.student_id);
        let studentId: number;
        if (!existing) {
          const r = await db.prepare(`INSERT INTO students (student_id, first_name, last_name, date_of_birth, enrollment_date, school, semester, status, grade) VALUES (?,?,?,?,?,?,?,?,?)`).run(
            s.student_id, s.first_name, s.last_name, s.date_of_birth || '2007-01-01', s.enrollment_date || '2024-09-01', s.school || 'high', s.semester || '', 'active', s.grade || ''
          );
          studentId = r.lastInsertRowid as number;
          created++;
        } else {
          studentId = existing.id;
          if (!existing.grade && s.grade) {
            await db.prepare("UPDATE students SET grade = ? WHERE id = ?").run(s.grade, existing.id);
          }
        }

        const cls = await db.prepare("SELECT id FROM classes WHERE class_name = ? AND grade = ?").get(s.class_name, s.grade);
        if (cls) {
          const already = await db.prepare("SELECT id FROM enrollments WHERE student_id = ? AND class_id = ?").get(studentId, cls.id);
          if (!already) {
            await db.prepare("INSERT INTO enrollments (student_id, class_id, enrollment_date, status) VALUES (?,?,?,?)").run(studentId, cls.id, s.enrollment_date || '2024-09-01', 'active');
            enrolled++;
          }
        }
      } catch (e) {
        console.error('Import error for', s.student_id, e);
        errors++;
      }
    }

    return success({ created, enrolled, errors, total: students.length });
  } catch (error) {
    console.error('Import students error:', error);
    return serverError('فشل استيراد الطلاب');
  }
}
