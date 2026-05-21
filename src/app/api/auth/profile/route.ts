import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, hashPassword, comparePassword, generateToken, unauthorized, badRequest, serverError, success } from '@/lib/auth';

export async function PUT(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();

    const body = await request.json();
    const { email, currentPassword, newPassword } = body;

    // Fetch current user from DB
    const dbUser = await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as any;
    if (!dbUser) return badRequest('User not found');

    // Update email if provided
    if (email && email !== dbUser.email) {
      const existing = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, user.id);
      if (existing) {
        return badRequest('اسم المستخدم مستخدم بالفعل');
      }

      await db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, user.id);
    }

    // Update password if provided
    if (newPassword) {
      if (!currentPassword) {
        return badRequest('كلمة المرور الحالية مطلوبة لتغيير كلمة المرور');
      }

      const valid = await comparePassword(currentPassword, dbUser.password);
      if (!valid) {
        return badRequest('كلمة المرور الحالية غير صحيحة');
      }

      if (newPassword.length < 6) {
        return badRequest('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
      }

      const hashed = await hashPassword(newPassword);
      await db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, user.id);
    }

    // Get updated user
    const updated = await db.prepare('SELECT id, email, role, status FROM users WHERE id = ?').get(user.id) as any;

    // Generate new token if email changed
    const newToken = generateToken({
      id: updated.id,
      email: updated.email,
      role: updated.role,
    });

    return success({
      message: 'تم تحديث الملف الشخصي بنجاح',
      user: {
        id: updated.id,
        email: updated.email,
        role: updated.role,
      },
      token: newToken
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return serverError('فشل تحديث الملف الشخصي');
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const authUser = await authenticate(request);
    if (!authUser) return unauthorized();

    const dbUser = await db.prepare(`
      SELECT u.id, u.email, u.role, u.status, u.created_at,
             t.id as teacher_id, t.first_name as teacher_first, t.last_name as teacher_last, t.specialization,
             s.id as student_id, s.first_name as student_first, s.last_name as student_last
      FROM users u
      LEFT JOIN teachers t ON t.id = u.teacher_id
      LEFT JOIN students s ON s.user_id = u.id
      WHERE u.id = ?
    `).get(authUser.id) as any;

    if (!dbUser) return badRequest('User not found');

    return success({ user: dbUser });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return serverError('Failed to fetch profile');
  }
}
