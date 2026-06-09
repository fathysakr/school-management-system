import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, badRequest, serverError, success } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'students:edit')) return unauthorized();

    const classId = parseInt(params.id);
    if (isNaN(classId)) return badRequest('معرف الفصل غير صالح');

    const classRow = await db.prepare('SELECT id, class_name, grade, capacity FROM classes WHERE id = ? AND status = ?').get(classId, 'active') as any;
    if (!classRow) return badRequest('الفصل غير موجود');

    const body = await request.json();
    const students = body.students;
    if (!Array.isArray(students) || students.length === 0) return badRequest('يرجى إرسال قائمة الطلاب');

    const currentCount = (await db.prepare('SELECT COUNT(*) as count FROM enrollments WHERE class_id = ? AND status = ?').get(classId, 'active') as any)?.count || 0;
    const available = classRow.capacity - currentCount;

    let created = 0, enrolled = 0, errors = 0, skipped = 0;

    for (const s of students) {
      try {
        const studentId = String(s.student_id || '').trim();
        const firstName = String(s.first_name || s.firstName || '').trim();
        const lastName = String(s.last_name || s.lastName || '').trim();
        if (!studentId || !firstName || !lastName) { errors++; continue; }

        if (enrolled >= available) { errors++; continue; }

        let fullName = firstName;
        if (lastName) fullName += ' ' + lastName;

        const existing = await db.prepare('SELECT id, grade FROM students WHERE student_id = ?').get(studentId) as any;
        let studentDbId: number;

        if (!existing) {
          const parts = fullName.split(' ');
          const fn = parts[0] || firstName;
          const ln = parts.slice(1).join(' ') || lastName || firstName;
          const r = await db.prepare(`INSERT INTO students (student_id, first_name, last_name, date_of_birth, enrollment_date, school, semester, status, grade) VALUES (?,?,?,?,?,?,?,?,?)`).run(
            studentId, fn, ln, '2007-01-01', new Date().toISOString().split('T')[0], classRow.grade.includes('ثانوي') ? 'high' : 'middle', '', 'active', classRow.grade
          );
          studentDbId = r.lastInsertRowid as number;
          created++;
        } else {
          studentDbId = existing.id;
        }

        const already = await db.prepare('SELECT id FROM enrollments WHERE student_id = ? AND class_id = ? AND status = ?').get(studentDbId, classId, 'active') as any;
        if (!already) {
          await db.prepare("INSERT INTO enrollments (student_id, class_id, enrollment_date, status) VALUES (?,?,date('now'),'active')").run(studentDbId, classId);
          enrolled++;
        } else {
          skipped++;
        }
      } catch (e) {
        console.error('Upload student error:', e);
        errors++;
      }
    }

    return success({ created, enrolled, errors, skipped, total: students.length });
  } catch (error) {
    console.error('Upload students error:', error);
    return serverError('فشل رفع الطلاب');
  }
}
