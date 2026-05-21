import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, hashPassword, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';
import { sanitizeString } from '@/lib/validation';

const MANAGEMENT_ROLES = ['admin', 'middle_principal', 'high_principal', 'middle_supervisor', 'high_supervisor', 'middle_counselor', 'high_counselor', 'middle_monitor', 'high_monitor', 'middle_admin_staff', 'high_admin_staff'];

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return unauthorized();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('ID غير صالح');

    const existing = await db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!existing) return notFound('المستخدم غير موجود');

    const body = await request.json();
    const { email, password, role, teacher_id } = body;

    const updates: string[] = [];
    const values: any[] = [];

    if (email !== undefined) {
      const dup = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(sanitizeString(email), id);
      if (dup) return badRequest('البريد الإلكتروني موجود مسبقاً');
      updates.push('email = ?');
      values.push(sanitizeString(email));
    }

    if (password !== undefined) {
      if (password.length < 6) return badRequest('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      const hashed = await hashPassword(password);
      updates.push('password = ?');
      values.push(hashed);
    }

    if (role !== undefined) {
      if (!MANAGEMENT_ROLES.includes(role)) return badRequest('دور غير صالح');
      updates.push('role = ?');
      values.push(role);
    }

    if (teacher_id !== undefined) {
      updates.push('teacher_id = ?');
      values.push(teacher_id || null);
    }

    if (updates.length === 0) return badRequest('لا توجد تغييرات');

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return success({ message: 'تم التحديث بنجاح' });
  } catch (error) {
    console.error('Update management staff error:', error);
    return serverError('فشل في تحديث بيانات الإدارة');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return unauthorized();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('ID غير صالح');

    const existing = await db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!existing) return notFound('المستخدم غير موجود');
    if (existing.role === 'admin') return badRequest('لا يمكن حذف مدير النظام');

    await db.prepare('DELETE FROM users WHERE id = ?').run(id);

    return success({ message: 'تم الحذف بنجاح' });
  } catch (error) {
    console.error('Delete management staff error:', error);
    return serverError('فشل في حذف عضو الإدارة');
  }
}
