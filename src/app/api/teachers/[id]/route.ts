import { NextRequest } from 'next/server';
import db from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';
import { sanitizeString } from '@/lib/validation';
import { hasPermission, getSchoolFilter } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'teachers:view')) return forbidden();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('Invalid teacher ID');

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
    if (!teacher) return notFound('Teacher not found');

    return success({ teacher });
  } catch (error) {
    console.error('Get teacher error:', error);
    return serverError('Failed to fetch teacher');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'teachers:edit')) return forbidden();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('Invalid teacher ID');

    const body = await request.json();

    // Check if teacher exists
    const existing = await db.prepare('SELECT id FROM teachers WHERE id = ?').get(id);
    if (!existing) return notFound('Teacher not found');

    // Prepare updates - only allow specific fields
    const allowedFields = [
      'first_name', 'last_name', 'date_of_birth',
      'email', 'phone', 'address', 'specialization', 'school', 'status'
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (field in body && body[field] !== undefined && body[field] !== null) {
        // Validate field
        if (field.includes('name')) {
          if (!body[field].trim()) continue;
          values.push(sanitizeString(body[field]));
        } else if (field === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(body[field])) return badRequest('Invalid email format');
          values.push(body[field]);
        } else if (field === 'phone') {
          const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
          if (!phoneRegex.test(body[field])) return badRequest('Invalid phone format');
          values.push(body[field]);
        } else if (field === 'status') {
          if (!['active', 'inactive'].includes(body[field])) {
            return badRequest('Invalid status value');
          }
          values.push(body[field]);
        } else {
          values.push(body[field]);
        }

        updates.push(`${field} = ?`);
      }
    }

    if (updates.length === 0) {
      return badRequest('No valid fields to update');
    }

    values.push(id);

    // Prevent duplicate email
    if ('email' in body) {
      const existingEmail = await db.prepare(
        'SELECT id FROM teachers WHERE email = ? AND id != ?'
      ).get(body.email, id);
      if (existingEmail) return badRequest('Email already exists');
    }

    const query = `UPDATE teachers SET ${updates.join(', ')} WHERE id = ?`;
    await db.prepare(query).run(...values);

    return success({ message: 'Teacher updated successfully' });
  } catch (error) {
    console.error('Update teacher error:', error);
    return serverError('Failed to update teacher');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'teachers:delete')) return forbidden();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('Invalid teacher ID');

    // Check if teacher exists
    const existing = await db.prepare('SELECT id FROM teachers WHERE id = ?').get(id);
    if (!existing) return notFound('Teacher not found');

    // Soft delete
    await db.prepare('UPDATE teachers SET status = ? WHERE id = ?').run('inactive', id);

    return success({ message: 'Teacher deleted successfully' });
  } catch (error) {
    console.error('Delete teacher error:', error);
    return serverError('Failed to delete teacher');
  }
}
