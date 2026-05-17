import { NextRequest } from 'next/server';
import db from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';
import { sanitizeString } from '@/lib/validation';
import { hasPermission, getSchoolFilter } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'announcements:view')) return forbidden();

    const { searchParams } = new URL(request.url);
    const target = searchParams.get('target');
    const class_id = searchParams.get('class_id');
    const status = searchParams.get('status') || 'active';

    let query = `
      SELECT a.*, u.email as created_by_email
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.status = ?
    `;
    const params: any[] = [status];

    const schoolFilter = getSchoolFilter(user.role, searchParams.get('school') || undefined);
    if (schoolFilter.grade) {
      query += ` AND (
        a.class_id IS NULL
        OR a.class_id IN (SELECT id FROM classes WHERE grade = ?)
      )`;
      params.push(schoolFilter.grade);
    }

    if (target && target !== 'all') {
      query += ' AND (a.target_audience = ? OR a.target_audience = ?)';
      params.push(target, 'all');
    }

    if (class_id) {
      query += ' AND (a.class_id = ? OR a.class_id IS NULL)';
      params.push(parseInt(class_id));
    }

    query += ' ORDER BY a.published_date DESC';

    const announcements = await db.prepare(query).all(...params);
    return success({ announcements });
  } catch (error) {
    console.error('Get announcements error:', error);
    return serverError('Failed to fetch announcements');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'announcements:create')) return forbidden();

    const body = await request.json();
    const { title, content, target_audience, class_id } = body;

    if (!title || !content || !target_audience) {
      return badRequest('Title, content, and target audience are required');
    }

    if (!['all', 'teachers', 'students', 'parents', 'class'].includes(target_audience)) {
      return badRequest('Invalid target audience');
    }

    if (target_audience === 'class' && !class_id) {
      return badRequest('Class ID is required for class-targeted announcements');
    }

    if (class_id) {
      const cls = await db.prepare('SELECT id FROM classes WHERE id = ?').get(parseInt(class_id));
      if (!cls) return badRequest('Class not found');
    }

    const stmt = db.prepare(`
      INSERT INTO announcements (title, content, target_audience, class_id, created_by, status, published_date)
      VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
    `);

    const result = await stmt.run(
      sanitizeString(title),
      sanitizeString(content),
      target_audience,
      class_id ? parseInt(class_id) : null,
      user.id
    );

    return success({ message: 'Announcement published successfully', id: result.lastInsertRowid }, 201);
  } catch (error) {
    console.error('Create announcement error:', error);
    return serverError('Failed to create announcement');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'announcements:edit')) return forbidden();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return badRequest('Announcement ID is required');

    const body = await request.json();
    const { title, content, target_audience, class_id, status } = body;

    const announcement = await db.prepare('SELECT * FROM announcements WHERE id = ?').get(parseInt(id));
    if (!announcement) return notFound('Announcement not found');

    const updates: string[] = [];
    const values: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(sanitizeString(title));
    }
    if (content !== undefined) {
      updates.push('content = ?');
      values.push(sanitizeString(content));
    }
    if (target_audience !== undefined) {
      if (!['all', 'teachers', 'students', 'parents', 'class'].includes(target_audience)) {
        return badRequest('Invalid target audience');
      }
      updates.push('target_audience = ?');
      values.push(target_audience);
    }
    if (class_id !== undefined) {
      updates.push('class_id = ?');
      values.push(class_id ? parseInt(class_id) : null);
    }
    if (status !== undefined) {
      if (!['active', 'archived'].includes(status)) return badRequest('Invalid status');
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) return badRequest('No fields to update');

    values.push(parseInt(id));
    await db.prepare(`UPDATE announcements SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);

    return success({ message: 'Announcement updated successfully' });
  } catch (error) {
    console.error('Update announcement error:', error);
    return serverError('Failed to update announcement');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'announcements:delete')) return forbidden();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return badRequest('Announcement ID is required');

    const announcement = await db.prepare('SELECT * FROM announcements WHERE id = ?').get(parseInt(id));
    if (!announcement) return notFound('Announcement not found');

    await db.prepare('DELETE FROM announcements WHERE id = ?').run(parseInt(id));

    return success({ message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    return serverError('Failed to delete announcement');
  }
}
