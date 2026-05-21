import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';
import { sanitizeString } from '@/lib/validation';
import { hasPermission } from '@/lib/permissions';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'attendance:view')) return forbidden();

    const record = await db.prepare(`
      SELECT a.*, s.first_name as student_first, s.last_name as student_last,
             c.class_name
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN classes c ON a.class_id = c.id
      WHERE a.id = ?
    `).get(parseInt(params.id)) as any;

    if (!record) return notFound('سجل الحضور غير موجود');

    return success({ attendance: record });
  } catch (error) {
    console.error('Get attendance error:', error);
    return serverError('Failed to fetch attendance record');
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'attendance:edit')) return forbidden();

    const body = await request.json();
    const { status, remarks } = body;

    if (!status || !['present', 'absent', 'late', 'excused'].includes(status)) {
      return badRequest('حالة الحضور غير صالحة');
    }

    const record = await db.prepare('SELECT * FROM attendance WHERE id = ?').get(parseInt(params.id));
    if (!record) return notFound('سجل الحضور غير موجود');

    const updates: string[] = [];
    const values: any[] = [];

    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (remarks !== undefined) {
      updates.push('remarks = ?');
      values.push(remarks ? sanitizeString(remarks) : null);
    }

    if (updates.length === 0) return badRequest('لا توجد بيانات للتحديث');

    values.push(parseInt(params.id));
    await db.prepare(`UPDATE attendance SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);

    return success({ message: 'Attendance record updated successfully' });
  } catch (error) {
    console.error('Update attendance error:', error);
    return serverError('فشل في تحديث سجل الحضور');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'attendance:delete')) return forbidden();

    const record = await db.prepare('SELECT * FROM attendance WHERE id = ?').get(parseInt(params.id));
    if (!record) return notFound('سجل الحضور غير موجود');

    await db.prepare('DELETE FROM attendance WHERE id = ?').run(parseInt(params.id));

    return success({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    console.error('Delete attendance error:', error);
    return serverError('فشل في حذف سجل الحضور');
  }
}
