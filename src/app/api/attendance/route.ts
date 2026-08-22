import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, serverError, success } from '@/lib/auth';
import { sanitizeString } from '@/lib/validation';
import { hasPermission, getSchoolFilter } from '@/lib/permissions';
import { createNotification } from '@/lib/notifications';
import { sendAbsenceAlert } from '@/lib/whatsapp';


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
    const period = searchParams.get('period');

    let query = 'SELECT a.* FROM attendance a JOIN classes c ON a.class_id = c.id WHERE 1=1';
    const params: any[] = [];

    const schoolFilter = getSchoolFilter(user.role, searchParams.get('school') || undefined);
    if (schoolFilter.grade) {
      query += ' AND c.grade LIKE ?';
      params.push(`%${schoolFilter.grade}%`);
    }

    if (student_id) {
      const sid = parseInt(student_id);
      if (isNaN(sid)) return badRequest('معرف الطالب غير صالح');
      query += ' AND a.student_id = ?';
      params.push(sid);
    }

    if (class_id) {
      const cid = parseInt(class_id);
      if (isNaN(cid)) return badRequest('معرف الفصل غير صالح');
      query += ' AND a.class_id = ?';
      params.push(cid);
    }

    if (date) {
      query += ' AND attendance_date = ?';
      params.push(date);
    }

    if (period) {
      const p = parseInt(period);
      if (isNaN(p)) return badRequest('رقم الحصة غير صالح');
      query += ' AND a.period = ?';
      params.push(p);
    }

    query += ' ORDER BY a.attendance_date DESC, a.period, a.student_id';

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
    const { student_id, class_id, attendance_date, period, status, remarks } = body;
    const periodVal = period !== undefined && period !== null && period !== '' ? parseInt(period) : 1;
    if (period !== undefined && period !== null && period !== '' && isNaN(periodVal)) return badRequest('رقم الحصة غير صالح');

    if (!student_id || !class_id || !attendance_date || !status) {
      return badRequest('معرف الطالب والفصل والتاريخ والحالة مطلوبة');
    }

    if (!['present', 'absent', 'late', 'excused', 'escape'].includes(status)) {
      return badRequest('حالة الحضور غير صالحة');
    }

    // Verify student and class
    const student = await db.prepare('SELECT id FROM students WHERE id = ?').get(student_id);
    if (!student) return badRequest('الطالب غير موجود');

    const classData = await db.prepare('SELECT id FROM classes WHERE id = ?').get(class_id);
    if (!classData) return badRequest('الفصل غير موجود');

    // Check if record exists for same student+class+date+period
    const existing = await db.prepare(
      'SELECT id FROM attendance WHERE student_id = ? AND class_id = ? AND attendance_date = ? AND period = ?'
    ).get(student_id, class_id, attendance_date, periodVal);

    const notifyParentIfAbsent = async () => {
      if (status === 'present' || status === 'excused') return;
      // Await so serverless platforms don't kill the send after the response
      await notifyParentOfAbsence(student_id, Number(class_id), attendance_date, periodVal, status);
    };

    if (existing) {
      // Update
      await db.prepare(
        'UPDATE attendance SET status = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE student_id = ? AND class_id = ? AND attendance_date = ? AND period = ?'
      ).run(status, remarks ? sanitizeString(remarks) : null, student_id, class_id, attendance_date, periodVal);

      // If escape, notify supervisor and counselor
      if (status === 'escape') {
        notifyEscapeAlert(student_id, class_id, attendance_date);
      }
      await notifyParentIfAbsent();

      return success({ message: 'Attendance updated successfully' });
    } else {
      // Insert
      const stmt = db.prepare(`
        INSERT INTO attendance (student_id, class_id, attendance_date, period, status, remarks)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = await stmt.run(
        student_id,
        class_id,
        attendance_date,
        periodVal,
        status,
        remarks ? sanitizeString(remarks) : null
      );

      // If escape, notify supervisor and counselor
      if (status === 'escape') {
        notifyEscapeAlert(student_id, class_id, attendance_date);
      }
      await notifyParentIfAbsent();

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
    const { class_id, attendance_date, period, records } = body;
    const periodVal = period !== undefined && period !== null && period !== '' ? parseInt(period) : 1;
    if (period !== undefined && period !== null && period !== '' && isNaN(periodVal)) return badRequest('رقم الحصة غير صالح');

    if (!class_id || !attendance_date || !Array.isArray(records)) {
      return badRequest('معرف الفصل والتاريخ وسجل الحضور مطلوبة');
    }

    const classData = await db.prepare('SELECT id FROM classes WHERE id = ?').get(class_id);
    if (!classData) return badRequest('الفصل غير موجود');

    let successCount = 0;
    let errorCount = 0;
    const absentStudentIds: { student_id: number; status: 'absent' | 'late' | 'escape' }[] = [];

    // Validate ALL student ids in a single query instead of one query per record
    const candidateIds = records
      .map((r: any) => parseInt(r?.student_id))
      .filter((n: any) => !isNaN(n));
    const foundStudents = candidateIds.length
      ? (await db.prepare(
          `SELECT id FROM students WHERE id IN (${candidateIds.map(() => '?').join(',')})`
        ).all(...candidateIds)) as any[]
      : [];
    const validStudentIds = new Set(foundStudents.map((f: any) => Number(f.id)));

    const UPSERT_SQL = `
      INSERT INTO attendance (student_id, class_id, attendance_date, period, status, remarks)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(student_id, class_id, attendance_date, period)
      DO UPDATE SET status = excluded.status,
                    remarks = excluded.remarks,
                    updated_at = CURRENT_TIMESTAMP
    `;

    const processRecords = async () => {
      for (const record of records) {
        const { student_id, status, remarks } = record;

        if (!student_id || !status) continue;
        if (!['present', 'absent', 'late', 'excused', 'escape'].includes(status)) continue;
        if (!validStudentIds.has(Number(student_id))) {
          errorCount++;
          continue;
        }

        try {
          // Single upsert replaces the previous SELECT-existence-check + UPDATE/INSERT pair
          await db.prepare(UPSERT_SQL).run(
            student_id, class_id, attendance_date, periodVal,
            status, remarks ? sanitizeString(remarks) : null
          );
          if (status === 'escape') {
            notifyEscapeAlert(student_id, class_id, attendance_date);
          }
          if (status === 'absent' || status === 'late' || status === 'escape') {
            absentStudentIds.push({ student_id, status });
          }
          successCount++;
        } catch (err) {
          errorCount++;
        }
      }
    };

    try {
      const txFn = (db as any)?.transaction;
      if (typeof txFn === 'function') {
        await txFn(processRecords)();
      } else {
        await processRecords();
      }
    } catch (err) {
      console.error('Attendance transaction failed:', err);
      await processRecords();
    }

    // Send parent WhatsApp alerts in parallel (non-blocking for the response payload)
    if (absentStudentIds.length > 0) {
      await Promise.allSettled(
        absentStudentIds.map((a) =>
          notifyParentOfAbsence(a.student_id, Number(class_id), attendance_date, periodVal, a.status)
        )
      );
    }

    return success({
      message: `Bulk attendance processed: ${successCount} successful, ${errorCount} failed`
    });
  } catch (error) {
    console.error('Bulk attendance error:', error);
    return serverError('فشل في معالجة الحضور');
  }
}

// Helper: notify supervisor & counselor about escape
async function notifyEscapeAlert(student_id: number, class_id: number, attendance_date: string) {
  try {
    const student = await db.prepare("SELECT first_name, last_name FROM students WHERE id = ?").get(student_id) as any;
    const cls = await db.prepare("SELECT class_name, grade FROM classes WHERE id = ?").get(class_id) as any;
    if (!student || !cls) return;

    const isSecondary = cls.grade?.includes('ثانوي');
    const supervisorRole = isSecondary ? 'high_supervisor' : 'middle_supervisor';
    const counselorRole = isSecondary ? 'high_counselor' : 'middle_counselor';

    const title = 'تنبيه هروب طالب';
    const message = `الطالب ${student.first_name} ${student.last_name} من فصل ${cls.class_name} سجل هروب في تاريخ ${attendance_date}`;

    const targetUsers = await db.prepare(
      "SELECT id FROM users WHERE role IN (?, ?)"
    ).all(supervisorRole, counselorRole) as any[];

    for (const u of targetUsers) {
      await createNotification(u.id, title, message, 'urgent', '/dashboard/attendance');
    }
  } catch (err) {
    console.error('Escape notification error:', err);
  }
}

// Helper: WhatsApp alert to parent on absence / late / escape (fire-and-forget)
async function notifyParentOfAbsence(
  student_id: number,
  class_id: number,
  attendance_date: string,
  period: number,
  status: 'absent' | 'late' | 'escape'
) {
  try {
    const student = await db.prepare(
      "SELECT first_name, last_name, parent_phone, parent_phones FROM students WHERE id = ?"
    ).get(student_id) as any;
    if (!student) return;
    const cls = await db.prepare("SELECT class_name FROM classes WHERE id = ?").get(class_id) as any;

    const phones = [student.parent_phone, ...(String(student.parent_phones || '').split(','))]
      .map((p: any) => String(p || '').trim())
      .filter(Boolean);

    const uniquePhones = Array.from(new Set(phones));
    if (uniquePhones.length === 0) return;

    const studentName = `${student.first_name} ${student.last_name}`.trim();
    await Promise.allSettled(
      uniquePhones.map((phone) =>
        sendAbsenceAlert({
          parentPhone: phone,
          studentName,
          className: cls?.class_name || '',
          date: attendance_date,
          period,
          status,
        })
      )
    );
  } catch (err) {
    console.error('Parent absence notification error:', err);
  }
}
