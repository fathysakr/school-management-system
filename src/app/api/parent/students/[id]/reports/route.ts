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

    const reports = await db.prepare(`
      SELECT r.report_type, r.title, r.content, r.created_at,
             t.first_name || ' ' || t.last_name AS teacher_name
      FROM teacher_reports r
      JOIN teachers t ON t.id = r.teacher_id
      WHERE r.student_id = ?
      ORDER BY r.created_at DESC
    `).all(studentId) as any[];

    return success({ reports });
  } catch (error) {
    console.error('Get student reports error:', error);
    return serverError('فشل في جلب تقارير الطالب');
  }
}
