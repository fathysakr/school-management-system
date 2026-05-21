import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, forbidden, badRequest, serverError, success } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { sanitizeString } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    const { searchParams } = new URL(request.url);
    const school = searchParams.get('school');
    const grade = searchParams.get('grade');
    let sql = 'SELECT s.*, t.first_name as teacher_first, t.last_name as teacher_last FROM subjects s LEFT JOIN teachers t ON s.teacher_id = t.id';
    const params: string[] = [];
    const clauses: string[] = [];
    if (school) { clauses.push('s.school = ?'); params.push(school); }
    if (grade) { clauses.push('s.grade = ?'); params.push(grade); }
    if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
    sql += ' ORDER BY s.name';
    const subjects = await db.prepare(sql).all(...params);
    return success({ subjects });
  } catch (error: any) {
    console.error('Get subjects error:', error);
    return serverError('فشل في جلب المواد');
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'settings:edit')) return forbidden();
    const body = await request.json();
    const { name, school, sessions_per_week, teacher_id } = body;
    if (!name || !school) return badRequest('اسم المادة والمرحلة مطلوبان');
    if (!['middle', 'high'].includes(school)) return badRequest('المرحلة غير صحيحة');
    const existing = await db.prepare('SELECT id FROM subjects WHERE name = ? AND school = ? AND grade IS NOT DISTINCT FROM ?').get(name, school, body.grade || null) as any;
    if (existing) return badRequest('المادة موجودة مسبقاً');
    const stmt = await db.prepare(
      'INSERT INTO subjects (name, school, sessions_per_week, grade, teacher_id) VALUES (?, ?, ?, ?, ?)'
    );
    const result = await stmt.run(
      sanitizeString(name), school,
      sessions_per_week !== undefined ? parseInt(sessions_per_week) : 3,
      body.grade || null,
      teacher_id ? parseInt(teacher_id) : null
    );
    return success({ message: 'تم إضافة المادة', id: result.lastInsertRowid }, 201);
  } catch (error: any) {
    console.error('Create subject error:', error);
    return serverError('فشل في إنشاء المادة');
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'settings:edit')) return forbidden();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return badRequest('معرف المادة مطلوب');
    const body = await request.json();
    const updates: string[] = [];
    const values: any[] = [];
    if (body.name) { updates.push('name = ?'); values.push(sanitizeString(body.name)); }
    if (body.school) {
      if (!['middle', 'high'].includes(body.school)) return badRequest('المرحلة غير صحيحة');
      updates.push('school = ?'); values.push(body.school);
    }
    if (body.sessions_per_week !== undefined) { updates.push('sessions_per_week = ?'); values.push(parseInt(body.sessions_per_week)); }
    if ('grade' in body) { updates.push('grade = ?'); values.push(body.grade || null); }
    if ('teacher_id' in body) { updates.push('teacher_id = ?'); values.push(body.teacher_id ? parseInt(body.teacher_id) : null); }
    if (updates.length === 0) return badRequest('لا توجد حقول للتحديث');
    values.push(parseInt(id));
    await db.prepare(`UPDATE subjects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return success({ message: 'تم تحديث المادة' });
  } catch (error: any) {
    console.error('Update subject error:', error);
    return serverError('فشل في تحديث المادة');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'settings:edit')) return forbidden();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return badRequest('معرف المادة مطلوب');
    await db.prepare('DELETE FROM subjects WHERE id = ?').run(parseInt(id));
    return success({ message: 'تم حذف المادة' });
  } catch (error: any) {
    console.error('Delete subject error:', error);
    return serverError('فشل في حذف المادة');
  }
}
