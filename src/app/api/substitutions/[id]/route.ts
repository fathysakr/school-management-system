import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, forbidden, badRequest, serverError, success } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'substitutions:edit')) return forbidden();

    const body = await request.json();
    const { substitute_teacher_id, status } = body;

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف غير صالح');

    const existing = await db.prepare('SELECT id FROM substitutions WHERE id = ?').get(id);
    if (!existing) return badRequest('البديل غير موجود');

    const updates: string[] = [];
    const values: any[] = [];

    if (substitute_teacher_id !== undefined) {
      updates.push('substitute_teacher_id = ?');
      values.push(substitute_teacher_id);
    }
    if (status !== undefined) {
      if (!['pending', 'approved', 'rejected', 'cancelled'].includes(status)) return badRequest('حالة غير صالحة');
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) return badRequest('لا يوجد بيانات للتحديث');

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await db.prepare(`UPDATE substitutions SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return success({ message: 'تم التحديث' });
  } catch (error) {
    console.error('Update substitution error:', error);
    return serverError('فشل في تحديث البديل');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'substitutions:delete')) return forbidden();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف غير صالح');

    const existing = await db.prepare('SELECT id FROM substitutions WHERE id = ?').get(id);
    if (!existing) return badRequest('البديل غير موجود');

    await db.prepare('DELETE FROM substitutions WHERE id = ?').run(id);
    return success({ message: 'تم الحذف' });
  } catch (error) {
    console.error('Delete substitution error:', error);
    return serverError('فشل في حذف البديل');
  }
}
