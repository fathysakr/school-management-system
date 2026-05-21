import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, serverError, success } from '@/lib/auth';
import { sanitizeString } from '@/lib/validation';
import { hasPermission, getSchoolFilter } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'attendance:view')) return forbidden();

    const { searchParams } = new URL(request.url);
    const student_id = searchParams.get('student_id');
    const class_id = searchParams.get('class_id');
    const date = searchParams.get('date');

    let query = 'SELECT a.* FROM attendance a JOIN classes c ON a.class_id = c.id WHERE 1=1';
    const params: any[] = [];

    const schoolFilter = getSchoolFilter(user.role, searchParams.get('school') || undefined);
    if (schoolFilter.grade) {
      query += ' AND c.grade = ?';
      params.push(schoolFilter.grade);
    }

    if (student_id) {
      query += ' AND a.student_id = ?';
      params.push(parseInt(student_id));
    }

    if (class_id) {
      query += ' AND a.class_id = ?';
      params.push(parseInt(class_id));
    }

    if (date) {
      query += ' AND attendance_date = ?';
      params.push(date);
    }

    query += ' ORDER BY a.attendance_date DESC, a.student_id';

    const records = await db.prepare(query).all(...params);

    return success({ attendance: records });
  } catch (error) {
    console.error('Get attendance error:', error);
    return serverError('فشل في جلب الحضور');
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'attendance:create')) return forbidden();

    const body = await request.json();
    const { student_id, class_id, attendance_date, status, remarks } = body;

    if (!student_id || !class_id || !attendance_date || !status) {
      return badRequest('معرف الطالب والفصل والتاريخ والحالة مطلوبة');
    }

    if (!['present', 'absent', 'late', 'excused'].includes(status)) {
      return badRequest('حالة الحضور غير صالحة');
    }

    // Verify student and class
    const student = await db.prepare('SELECT id FROM students WHERE id = ?').get(student_id);
    if (!student) return badRequest('الطالب غير موجود');

    const classData = await db.prepare('SELECT id FROM classes WHERE id = ?').get(class_id);
    if (!classData) return badRequest('الفصل غير موجود');

    // Check if record exists
    const existing = await db.prepare(
      'SELECT id FROM attendance WHERE student_id = ? AND class_id = ? AND attendance_date = ?'
    ).get(student_id, class_id, attendance_date);

    if (existing) {
      // Update
      await db.prepare(
        'UPDATE attendance SET status = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE student_id = ? AND class_id = ? AND attendance_date = ?'
      ).run(status, remarks ? sanitizeString(remarks) : null, student_id, class_id, attendance_date);

      return success({ message: 'Attendance updated successfully' });
    } else {
      // Insert
      const stmt = db.prepare(`
        INSERT INTO attendance (student_id, class_id, attendance_date, status, remarks)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = await stmt.run(
        student_id,
        class_id,
        attendance_date,
        status,
        remarks ? sanitizeString(remarks) : null
      );

      return success({
        message: 'Attendance recorded successfully',
        attendance_id: result.lastInsertRowid
      }, 201);
    }
  } catch (error) {
    console.error('Record attendance error:', error);
    return serverError('فشل في تسجيل الحضور');
  }
}

// Bulk attendance upload
export async function PUT(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'attendance:create')) return forbidden();

    const body = await request.json();
    const { class_id, attendance_date, records } = body;

    if (!class_id || !attendance_date || !Array.isArray(records)) {
      return badRequest('معرف الفصل والتاريخ وسجل الحضور مطلوبة');
    }

    const classData = await db.prepare('SELECT id FROM classes WHERE id = ?').get(class_id);
    if (!classData) return badRequest('الفصل غير موجود');

    let successCount = 0;
    let errorCount = 0;

    for (const record of records) {
      const { student_id, status, remarks } = record;

      if (!student_id || !status) continue;
      if (!['present', 'absent', 'late', 'excused'].includes(status)) continue;

      const student = await db.prepare('SELECT id FROM students WHERE id = ?').get(student_id);
      if (!student) {
        errorCount++;
        continue;
      }

      const existing = await db.prepare(
        'SELECT id FROM attendance WHERE student_id = ? AND class_id = ? AND attendance_date = ?'
      ).get(student_id, class_id, attendance_date);

      try {
        if (existing) {
          await db.prepare(
            'UPDATE attendance SET status = ?, remarks = ? WHERE student_id = ? AND class_id = ? AND attendance_date = ?'
          ).run(status, remarks ? sanitizeString(remarks) : null, student_id, class_id, attendance_date);
        } else {
          await db.prepare(
            'INSERT INTO attendance (student_id, class_id, attendance_date, status, remarks) VALUES (?, ?, ?, ?, ?)'
          ).run(student_id, class_id, attendance_date, status, remarks ? sanitizeString(remarks) : null);
        }
        successCount++;
      } catch (err) {
        errorCount++;
      }
    }

    return success({
      message: `Bulk attendance processed: ${successCount} successful, ${errorCount} failed`
    });
  } catch (error) {
    console.error('Bulk attendance error:', error);
    return serverError('فشل في معالجة الحضور');
  }
}
