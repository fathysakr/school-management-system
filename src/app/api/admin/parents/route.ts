import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, hashPassword, forbidden, unauthorized, badRequest, serverError, success } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const parents = await db.prepare(`
      SELECT p.id, p.name, p.email, p.phone, p.created_at,
        (SELECT COUNT(*) FROM students s WHERE s.parent_email = p.email OR s.parent_phone = p.phone) as linked_students
      FROM parents p
      ORDER BY p.created_at DESC
    `).all();

    return success({ parents });
  } catch (error) {
    console.error('Get parents error:', error);
    return serverError('فشل في جلب أولياء الأمور');
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const body = await request.json();
    const { name, email, phone, password } = body;

    if (!name || !email || !password) {
      return badRequest('مطلوب: الاسم، البريد الإلكتروني، كلمة المرور');
    }
    if (password.length < 6) {
      return badRequest('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }

    const existing = await db.prepare('SELECT id FROM parents WHERE email = ?').get(email);
    if (existing) return badRequest('البريد الإلكتروني موجود مسبقاً');

    if (phone) {
      const existingPhone = await db.prepare('SELECT id FROM parents WHERE phone = ?').get(phone);
      if (existingPhone) return badRequest('رقم الجوال موجود مسبقاً');
    }

    const hashed = await hashPassword(password);
    const result = await db.prepare('INSERT INTO parents (name, email, phone, password) VALUES (?, ?, ?, ?)').run(name, email, phone || null, hashed);

    return success({ message: 'تم إنشاء حساب ولي الأمر بنجاح', parent_id: result.lastInsertRowid }, 201);
  } catch (error) {
    console.error('Create parent error:', error);
    return serverError('فشل في إنشاء حساب ولي الأمر');
  }
}
