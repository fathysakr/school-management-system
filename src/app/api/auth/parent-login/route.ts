import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { comparePassword, generateToken, badRequest, serverError, success, unauthorized } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return badRequest('البريد الإلكتروني وكلمة المرور مطلوبان');
    }

    const parent = await db.prepare(`
      SELECT * FROM parents
      WHERE email = ? OR phone = ?
    `).get(email, email) as any;

    if (!parent) {
      return unauthorized('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    const passwordValid = await comparePassword(password, parent.password);
    if (!passwordValid) {
      return unauthorized('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    const token = generateToken({
      id: parent.id,
      email: parent.email,
      role: 'parent',
    });

    return success({
      token,
      user: {
        id: parent.id,
        email: parent.email,
        role: 'parent',
        name: parent.name,
      },
    });
  } catch (error) {
    console.error('Parent login error:', error);
    return serverError('فشل تسجيل الدخول');
  }
}
