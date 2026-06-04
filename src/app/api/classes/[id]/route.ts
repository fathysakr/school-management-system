import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';
import { sanitizeString } from '@/lib/validation';
import { hasPermission, getSchoolFilter } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'classes:view')) return forbidden();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف الفصل غير صالح');

    const { searchParams } = new URL(request.url);
    const schoolFilter = getSchoolFilter(user.role, searchParams.get('school') || undefined);
    let gradeClause = '';
    const queryParams: any[] = [id];
    if (schoolFilter.grade) {
      gradeClause = ' AND c.grade LIKE ?';
      queryParams.push(`%${schoolFilter.grade}%`);
    }

    const classData = await db.prepare(`
      SELECT c.*, 
             t.first_name || ' ' || t.last_name as teacher_name
      FROM classes c
      LEFT JOIN teachers t ON c.teacher_id = t.id
      WHERE c.id = ? ${gradeClause}
    `).get(...queryParams);

    if (!classData) return notFound('الفصل غير موجود');

    // Get enrolled students
    const students = await db.prepare(`
      SELECT s.*, e.enrollment_date
      FROM students s
      JOIN enrollments e ON s.id = e.student_id
      WHERE e.class_id = ? AND e.status = 'active'
      ORDER BY s.last_name, s.first_name
    `).all(id);

    return success({ class: classData, students });
  } catch (error) {
    console.error('Get class error:', error);
    return serverError('Failed to fetch class');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'classes:edit')) return forbidden();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف الفصل غير صالح');

    const body = await request.json();

    const existing = await db.prepare('SELECT id FROM classes WHERE id = ?').get(id);
    if (!existing) return notFound('الفصل غير موجود');

    const allowedFields = ['class_name', 'grade', 'section', 'room_number', 'capacity', 'status', 'teacher_id'];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (field in body && body[field] !== undefined) {
        if (field.includes('name') || field === 'section' || field === 'room_number') {
          if (body[field] && !body[field].toString().trim()) continue;
          values.push(body[field] ? sanitizeString(body[field].toString()) : null);
        } else if (field === 'capacity') {
          const cap = parseInt(body[field]);
          if (isNaN(cap) || cap < 1) return badRequest('السعة غير صالحة');
          values.push(cap);
        } else {
          values.push(body[field]);
        }
        updates.push(`${field} = ?`);
      }
    }

    if (updates.length === 0) {
      return badRequest('لا توجد بيانات صالحة للتحديث');
    }

    values.push(id);
    const query = `UPDATE classes SET ${updates.join(', ')} WHERE id = ?`;
    await db.prepare(query).run(...values);

    return success({ message: 'Class updated successfully' });
  } catch (error) {
    console.error('Update class error:', error);
    return serverError('فشل في تحديث الفصل');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'classes:delete')) return forbidden();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف الفصل غير صالح');

    const existing = await db.prepare('SELECT id FROM classes WHERE id = ?').get(id);
    if (!existing) return notFound('الفصل غير موجود');

    await db.prepare('UPDATE classes SET status = ? WHERE id = ?').run('inactive', id);

    return success({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Delete class error:', error);
    return serverError('فشل في حذف الفصل');
  }
}
