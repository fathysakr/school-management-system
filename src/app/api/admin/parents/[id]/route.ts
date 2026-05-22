import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, hashPassword, forbidden, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const parentId = parseInt(params.id);
    const existing = await db.prepare('SELECT * FROM parents WHERE id = ?').get(parentId) as any;
    if (!existing) return notFound('ولي الأمر غير موجود');

    const body = await request.json();
    const { name, email, phone, password } = body;

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }

    if (email !== undefined) {
      const dup = await db.prepare('SELECT id FROM parents WHERE email = ? AND id != ?').get(email, parentId);
      if (dup) return badRequest('البريد الإلكتروني موجود مسبقاً');
      updates.push('email = ?');
      values.push(email);
    }

    if (phone !== undefined) {
      const dup = await db.prepare('SELECT id FROM parents WHERE phone = ? AND id != ?').get(phone, parentId);
      if (dup) return badRequest('رقم الجوال موجود مسبقاً');
      updates.push('phone = ?');
      values.push(phone || null);
    }

    if (password !== undefined) {
      if (password.length < 6) return badRequest('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      const hashed = await hashPassword(password);
      updates.push('password = ?');
      values.push(hashed);
    }

    if (updates.length === 0) return badRequest('لا توجد بيانات للتحديث');

    values.push(parentId);
    await db.prepare(`UPDATE parents SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return success({ message: 'تم تحديث بيانات ولي الأمر بنجاح' });
  } catch (error) {
    console.error('Update parent error:', error);
    return serverError('فشل في تحديث بيانات ولي الأمر');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const parentId = parseInt(params.id);
    const existing = await db.prepare('SELECT * FROM parents WHERE id = ?').get(parentId) as any;
    if (!existing) return notFound('ولي الأمر غير موجود');

    await db.prepare('DELETE FROM parents WHERE id = ?').run(parentId);

    return success({ message: 'تم حذف حساب ولي الأمر بنجاح' });
  } catch (error) {
    console.error('Delete parent error:', error);
    return serverError('فشل في حذف حساب ولي الأمر');
  }
}
