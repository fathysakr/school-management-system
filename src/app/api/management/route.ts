import { NextRequest } from 'next/server';
import db from '@/lib/database';
import { authenticate, hashPassword, unauthorized, badRequest, serverError, success } from '@/lib/auth';
import { sanitizeString } from '@/lib/validation';

const MANAGEMENT_ROLES = ['admin', 'middle_principal', 'high_principal', 'middle_supervisor', 'high_supervisor', 'middle_counselor', 'high_counselor', 'middle_monitor', 'high_monitor', 'middle_admin_staff', 'high_admin_staff'];

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const school = searchParams.get('school') || '';

    const roleConditions = MANAGEMENT_ROLES.map(r => `u.role = '${r}'`).join(' OR ');

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

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return unauthorized();

    const body = await request.json();
    const { email, password, role, teacher_id } = body;

    if (!email || !password) return badRequest('البريد الإلكتروني وكلمة المرور مطلوبان');
    if (password.length < 6) return badRequest('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    if (!role || !MANAGEMENT_ROLES.includes(role)) return badRequest('دور غير صالح');

    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(sanitizeString(email));
    if (existing) return badRequest('البريد الإلكتروني موجود مسبقاً');

    const hashed = await hashPassword(password);
    const insert = db.prepare('INSERT INTO users (email, password, role) VALUES (?, ?, ?)');
    const result = await insert.run(sanitizeString(email), hashed, role);
    const userId = result.lastInsertRowid;

    if (teacher_id) {
      await db.prepare('UPDATE users SET teacher_id = ? WHERE id = ?').run(teacher_id, userId);
    }

    return success({ message: 'تمت الإضافة بنجاح', user_id: userId }, 201);
  } catch (error) {
    console.error('Create management staff error:', error);
    return serverError('Failed to create management staff');
  }
}
