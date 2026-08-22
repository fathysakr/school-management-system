import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { hashPassword, badRequest, serverError, success, unauthorized } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();

    const ipLimit = rateLimit(`reset:${getClientIp(request)}`, 10, 60 * 60 * 1000);
    if (!ipLimit.allowed) {
      return badRequest('عدد كبير من المحاولات. حاول لاحقاً');
    }

    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) return badRequest('بيانات ناقصة');

    if (String(password).length < 6) {
      return badRequest('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }

    const secret = process.env.JWT_SECRET || '';
    if (!secret) return serverError('خطأ في الإعدادات');

    let payload: any;
    try {
      payload = jwt.verify(token, secret);
    } catch {
      return unauthorized('رابط إعادة التعيين غير صالح أو منتهي الصلاحية. اطلب رابطاً جديداً');
    }

    if (!payload || payload.purpose !== 'password-reset') {
      return unauthorized('رابط غير صالح');
    }

    const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(payload.id) as any;
    if (!user) return unauthorized('الحساب غير موجود');

    const hashedPassword = await hashPassword(String(password));
    await db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, payload.id);

    return success({ message: 'تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن' });
  } catch (error) {
    console.error('Reset password error:', error);
    return serverError('حدث خطأ. حاول مرة أخرى');
  }
}
