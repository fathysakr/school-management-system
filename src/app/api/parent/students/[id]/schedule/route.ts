import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { verifyToken, authenticate, unauthorized, serverError, success } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureTursoReady();
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return unauthorized();
    const token = authHeader.slice(7);
    const decoded = verifyToken(token) as any;
    if (!decoded || decoded.role !== 'parent') return unauthorized();

    const parent = await db.prepare('SELECT * FROM parents WHERE email = ?').get(decoded.email) as any;
    if (!parent) return unauthorized();

    const studentId = parseInt(params.id);
    if (isNaN(studentId)) return serverError('معرف الطالب غير صالح');

    const student = await db.prepare('SELECT * FROM students WHERE id = ?').get(studentId) as any;
    if (!student) return serverError('الطالب غير موجود');
    if (student.parent_email !== parent.email && student.parent_phone !== parent.phone) return unauthorized();

    const enrollment = await db.prepare(`
      SELECT c.id AS class_id, c.class_name, c.grade, c.section
      FROM enrollments e
      JOIN classes c ON c.id = e.class_id
      WHERE e.student_id = ? AND e.status = 'active'
      LIMIT 1
    `).get(studentId) as any;

    if (!enrollment) return success({ schedule: [] });

    const schedule = await db.prepare(`
      SELECT s.subject, s.day_of_week, s.start_time, s.end_time, s.room_number,
             t.first_name || ' ' || t.last_name AS teacher_name
      FROM schedules s
      JOIN teachers t ON t.id = s.teacher_id
      WHERE s.class_id = ? AND s.status = 'active'
      ORDER BY s.day_of_week, s.start_time
    `).all(enrollment.class_id) as any[];

    return success({ schedule });
  } catch (error) {
    console.error('Get student schedule error:', error);
    return serverError('فشل في جلب جدول الطالب');
  }
}
