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
    if (!hasPermission(user.role, 'teachers:view')) return forbidden();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف المعلم غير صالح');

    const { searchParams } = new URL(request.url);
    const schoolFilter = getSchoolFilter(user.role, searchParams.get('school') || undefined);
    let schoolClause = '';
    const schoolParams: any[] = [];
    if (schoolFilter.school) {
      schoolClause = ' AND t.school = ?';
      schoolParams.push(schoolFilter.school);
    }

    const query = `
      SELECT t.*, 
             COUNT(DISTINCT c.id) as classes_count,
             GROUP_CONCAT(DISTINCT c.class_name) as classes
      FROM teachers t
      LEFT JOIN classes c ON t.id = c.teacher_id
      WHERE t.id = ? ${schoolClause}
      GROUP BY t.id
    `;

    const teacher = await db.prepare(query).get(id, ...schoolParams);
    if (!teacher) return notFound('المعلم غير موجود');

    return success({ teacher });
  } catch (error) {
    console.error('Get teacher error:', error);
    return serverError('فشل في جلب بيانات المعلم');
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
    if (!hasPermission(user.role, 'teachers:edit')) return forbidden();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف المعلم غير صالح');

    const body = await request.json();

    // Check if teacher exists
    const existing = await db.prepare('SELECT id FROM teachers WHERE id = ?').get(id);
    if (!existing) return notFound('المعلم غير موجود');

    // Prepare updates - only allow specific fields
    const allowedFields = [
      'first_name', 'last_name', 'date_of_birth',
      'email', 'phone', 'address', 'specialization', 'school', 'status'
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (field in body && body[field] !== undefined && body[field] !== null) {
        if (field.includes('name')) {
          if (!body[field].trim()) continue;
          values.push(sanitizeString(body[field]));
        } else if (field === 'email') {
          if (!body[field]) continue;
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(body[field])) return badRequest('صيغة البريد الإلكتروني غير صالحة');
          values.push(body[field]);
        } else if (field === 'phone') {
          const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
          if (!phoneRegex.test(body[field])) return badRequest('صيغة رقم الجوال غير صالحة');
          values.push(body[field]);
        } else if (field === 'status') {
          if (!['active', 'inactive'].includes(body[field])) {
            return badRequest('قيمة الحالة غير صالحة');
          }
          values.push(body[field]);
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

    // Prevent duplicate email
    if (body.email) {
      const existingEmail = await db.prepare(
        'SELECT id FROM teachers WHERE email = ? AND id != ?'
      ).get(body.email, id);
      if (existingEmail) return badRequest('البريد الإلكتروني موجود مسبقاً');
    }

    const query = `UPDATE teachers SET ${updates.join(', ')} WHERE id = ?`;
    await db.prepare(query).run(...values);

    return success({ message: 'Teacher updated successfully' });
  } catch (error) {
    console.error('Update teacher error:', error);
    return serverError('فشل في تحديث بيانات المعلم');
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
    if (!hasPermission(user.role, 'teachers:delete')) return forbidden();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف المعلم غير صالح');

    // Check if teacher exists
    const existing = await db.prepare('SELECT id FROM teachers WHERE id = ?').get(id);
    if (!existing) return notFound('المعلم غير موجود');

    // Soft delete
    await db.prepare('UPDATE teachers SET status = ? WHERE id = ?').run('inactive', id);

    return success({ message: 'Teacher deleted successfully' });
  } catch (error) {
    console.error('Delete teacher error:', error);
    return serverError('فشل في حذف المعلم');
  }
}
