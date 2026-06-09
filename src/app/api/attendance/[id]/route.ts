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

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف سجل الحضور غير صالح');

    const record = await db.prepare(`
      SELECT a.*, s.first_name as student_first, s.last_name as student_last,
             c.class_name
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN classes c ON a.class_id = c.id
      WHERE a.id = ?
    `).get(id) as any;

    if (!record) return notFound('سجل الحضور غير موجود');

    return success({ attendance: record });
  } catch (error) {
    console.error('Get attendance error:', error);
    return serverError('فشل في جلب سجل الحضور');
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

    if (!status || !['present', 'absent', 'late', 'excused', 'escape'].includes(status)) {
      return badRequest('حالة الحضور غير صالحة');
    }

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف سجل الحضور غير صالح');

    const record = await db.prepare('SELECT * FROM attendance WHERE id = ?').get(id);
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

    values.push(id);
    await db.prepare(`UPDATE attendance SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);

    if (status === 'escape') {
      const recordData = record as any;
      const { createNotification } = await import('@/lib/notifications');
      const student = await db.prepare("SELECT first_name, last_name FROM students WHERE id = ?").get(recordData.student_id) as any;
      const cls = await db.prepare("SELECT class_name, grade FROM classes WHERE id = ?").get(recordData.class_id) as any;
      if (student && cls) {
        const isSecondary = cls.grade?.includes('ثانوي');
        const supervisorRole = isSecondary ? 'high_supervisor' : 'middle_supervisor';
        const counselorRole = isSecondary ? 'high_counselor' : 'middle_counselor';
        const title = 'تنبيه هروب طالب';
        const message = `الطالب ${student.first_name} ${student.last_name} من فصل ${cls.class_name} سجل هروب في تاريخ ${recordData.attendance_date}`;
        const targetUsers = await db.prepare("SELECT id FROM users WHERE role IN (?, ?)").all(supervisorRole, counselorRole) as any[];
        for (const u of targetUsers) {
          await createNotification(u.id, title, message, 'urgent', '/dashboard/attendance');
        }
      }
    }

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

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف سجل الحضور غير صالح');

    const record = await db.prepare('SELECT * FROM attendance WHERE id = ?').get(id);
    if (!record) return notFound('سجل الحضور غير موجود');

    await db.prepare('DELETE FROM attendance WHERE id = ?').run(id);

    return success({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    console.error('Delete attendance error:', error);
    return serverError('فشل في حذف سجل الحضور');
  }
}
