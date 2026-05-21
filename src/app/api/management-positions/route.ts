import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, badRequest, serverError, success } from '@/lib/auth';
import { sanitizeString } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const school = searchParams.get('school') || '';

    let query = `SELECT p.* FROM management_positions p`;
    const params: any[] = [];

    if (school) {
      query += ` WHERE p.school = ?`;
      params.push(school);
    }
    query += ` ORDER BY p.title`;

    let positions = await db.prepare(query).all(...params) as any[];
    const posIds = positions.map((p: any) => p.id);

    if (posIds.length > 0) {
      const placeholders = posIds.map(() => '?').join(',');
      const allAssignments = await db.prepare(`
        SELECT mpa.position_id, mpa.user_id, u.email, u.role,
               t.first_name, t.last_name, t.teacher_id as employee_id
        FROM management_position_assignments mpa
        JOIN users u ON u.id = mpa.user_id
        LEFT JOIN teachers t ON t.id = u.teacher_id
        WHERE mpa.position_id IN (${placeholders})
      `).all(...posIds) as any[];

      const assignMap = new Map<number, any[]>();
      for (const a of allAssignments) {
        const list = assignMap.get(a.position_id) || [];
        list.push(a);
        assignMap.set(a.position_id, list);
      }
      for (const pos of positions) {
        pos.assignments = assignMap.get(pos.id) || [];
      }
    }

    return success({ positions });
  } catch (error) {
    console.error('Get management positions error:', error);
    return serverError('Failed to fetch management positions');
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return unauthorized();

    const body = await request.json();
    const { title, school } = body;

    if (!title) return badRequest('المسمى مطلوب');
    if (!school || !['middle', 'high'].includes(school)) return badRequest('المرحلة غير صالحة');

    const result = await db.prepare(
      'INSERT INTO management_positions (title, school) VALUES (?, ?)'
    ).run(sanitizeString(title), school);

    return success({ message: 'تمت الإضافة بنجاح', id: result.lastInsertRowid }, 201);
  } catch (error) {
    console.error('Create position error:', error);
    return serverError('Failed to create position');
  }
}
