import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';
import { sanitizeString } from '@/lib/validation';
import { hasPermission } from '@/lib/permissions';

const PAYMENT_METHODS = ['cash', 'bank', 'wallet', 'other'];

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'fees:edit')) return forbidden();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف الدفعة غير صالح');

    const existing: any = await db.prepare('SELECT id FROM payments WHERE id = ?').get(id);
    if (!existing) return notFound('الدفعة غير موجودة');

    const body = await request.json();
    const updates: string[] = [];
    const values: any[] = [];

    if (body.amount !== undefined) {
      const amt = parseFloat(body.amount);
      if (isNaN(amt) || amt <= 0) return badRequest('المبلغ يجب أن يكون رقماً أكبر من صفر');
      updates.push('amount = ?');
      values.push(amt);
    }
    if (body.payment_date !== undefined) {
      const date = String(body.payment_date).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest('تاريخ الدفعة غير صالح');
      updates.push('payment_date = ?');
      values.push(date);
    }
    if (body.term !== undefined) {
      updates.push('term = ?');
      values.push(body.term ? sanitizeString(body.term) : '');
    }
    if (body.method !== undefined) {
      if (!PAYMENT_METHODS.includes(String(body.method))) return badRequest('طريقة الدفع غير صالحة');
      updates.push('method = ?');
      values.push(String(body.method));
    }
    if (body.receipt_no !== undefined) {
      updates.push('receipt_no = ?');
      values.push(body.receipt_no ? sanitizeString(body.receipt_no) : null);
    }
    if (body.notes !== undefined) {
      updates.push('notes = ?');
      values.push(body.notes ? sanitizeString(body.notes) : null);
    }

    if (!updates.length) return badRequest('لا توجد بيانات للتحديث');

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    await db.prepare(`UPDATE payments SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated: any = await db.prepare(
      `SELECT p.*, s.first_name || ' ' || s.last_name AS student_name
       FROM payments p JOIN students s ON p.student_id = s.id WHERE p.id = ?`
    ).get(id);

    return success({ payment: updated });
  } catch (error) {
    console.error('Update payment error:', error);
    return serverError('فشل في تحديث الدفعة');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'fees:delete')) return forbidden();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف الدفعة غير صالح');

    const existing: any = await db.prepare('SELECT id FROM payments WHERE id = ?').get(id);
    if (!existing) return notFound('الدفعة غير موجودة');

    await db.prepare('DELETE FROM payments WHERE id = ?').run(id);
    return success({ message: 'تم حذف الدفعة بنجاح' });
  } catch (error) {
    console.error('Delete payment error:', error);
    return serverError('فشل في حذف الدفعة');
  }
}
