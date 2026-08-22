import { NextRequest, NextResponse } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { comparePassword, generateToken, badRequest, serverError, success, unauthorized, forbidden } from '@/lib/auth';
import { getSchoolStage } from '@/lib/permissions';
import { rateLimit, resetRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const body = await request.json();
    const { email, password, school } = body;

    if (!email || !password) {
      return badRequest('اسم المستخدم وكلمة المرور مطلوبان');
    }

    const limitKey = `login:${getClientIp(request)}:${String(email).toLowerCase()}`;
    const limit = rateLimit(limitKey);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `محاولات كثيرة خاطئة. حاول مرة أخرى بعد ${limit.retryAfterSeconds} ثانية` },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
      );
    }

    // Get user
    const user = await db.prepare(`
      SELECT u.*, t.first_name || ' ' || t.last_name as name
      FROM users u
      LEFT JOIN teachers t ON t.user_id = u.id
      WHERE u.email = ?
    `).get(email) as any;
    if (!user) {
      return unauthorized('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    const passwordValid = await comparePassword(password, user.password);
    if (!passwordValid) {
      return unauthorized('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    // Check status
    if (user.status !== 'active') {
      return badRequest('الحساب غير نشط، برجاء التواصل مع إدارة المدرسة');
    }

    resetRateLimit(limitKey);

    // Validate school access
    const allowedSchool = getSchoolStage(user.role);
    if (school && allowedSchool !== 'both' && allowedSchool !== school) {
      return forbidden('ممنوع الدخول - هذا الحساب غير مصرح له بالدخول إلى هذه المرحلة');
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    return success({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name || user.email,
        school: allowedSchool === 'both' ? school : allowedSchool
      },
      token
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Login error:', errMsg, error instanceof Error ? error.stack : '');
    return serverError('فشل تسجيل الدخول');
  }
}
