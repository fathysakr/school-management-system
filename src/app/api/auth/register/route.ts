import { NextRequest } from 'next/server';
import db from '@/lib/database';
import { hashPassword, generateToken, badRequest, serverError, success } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, role: rawRole } = body;

    if (!email || !password) {
      return badRequest('اسم المستخدم وكلمة المرور مطلوبان');
    }

    if (password.length < 6) {
      return badRequest('Password must be at least 6 characters');
    }

    const ALLOWED_SELF_REGISTER_ROLES = ['middle_teacher', 'high_teacher', 'middle_counselor', 'high_counselor'];
    const role = ALLOWED_SELF_REGISTER_ROLES.includes(rawRole) ? rawRole : 'middle_teacher';

    // Check if user exists
    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return badRequest('Email already registered');
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const stmt = db.prepare(`
      INSERT INTO users (email, password, role, status)
      VALUES (?, ?, ?, 'active')
    `);

    const result = await stmt.run(email, hashedPassword, role);
    const userId = result.lastInsertRowid as number;

    // Generate token
    const token = generateToken({
      id: userId,
      email,
      role: role as any
    });

    return success(
      {
        message: 'Registration successful',
        user: { id: userId, email, role },
        token
      },
      201
    );
  } catch (error) {
    console.error('Registration error:', error);
    return serverError('Registration failed');
  }
}
