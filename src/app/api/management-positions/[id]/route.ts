import { NextRequest } from 'next/server';
import db from '@/lib/database';
import { authenticate, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';
import { sanitizeString } from '@/lib/validation';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return unauthorized();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('ID غير صالح');

    const existing = await db.prepare('SELECT * FROM management_positions WHERE id = ?').get(id) as any;
    if (!existing) return notFound('المسمى غير موجود');

    const body = await request.json();
    const { title, school } = body;

    if (!title) return badRequest('المسمى مطلوب');
    if (!school || !['middle', 'high'].includes(school)) return badRequest('المرحلة غير صالحة');

    await db.prepare('UPDATE management_positions SET title = ?, school = ? WHERE id = ?')
      .run(sanitizeString(title), school, id);

    return success({ message: 'تم التحديث بنجاح' });
  } catch (error) {
    console.error('Update position error:', error);
    return serverError('Failed to update position');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return unauthorized();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('ID غير صالح');

    const existing = await db.prepare('SELECT * FROM management_positions WHERE id = ?').get(id) as any;
    if (!existing) return notFound('المسمى غير موجود');

    await db.prepare('DELETE FROM management_position_assignments WHERE position_id = ?').run(id);
    await db.prepare('DELETE FROM management_positions WHERE id = ?').run(id);

    return success({ message: 'تم الحذف بنجاح' });
  } catch (error) {
    console.error('Delete position error:', error);
    return serverError('Failed to delete position');
  }
}
