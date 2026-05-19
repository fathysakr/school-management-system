import { NextRequest } from 'next/server';
import db from '@/lib/database';
import { authenticate, unauthorized, serverError, success } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const school = searchParams.get('school') || '';

    const managementRoles = ['admin', 'principal', 'supervisor', 'counselor'];
    const roleConditions = managementRoles.map(r => `u.role LIKE '%${r}%'`).join(' OR ');

    let whereClause = `WHERE (${roleConditions})`;
    const params: any[] = [];

    if (school) {
      whereClause += ' AND (t.school = ? OR t.school IS NULL)';
      params.push(school);
    }

    const query = `
      SELECT u.id as user_id, u.email, u.role as user_role, u.created_at as user_created_at,
             t.id as teacher_id, t.first_name, t.last_name, t.teacher_id as employee_id,
             t.phone, t.school, t.specialization
      FROM users u
      LEFT JOIN teachers t ON t.id = u.teacher_id
      ${whereClause}
      ORDER BY
        CASE
          WHEN u.role = 'admin' THEN 0
          WHEN u.role LIKE '%principal%' THEN 1
          WHEN u.role LIKE '%supervisor%' THEN 2
          WHEN u.role LIKE '%counselor%' THEN 3
          ELSE 4
        END,
        t.last_name, t.first_name
    `;

    const staff = await db.prepare(query).all(...params);

    return success({ staff });
  } catch (error) {
    console.error('Get management staff error:', error);
    return serverError('Failed to fetch management staff');
  }
}
