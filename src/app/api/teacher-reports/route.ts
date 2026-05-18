import { NextRequest } from 'next/server';
import db from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, serverError, success } from '@/lib/auth';
import { sanitizeString } from '@/lib/validation';
import { hasPermission, getSchoolFilter } from '@/lib/permissions';

import { notifyUsers } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'reports:view')) return forbidden();

    const { searchParams } = new URL(request.url);
    const teacher_id = searchParams.get('teacher_id');
    const student_id = searchParams.get('student_id');
    const class_id = searchParams.get('class_id');
    const report_type = searchParams.get('report_type');
    const status = searchParams.get('status') || 'active';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = `
      SELECT r.*, 
             t.first_name as teacher_first, t.last_name as teacher_last,
             s.first_name as student_first, s.last_name as student_last,
             s.student_id as student_number,
             c.class_name
      FROM teacher_reports r
      JOIN teachers t ON r.teacher_id = t.id
      JOIN students s ON r.student_id = s.id
      JOIN classes c ON r.class_id = c.id
      WHERE r.status = ?
    `;
    const params: any[] = [status];

    const schoolFilter = getSchoolFilter(user.role, searchParams.get('school') || undefined);
    if (schoolFilter.grade) { query += ' AND c.grade = ?'; params.push(schoolFilter.grade); }

    if (teacher_id) { query += ' AND r.teacher_id = ?'; params.push(parseInt(teacher_id)); }
    if (student_id) { query += ' AND r.student_id = ?'; params.push(parseInt(student_id)); }
    if (class_id) { query += ' AND r.class_id = ?'; params.push(parseInt(class_id)); }
    if (report_type) { query += ' AND r.report_type = ?'; params.push(report_type); }

    query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const reports = await db.prepare(query).all(...params);
    const count = await db.prepare(`SELECT COUNT(*) as c FROM teacher_reports WHERE status = ?`).get(status) as any;

    return success({ reports, total: count.c });
  } catch (error) {
    console.error('Get teacher reports error:', error);
    return serverError('Failed to fetch reports');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'reports:create')) return forbidden();

    const body = await request.json();
    const { teacher_id, student_id, class_id, report_type, title, content, date } = body;

    if (!student_id || !class_id || !report_type || !content) {
      return badRequest('Required fields: student_id, class_id, report_type, content');
    }

    if (!['activity', 'positive', 'behavioral', 'academic_deficiency'].includes(report_type)) {
      return badRequest('Invalid report type');
    }

    const stmt = db.prepare(`
      INSERT INTO teacher_reports (teacher_id, student_id, class_id, report_type, title, content, date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `);

    const result = await stmt.run(
      parseInt(teacher_id || '0'),
      parseInt(student_id),
      parseInt(class_id),
      report_type,
      title ? sanitizeString(title) : null,
      sanitizeString(content),
      date || new Date().toISOString().split('T')[0],
    );

    if (report_type === 'behavioral') {
      const cls = await db.prepare('SELECT grade FROM classes WHERE id = ?').get(parseInt(class_id)) as any;
      const schoolStage = cls?.grade === 'المتوسطة' ? 'middle' : 'high';
      const targetRoles = [`${schoolStage}_supervisor`, `${schoolStage}_counselor`];
      const targetUsers = await db.prepare(
        `SELECT u.email, t.phone, t.first_name, t.last_name FROM users u LEFT JOIN teachers t ON t.user_id = u.id WHERE u.role IN (?, ?)`
      ).all(...targetRoles) as any[];

      const student = await db.prepare('SELECT first_name, last_name FROM students WHERE id = ?').get(parseInt(student_id)) as any;
      const teacher = await db.prepare('SELECT first_name, last_name FROM teachers WHERE id = ?').get(parseInt(teacher_id || '0')) as any;
      const studentName = student ? `${student.first_name} ${student.last_name}` : '';
      const teacherName = teacher ? `${teacher.first_name} ${teacher.last_name}` : '';

      const emails = targetUsers.map((u: any) => u.email).filter(Boolean);
      if (emails.length > 0) {
        const clsName = (await db.prepare('SELECT class_name FROM classes WHERE id = ?').get(parseInt(class_id)) as any)?.class_name || '';
        notifyUsers(emails,
          '🚨 تقرير سلوكي - تنبيه عاجل',
          `الطالب: ${studentName}\nالفصل: ${clsName}\nالمعلم: ${teacherName}\nالمحتوى: ${sanitizeString(content).slice(0, 300)}`,
          'urgent',
          '/dashboard/reports'
        ).catch(() => {});
      }
    }

    return success({ message: 'Report added successfully', id: result.lastInsertRowid }, 201);
  } catch (error) {
    console.error('Create report error:', error);
    return serverError('Failed to create report');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'reports:edit')) return forbidden();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return badRequest('Report ID is required');

    const body = await request.json();
    const updates: string[] = [];
    const values: any[] = [];

    if (body.title !== undefined) { updates.push('title = ?'); values.push(sanitizeString(body.title)); }
    if (body.content !== undefined) { updates.push('content = ?'); values.push(sanitizeString(body.content)); }
    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status); }
    if (updates.length === 0) return badRequest('No fields to update');

    values.push(parseInt(id));
    await db.prepare(`UPDATE teacher_reports SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);

    return success({ message: 'Report updated' });
  } catch (error) {
    console.error('Update report error:', error);
    return serverError('Failed to update report');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'reports:delete')) return forbidden();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return badRequest('Report ID is required');

    await db.prepare('DELETE FROM teacher_reports WHERE id = ?').run(parseInt(id));
    return success({ message: 'Report deleted' });
  } catch (error) {
    console.error('Delete report error:', error);
    return serverError('Failed to delete report');
  }
}
