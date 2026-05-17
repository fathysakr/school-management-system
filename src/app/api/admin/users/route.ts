import { NextRequest } from 'next/server';
import db from '@/lib/database';
import { authenticate, hashPassword, forbidden, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';
import { sanitizeString } from '@/lib/validation';

const ALLOWED_ROLES = ['middle_supervisor', 'high_supervisor', 'middle_teacher', 'high_teacher', 'middle_counselor', 'high_counselor'];

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const users = await db.prepare(`
      SELECT u.id, u.email, u.role, u.status, u.created_at,
        t.id as teacher_id, t.first_name, t.last_name
      FROM users u
      LEFT JOIN teachers t ON t.user_id = u.id
      ORDER BY u.created_at DESC
    `).all();
    return success({ users });
  } catch (error) {
    console.error('Get users error:', error);
    return serverError('Failed to fetch users');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const body = await request.json();
    const { email, password, role, teacher_id } = body;

    if (!email || !password || !role) {
      return badRequest('مطلوب: اسم المستخدم، كلمة المرور، الدور');
    }
    if (password.length < 6) {
      return badRequest('Password must be at least 6 characters');
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return badRequest('Invalid role');
    }

    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return badRequest('اسم المستخدم موجود مسبقًا');

    const hashed = await hashPassword(password);

    const insert = db.prepare('INSERT INTO users (email, password, role) VALUES (?, ?, ?)');
    const result = await insert.run(sanitizeString(email), hashed, role);
    const userId = result.lastInsertRowid;

    if (teacher_id) {
      await db.prepare('UPDATE teachers SET user_id = ? WHERE id = ? AND user_id IS NULL').run(userId, teacher_id);
    }

    return success({ message: 'User created successfully', user_id: userId }, 201);
  } catch (error) {
    console.error('Create user error:', error);
    return serverError('Failed to create user');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return badRequest('User ID is required');

    const existing = await db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(id)) as any;
    if (!existing) return notFound('User not found');

    const body = await request.json();
    const { email, password, role, status, teacher_id } = body;

    const updates: string[] = [];
    const values: any[] = [];

    if (email !== undefined) {
      const dup = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, id);
      if (dup) return badRequest('اسم المستخدم موجود مسبقًا');
      updates.push('email = ?');
      values.push(sanitizeString(email));
    }

    if (password !== undefined) {
      if (password.length < 6) return badRequest('Password must be at least 6 characters');
      const hashed = await hashPassword(password);
      updates.push('password = ?');
      values.push(hashed);
    }

    if (role !== undefined) {
      if (!ALLOWED_ROLES.includes(role)) return badRequest('Invalid role');
      updates.push('role = ?');
      values.push(role);
    }

    if (status !== undefined) {
      if (!['active', 'inactive'].includes(status)) return badRequest('Invalid status');
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) return badRequest('No fields to update');

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(parseInt(id));
    await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    if (teacher_id !== undefined) {
      await db.prepare('UPDATE teachers SET user_id = NULL WHERE user_id = ?').run(id);
      if (teacher_id) {
        await db.prepare('UPDATE teachers SET user_id = ? WHERE id = ?').run(id, teacher_id);
      }
    }

    return success({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    return serverError('Failed to update user');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return badRequest('User ID is required');

    const target = await db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(id)) as any;
    if (!target) return notFound('User not found');
    if (target.role === 'admin') return forbidden('Cannot delete admin accounts');

    await db.prepare('DELETE FROM users WHERE id = ?').run(parseInt(id));
    return success({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    return serverError('Failed to delete user');
  }
}
