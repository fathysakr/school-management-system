import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, hashPassword, forbidden, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';
import { sanitizeString } from '@/lib/validation';

const ALLOWED_ROLES = ['middle_supervisor', 'high_supervisor', 'middle_teacher', 'high_teacher', 'middle_counselor', 'high_counselor', 'middle_principal', 'high_principal'];

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const users = await db.prepare(`
      SELECT u.id, u.email, u.role, u.status, u.created_at,
        u.teacher_id, t.first_name, t.last_name
      FROM users u
      LEFT JOIN teachers t ON t.id = u.teacher_id
      ORDER BY u.created_at DESC
    `).all();
    return success({ users });
  } catch (error) {
    console.error('Get users error:', error);
    return serverError('فشل في جلب المستخدمين');
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const body = await request.json();
    const { email, password, role, teacher_id } = body;

    if (!email || !password || !role) {
      return badRequest('مطلوب: اسم المستخدم، كلمة المرور، الدور');
    }
    if (password.length < 6) {
      return badRequest('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return badRequest('دور غير صالح');
    }

    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return badRequest('اسم المستخدم موجود مسبقًا');

    const hashed = await hashPassword(password);

    const insert = db.prepare('INSERT INTO users (email, password, role) VALUES (?, ?, ?)');
    const result = await insert.run(sanitizeString(email), hashed, role);
    const userId = result.lastInsertRowid;

    if (teacher_id) {
      await db.prepare('UPDATE users SET teacher_id = ? WHERE id = ?').run(teacher_id, userId);
    }

    return success({ message: 'User created successfully', user_id: userId }, 201);
  } catch (error) {
    console.error('Create user error:', error);
    return serverError('فشل في إنشاء المستخدم');
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return badRequest('معرف المستخدم مطلوب');
    const uid = parseInt(id);
    if (isNaN(uid)) return badRequest('معرف المستخدم غير صالح');

    const existing = await db.prepare('SELECT * FROM users WHERE id = ?').get(uid) as any;
    if (!existing) return notFound('المستخدم غير موجود');

    const body = await request.json();
    const { email, password, role, status, teacher_id } = body;

    const updates: string[] = [];
    const values: any[] = [];

    if (email !== undefined) {
      const dup = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, uid);
      if (dup) return badRequest('اسم المستخدم موجود مسبقًا');
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
      if (!ALLOWED_ROLES.includes(role)) return badRequest('دور غير صالح');
      updates.push('role = ?');
      values.push(role);
    }

    if (status !== undefined) {
      if (!['active', 'inactive'].includes(status)) return badRequest('حالة غير صالحة');
      updates.push('status = ?');
      values.push(status);
    }

    if (teacher_id !== undefined) {
      updates.push('teacher_id = ?');
      values.push(teacher_id || null);
    }

    if (updates.length === 0) return badRequest('لا توجد بيانات للتحديث');

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(uid);
    await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return success({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    return serverError('فشل في تحديث المستخدم');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return badRequest('معرف المستخدم مطلوب');
    const did = parseInt(id);
    if (isNaN(did)) return badRequest('معرف المستخدم غير صالح');

    const target = await db.prepare('SELECT * FROM users WHERE id = ?').get(did) as any;
    if (!target) return notFound('المستخدم غير موجود');
    if (target.role === 'admin') return forbidden('لا يمكن حذف حساب المدير');

    await db.prepare('DELETE FROM users WHERE id = ?').run(did);
    return success({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    return serverError('فشل في حذف المستخدم');
  }
}
