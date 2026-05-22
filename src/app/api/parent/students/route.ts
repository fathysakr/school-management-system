import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { verifyToken, authenticate, unauthorized, serverError, success } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return unauthorized();
    const token = authHeader.slice(7);
    const decoded = verifyToken(token) as any;
    if (!decoded || decoded.role !== 'parent') return unauthorized();

    const parent = await db.prepare('SELECT * FROM parents WHERE email = ?').get(decoded.email) as any;
    if (!parent) return unauthorized();

    const students = await db.prepare(`
      SELECT s.id, s.first_name, s.last_name, s.student_id, s.status, s.school,
        (SELECT COUNT(*) FROM grades g WHERE g.student_id = s.id) as grades_count,
        (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id) as attendance_count,
        (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id AND a.status = 'present') as present_count,
        (SELECT COUNT(DISTINCT subject) FROM schedules sc JOIN enrollments e ON e.class_id = sc.class_id WHERE e.student_id = s.id AND e.status = 'active' AND sc.status = 'active') as subjects_count
      FROM students s
      WHERE s.parent_email = ? OR s.parent_phone = ?
    `).all(parent.email, parent.phone) as any[];

    for (const student of students) {
      student.attendance_rate = student.attendance_count > 0
        ? Math.round((student.present_count / student.attendance_count) * 100)
        : null;
    }

    return success({ students });
  } catch (error) {
    console.error('Get parent students error:', error);
    return serverError('فشل في جلب بيانات الطلاب');
  }
}
