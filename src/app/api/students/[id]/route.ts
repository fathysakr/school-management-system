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
    if (!hasPermission(user.role, 'students:view')) return forbidden();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف الطالب غير صالح');

    const { searchParams } = new URL(request.url);
    const schoolFilter = getSchoolFilter(user.role, searchParams.get('school') || undefined);
    let schoolClause = '';
    const schoolParams: any[] = [id];
    if (schoolFilter.school) {
      schoolClause = ' AND school = ?';
      schoolParams.push(schoolFilter.school);
    }

    const student = await db.prepare(`
      SELECT s.*, c.id as class_id, c.class_name, c.grade as class_grade
      FROM students s
      LEFT JOIN enrollments e ON s.id = e.student_id AND e.status = 'active'
      LEFT JOIN classes c ON c.id = e.class_id
      WHERE s.id = ? ${schoolClause}
    `).get(...schoolParams);
    if (!student) return notFound('الطالب غير موجود');

    return success({ student });
  } catch (error) {
    console.error('Get student error:', error);
    return serverError('فشل في جلب بيانات الطالب');
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
    if (!hasPermission(user.role, 'students:edit')) return forbidden();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف الطالب غير صالح');

    const body = await request.json();

    const existing = await db.prepare('SELECT id FROM students WHERE id = ?').get(id);
    if (!existing) return notFound('الطالب غير موجود');

    const allowedFields = [
      'first_name', 'last_name', 'email', 'phone',
      'address', 'parent_email', 'parent_phone', 'parent_phones', 'school', 'status', 'semester'
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (field in body && body[field] !== undefined && body[field] !== null) {
        if (field === 'parent_phones') {
          if (!Array.isArray(body[field])) {
            return badRequest('parent_phones must be an array');
          }
          values.push(JSON.stringify(body[field].filter(Boolean)));
        } else if (field.includes('name') || field.includes('address')) {
          if (!body[field].trim()) continue;
          values.push(sanitizeString(body[field]));
        } else if (field.includes('email')) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (body[field] && !emailRegex.test(body[field])) {
            return badRequest(`Invalid ${field} format`);
          }
          values.push(body[field]);
        } else if (field.includes('phone')) {
          const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
          if (body[field] && !phoneRegex.test(body[field])) {
            return badRequest(`Invalid ${field} format`);
          }
          values.push(body[field]);
        } else {
          values.push(body[field]);
        }
        updates.push(`${field} = ?`);
      }
    }

    // Sync parent_phone with first phone in parent_phones if parent_phones is being updated
    if (Array.isArray(body.parent_phones) && !('parent_phone' in body)) {
      const firstPhone = body.parent_phones.filter(Boolean)[0] || '';
      if (firstPhone) {
        updates.push('parent_phone = ?');
        values.push(firstPhone);
      }
    }

    if (updates.length === 0) {
      return badRequest('لا توجد بيانات صالحة للتحديث');
    }

    values.push(id);

    const query = `UPDATE students SET ${updates.join(', ')} WHERE id = ?`;
    await db.prepare(query).run(...values);

    // Update enrollment if class_id provided
    if ('class_id' in body) {
      const newClassId = body.class_id ? parseInt(body.class_id) : null;
      // Remove old active enrollment
      await db.prepare('UPDATE enrollments SET status = ? WHERE student_id = ? AND status = ?').run('dropped', id, 'active');
      // Create new enrollment
      if (newClassId) {
        const classRow = await db.prepare('SELECT capacity FROM classes WHERE id = ? AND status = ?').get(newClassId, 'active') as any;
        if (classRow) {
          const cnt = (await db.prepare('SELECT COUNT(*) as count FROM enrollments WHERE class_id = ? AND status = ?').get(newClassId, 'active') as any)?.count || 0;
          if (cnt < classRow.capacity) {
            await db.prepare("INSERT OR IGNORE INTO enrollments (student_id, class_id, enrollment_date, status) VALUES (?, ?, date('now'), 'active')").run(id, newClassId);
          }
        }
      }
    }

    return success({ message: 'Student updated successfully' });
  } catch (error) {
    console.error('Update student error:', error);
    return serverError('فشل في تحديث بيانات الطالب');
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
    if (!hasPermission(user.role, 'students:delete')) return forbidden();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف الطالب غير صالح');

    const existing = await db.prepare('SELECT id FROM students WHERE id = ?').get(id);
    if (!existing) return notFound('الطالب غير موجود');

    // Hard delete (cascades to enrollments, attendance, grades, teacher_reports)
    await db.prepare('DELETE FROM enrollments WHERE student_id = ?').run(id);
    await db.prepare('DELETE FROM attendance WHERE student_id = ?').run(id);
    await db.prepare('DELETE FROM grades WHERE student_id = ?').run(id);
    await db.prepare('DELETE FROM teacher_reports WHERE student_id = ?').run(id);
    await db.prepare('DELETE FROM students WHERE id = ?').run(id);

    return success({ message: 'تم حذف الطالب وكل بياناته' });
  } catch (error) {
    console.error('Delete student error:', error);
    return serverError('فشل في حذف الطالب');
  }
}
