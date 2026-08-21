import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { hashPassword, badRequest, serverError, success } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const body = await request.json();
    const { email, password, role: rawRole } = body;

    if (!email || !password) {
      return badRequest('اسم المستخدم وكلمة المرور مطلوبان');
    }

    if (password.length < 6) {
      return badRequest('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return badRequest('البريد الإلكتروني غير صالح');
    }

    const ALLOWED_SELF_REGISTER_ROLES = ['middle_teacher', 'high_teacher', 'middle_counselor', 'high_counselor'];
    const role = ALLOWED_SELF_REGISTER_ROLES.includes(rawRole) ? rawRole : 'middle_teacher';

    // Check if user exists
    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return badRequest('البريد الإلكتروني مسجل مسبقاً');
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user (pending until admin activates)
    const stmt = db.prepare(`
      INSERT INTO users (email, password, role, status)
      VALUES (?, ?, ?, 'pending')
    `);

    const result = await stmt.run(email, hashedPassword, role);
    const userId = result.lastInsertRowid as number;

    return success(
      {
        message: 'تم إنشاء الحساب بنجاح، سيتم تفعيله بعد مراجعة الإدارة',
        user: { id: userId, email, role, status: 'pending' }
      },
      201
    );
  } catch (error) {
    console.error('Registration error:', error);
    return serverError('فشل التسجيل');
  }
}
