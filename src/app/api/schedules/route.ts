import { NextRequest } from 'next/server';
import db from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';
import { sanitizeString } from '@/lib/validation';
import { hasPermission, getSchoolFilter } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'schedules:view')) return forbidden();

    const { searchParams } = new URL(request.url);
    const class_id = searchParams.get('class_id');
    const teacher_id = searchParams.get('teacher_id');
    const day = searchParams.get('day');

    let query = `
      SELECT s.*, c.class_name, t.first_name as teacher_first, t.last_name as teacher_last
      FROM schedules s
      JOIN classes c ON s.class_id = c.id
      JOIN teachers t ON s.teacher_id = t.id
      WHERE s.status = 'active'
    `;
    const params: any[] = [];

    const schoolFilter = getSchoolFilter(user.role, searchParams.get('school') || undefined);
    if (schoolFilter.grade) { query += ' AND c.grade = ?'; params.push(schoolFilter.grade); }

    if (class_id) { query += ' AND s.class_id = ?'; params.push(parseInt(class_id)); }
    if (teacher_id) { query += ' AND s.teacher_id = ?'; params.push(parseInt(teacher_id)); }
    if (day) { query += ' AND s.day_of_week = ?'; params.push(day); }

    query += " ORDER BY CASE s.day_of_week WHEN 'sunday' THEN 1 WHEN 'monday' THEN 2 WHEN 'tuesday' THEN 3 WHEN 'wednesday' THEN 4 WHEN 'thursday' THEN 5 END, s.start_time";

    const schedules = await db.prepare(query).all(...params);
    return success({ schedules });
  } catch (error) {
    console.error('Get schedules error:', error);
    return serverError('Failed to fetch schedules');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'schedules:create')) return forbidden();

    const body = await request.json();
    const { class_id, teacher_id, subject, day_of_week, start_time, end_time, room_number } = body;

    if (!class_id || !teacher_id || !subject || !day_of_week || !start_time || !end_time) {
      return badRequest('All fields are required: class_id, teacher_id, subject, day_of_week, start_time, end_time');
    }

    if (!['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'].includes(day_of_week)) {
      return badRequest('Invalid day. Must be: sunday, monday, tuesday, wednesday, thursday');
    }

    const cls = await db.prepare('SELECT id FROM classes WHERE id = ?').get(parseInt(class_id));
    if (!cls) return badRequest('Class not found');

    const teacher = await db.prepare('SELECT id FROM teachers WHERE id = ?').get(parseInt(teacher_id));
    if (!teacher) return badRequest('Teacher not found');

    // Check for time conflicts
    const conflict = await db.prepare(`
      SELECT id FROM schedules WHERE class_id = ? AND day_of_week = ? AND status = 'active'
      AND start_time < ? AND end_time > ?
    `).get(parseInt(class_id), day_of_week, end_time, start_time);

    if (conflict) return badRequest('There is a schedule conflict at this time');

    const stmt = db.prepare(`
      INSERT INTO schedules (class_id, teacher_id, subject, day_of_week, start_time, end_time, room_number, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `);

    const result = await stmt.run(
      parseInt(class_id),
      parseInt(teacher_id),
      sanitizeString(subject),
      day_of_week,
      start_time,
      end_time,
      room_number ? sanitizeString(room_number) : null
    );

    return success({ message: 'Schedule added successfully', id: result.lastInsertRowid }, 201);
  } catch (error) {
    console.error('Create schedule error:', error);
    return serverError('Failed to create schedule');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'schedules:edit')) return forbidden();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return badRequest('Schedule ID is required');

    const body = await request.json();
    const schedule = await db.prepare('SELECT * FROM schedules WHERE id = ?').get(parseInt(id));
    if (!schedule) return notFound('Schedule not found');

    const updates: string[] = [];
    const values: any[] = [];

    if (body.subject !== undefined) { updates.push('subject = ?'); values.push(sanitizeString(body.subject)); }
    if (body.day_of_week !== undefined) { updates.push('day_of_week = ?'); values.push(body.day_of_week); }
    if (body.start_time !== undefined) { updates.push('start_time = ?'); values.push(body.start_time); }
    if (body.end_time !== undefined) { updates.push('end_time = ?'); values.push(body.end_time); }
    if (body.room_number !== undefined) { updates.push('room_number = ?'); values.push(body.room_number ? sanitizeString(body.room_number) : null); }
    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status); }

    if (updates.length === 0) return badRequest('No fields to update');

    values.push(parseInt(id));
    await db.prepare(`UPDATE schedules SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);

    return success({ message: 'Schedule updated successfully' });
  } catch (error) {
    console.error('Update schedule error:', error);
    return serverError('Failed to update schedule');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'schedules:delete')) return forbidden();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return badRequest('Schedule ID is required');

    const schedule = await db.prepare('SELECT * FROM schedules WHERE id = ?').get(parseInt(id));
    if (!schedule) return notFound('Schedule not found');

    await db.prepare('DELETE FROM schedules WHERE id = ?').run(parseInt(id));

    return success({ message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Delete schedule error:', error);
    return serverError('Failed to delete schedule');
  }
}
