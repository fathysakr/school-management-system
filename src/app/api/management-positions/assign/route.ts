import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return unauthorized();

    const body = await request.json();
    const { position_id, user_id } = body;

    if (!position_id) return badRequest('المسمى مطلوب');
    if (!user_id) return badRequest('المستخدم مطلوب');

    const position = await db.prepare('SELECT * FROM management_positions WHERE id = ?').get(position_id) as any;
    if (!position) return notFound('المسمى غير موجود');

    const u = await db.prepare('SELECT * FROM users WHERE id = ?').get(user_id) as any;
    if (!u) return notFound('المستخدم غير موجود');

    const existing = await db.prepare(
      'SELECT * FROM management_position_assignments WHERE position_id = ? AND user_id = ?'
    ).get(position_id, user_id) as any;
    if (existing) return badRequest('المستخدم مضاف بالفعل لهذا المسمى');

    await db.prepare(
      'INSERT INTO management_position_assignments (position_id, user_id) VALUES (?, ?)'
    ).run(position_id, user_id);

    return success({ message: 'تمت الإضافة بنجاح' }, 201);
  } catch (error) {
    console.error('Assign user to position error:', error);
    return serverError('Failed to assign user');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return unauthorized();

    const body = await request.json();
    const { position_id, user_id } = body;

    if (!position_id) return badRequest('المسمى مطلوب');
    if (!user_id) return badRequest('المستخدم مطلوب');

    const result = await db.prepare(
      'DELETE FROM management_position_assignments WHERE position_id = ? AND user_id = ?'
    ).run(position_id, user_id);

    if (result.changes === 0) return notFound('البيان غير موجود');

    return success({ message: 'تمت إزالة المستخدم من المسمى' });
  } catch (error) {
    console.error('Unassign user from position error:', error);
    return serverError('Failed to unassign user');
  }
}
