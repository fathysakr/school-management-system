import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'students:edit')) return forbidden();

    const body = await request.json();
    const { student_id, class_id } = body;

    if (!student_id || !class_id) {
      return badRequest('Student ID and Class ID are required');
    }

    // Verify student and class exist
    const student = await db.prepare('SELECT id FROM students WHERE id = ? AND status = "active"').get(student_id);
    if (!student) return badRequest('Student not found or inactive');

    const classData = await db.prepare('SELECT id, capacity FROM classes WHERE id = ? AND status = "active"').get(class_id) as any;
    if (!classData) return badRequest('Class not found or inactive');

    // Check capacity
    const enrolled = await db.prepare('SELECT COUNT(*) as count FROM enrollments WHERE class_id = ? AND status = "active"').get(class_id) as any;
    if (enrolled.count >= classData.capacity) {
      return badRequest('Class is at full capacity');
    }

    // Check if already enrolled
    const existing = await db.prepare(
      'SELECT id FROM enrollments WHERE student_id = ? AND class_id = ? AND status = "active"'
    ).get(student_id, class_id);
    if (existing) {
      return badRequest('Student is already enrolled in this class');
    }

    const stmt = await db.prepare(`
      INSERT INTO enrollments (student_id, class_id, enrollment_date, status)
      VALUES (?, ?, CURRENT_DATE, 'active')
    `);

    const result = await stmt.run(student_id, class_id);

    return success({
      message: 'Student enrolled successfully',
      enrollment_id: result.lastInsertRowid
    }, 201);
  } catch (error) {
    console.error('Enroll student error:', error);
    return serverError('Failed to enroll student');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'students:edit')) return forbidden();

    const { searchParams } = new URL(request.url);
    const student_id = searchParams.get('student_id');
    const class_id = searchParams.get('class_id');

    if (!student_id || !class_id) {
      return badRequest('Student ID and Class ID are required');
    }

    const enrollment = await db.prepare(
      'SELECT id FROM enrollments WHERE student_id = ? AND class_id = ? AND status = "active"'
    ).get(parseInt(student_id), parseInt(class_id));

    if (!enrollment) return notFound('Enrollment not found');

    await db.prepare('UPDATE enrollments SET status = ? WHERE student_id = ? AND class_id = ?')
      .run('dropped', parseInt(student_id), parseInt(class_id));

    return success({ message: 'Student unenrolled successfully' });
  } catch (error) {
    console.error('Unenroll student error:', error);
    return serverError('Failed to unenroll student');
  }
}
