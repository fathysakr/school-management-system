import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { comparePassword, generateToken, badRequest, serverError, success, notFound, forbidden } from '@/lib/auth';
import { getSchoolStage } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const body = await request.json();
    const { email, password, school } = body;

    if (!email || !password) {
      return badRequest('اسم المستخدم وكلمة المرور مطلوبان');
    }

    // Get user
    const user = await db.prepare(`
      SELECT u.*, t.first_name || ' ' || t.last_name as name
      FROM users u
      LEFT JOIN teachers t ON t.user_id = u.id
      WHERE u.email = ?
    `).get(email) as any;
    if (!user) {
      return notFound('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    // Check password
    const passwordValid = await comparePassword(password, user.password);
    if (!passwordValid) {
      return notFound('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    // Check status
    if (user.status !== 'active') {
      return badRequest('الحساب غير نشط');
    }

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
    console.error('Login error:', error);
    return serverError('Login failed');
  }
}
