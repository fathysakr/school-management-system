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

    const gradeStats = await db.prepare(`
      SELECT COUNT(*) AS total_grades, AVG(CAST(score AS REAL) / CAST(total_score AS REAL) * 100) AS avg_score
      FROM grades
      WHERE student_id = ?
    `).get(studentId) as any;

    const attendanceStats = await db.prepare(`
      SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present
      FROM attendance
      WHERE student_id = ?
    `).get(studentId) as any;

    const totalReports = await db.prepare(`
      SELECT COUNT(*) AS total
      FROM teacher_reports
      WHERE student_id = ?
    `).get(studentId) as any;

    const attendanceRate = attendanceStats && attendanceStats.total > 0
      ? Math.round((attendanceStats.present / attendanceStats.total) * 100)
      : 0;

    const result: any = {
      ...student,
      class: enrollment || null,
      stats: {
        total_grades: gradeStats?.total_grades || 0,
        avg_score: gradeStats?.avg_score ? Math.round(gradeStats.avg_score * 100) / 100 : null,
        attendance_rate: attendanceRate,
        total_reports: totalReports?.total || 0,
      },
    };

    return success({ student: result });
  } catch (error) {
    console.error('Get student detail error:', error);
    return serverError('فشل في جلب تفاصيل الطالب');
  }
}
