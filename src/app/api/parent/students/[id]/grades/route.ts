import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { verifyToken, unauthorized, serverError, success } from '@/lib/auth';

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

    const grades = await db.prepare(`
      SELECT g.id, g.subject, g.score, g.total_score, g.assessment_type, g.assessment_date, c.class_name
      FROM grades g
      JOIN classes c ON c.id = g.class_id
      WHERE g.student_id = ?
      ORDER BY g.created_at DESC
    `).all(studentId) as any[];

    return success({ grades });
  } catch (error) {
    console.error('Get student grades error:', error);
    return serverError('فشل في جلب درجات الطالب');
  }
}
