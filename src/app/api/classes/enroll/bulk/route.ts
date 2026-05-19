import { NextRequest } from 'next/server';
import db from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, serverError, success } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'students:edit')) return forbidden();

    const body = await request.json();
    const { class_id, student_ids } = body;

    if (!class_id) return badRequest('معرف الفصل مطلوب');
    if (!Array.isArray(student_ids) || student_ids.length === 0) return badRequest('يجب اختيار طالب واحد على الأقل');

    const classData = await db.prepare('SELECT id, capacity FROM classes WHERE id = ? AND status = ?').get(class_id, 'active') as any;
    if (!classData) return badRequest('الفصل غير موجود أو غير نشط');

    const enrolled = await db.prepare('SELECT COUNT(*) as count FROM enrollments WHERE class_id = ? AND status = ?').get(class_id, 'active') as any;
    const available = classData.capacity - enrolled.count;
    if (available <= 0) return badRequest('الفصل ممتلئ');

    const toEnroll = student_ids.slice(0, available);
    let added = 0;
    const errors: string[] = [];

    for (const studentId of toEnroll) {
      try {
        const student = await db.prepare('SELECT id FROM students WHERE id = ? AND status = ?').get(studentId, 'active') as any;
        if (!student) { errors.push(`الطالب ${studentId} غير موجود`); continue; }

        const existing = await db.prepare('SELECT id FROM enrollments WHERE student_id = ? AND class_id = ? AND status = ?').get(studentId, class_id, 'active') as any;
        if (existing) { errors.push(`الطالب ${studentId} مسجل مسبقاً`); continue; }

        await db.prepare("INSERT INTO enrollments (student_id, class_id, enrollment_date, status) VALUES (?, ?, date('now'), 'active')").run(studentId, class_id);
        added++;
      } catch { errors.push(`فشل تسجيل الطالب ${studentId}`); }
    }

    return success({
      message: `تم تسجيل ${added} طالب${errors.length > 0 ? `، ${errors.length} خطأ` : ''}`,
      added,
      errors,
    });
  } catch (error) {
    console.error('Bulk enroll error:', error);
    return serverError('فشل في تسجيل الطلاب');
  }
}
