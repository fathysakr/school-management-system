import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, forbidden, badRequest, notFound, serverError, success } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'settings:edit')) return forbidden();
    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف غير صحيح');
    const body = await request.json();
    const { status, approved_by } = body;
    if (!['pending', 'approved', 'rejected'].includes(status)) return badRequest('حالة غير صحيحة');
    await db.prepare(
      'UPDATE leave_requests SET status = ?, approved_by = ?, approved_date = datetime("now") WHERE id = ?'
    ).run(status, approved_by || user.id, id);
    return success({ message: 'تم تحديث حالة الإجازة' });
  } catch (e) {
    console.error('Update leave error:', e); return serverError('فشل في تحديث الإجازة');
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
    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف غير صحيح');
    const existing = await db.prepare('SELECT user_id FROM leave_requests WHERE id = ?').get(id) as any;
    if (!existing) return notFound('طلب الإجازة غير موجود');
    if (existing.user_id !== user.id && !hasPermission(user.role, 'settings:edit')) return forbidden();
    await db.prepare('DELETE FROM leave_requests WHERE id = ?').run(id);
    return success({ message: 'تم حذف طلب الإجازة' });
  } catch (e) {
    console.error('Delete leave error:', e); return serverError('فشل في حذف الإجازة');
  }
}
