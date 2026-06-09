import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { verifyToken, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';

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
    if (isNaN(studentId)) return badRequest('معرف الطالب غير صالح');

    const student = await db.prepare('SELECT * FROM students WHERE id = ?').get(studentId) as any;
    if (!student) return notFound('الطالب غير موجود');
    if (student.parent_email !== parent.email && student.parent_phone !== parent.phone) return unauthorized();

    const attendance = await db.prepare(`
      SELECT a.attendance_date, a.status, a.remarks
      FROM attendance a
      WHERE a.student_id = ?
      ORDER BY a.attendance_date DESC
    `).all(studentId) as any[];

    return success({ attendance });
  } catch (error) {
    console.error('Get student attendance error:', error);
    return serverError('فشل في جلب سجل الحضور');
  }
}
