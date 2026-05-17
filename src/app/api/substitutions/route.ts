import { NextRequest } from 'next/server';
import db from '@/lib/database';
import { authenticate, unauthorized, forbidden, badRequest, serverError, success } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'substitutions:view')) return forbidden();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const date = searchParams.get('date');
    const status = searchParams.get('status');
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (date) { where += ' AND s.date = ?'; params.push(date); }
    if (status) { where += ' AND s.status = ?'; params.push(status); }

    const countResult = await db.prepare(`SELECT COUNT(*) as total FROM substitutions s ${where}`).get(...params) as any;
    const total = countResult.total;

    const substitutions = await db.prepare(`
      SELECT s.*,
        at.first_name as absent_first, at.last_name as absent_last,
        st.first_name as sub_first, st.last_name as sub_last,
        c.class_name, c.grade
      FROM substitutions s
      LEFT JOIN teachers at ON s.absent_teacher_id = at.id
      LEFT JOIN teachers st ON s.substitute_teacher_id = st.id
      LEFT JOIN classes c ON s.class_id = c.id
      ${where}
      ORDER BY s.date DESC, s.start_time ASC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return success({
      substitutions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get substitutions error:', error);
    return serverError('Failed to fetch substitutions');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'substitutions:create')) return forbidden();

    const body = await request.json();
    const {
      date, absent_teacher_id, substitute_teacher_id,
      schedule_id, subject, class_id, day_of_week,
      start_time, end_time, reason
    } = body;

    if (!date || !absent_teacher_id || !schedule_id || !subject || !class_id || !day_of_week || !start_time || !end_time) {
      return badRequest('جميع الحقول مطلوبة');
    }

    const result = await db.prepare(`
      INSERT INTO substitutions (date, absent_teacher_id, substitute_teacher_id, schedule_id, subject, class_id, day_of_week, start_time, end_time, reason, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)
    `).run(date, absent_teacher_id, substitute_teacher_id || null, schedule_id, subject, class_id, day_of_week, start_time, end_time, reason || null, user.id);

    return success({ message: 'تم تسجيل البديل', id: result.lastInsertRowid }, 201);
  } catch (error) {
    console.error('Create substitution error:', error);
    return serverError('Failed to create substitution');
  }
}
