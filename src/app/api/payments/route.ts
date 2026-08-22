import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, serverError, success } from '@/lib/auth';
import { sanitizeString } from '@/lib/validation';
import { hasPermission, getSchoolFilter } from '@/lib/permissions';

const PAYMENT_METHODS = ['cash', 'bank', 'wallet', 'other'];

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'fees:view')) return forbidden();

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const term = searchParams.get('term');
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '200') || 200));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);

    let query = `
      SELECT p.*, s.first_name || ' ' || s.last_name AS student_name,
             s.student_id AS student_code, s.grade AS student_grade, s.school AS student_school,
             u.email AS recorded_by_email
      FROM payments p
      JOIN students s ON p.student_id = s.id
      LEFT JOIN users u ON p.recorded_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    const schoolFilter = getSchoolFilter(user.role);
    if (schoolFilter.school) {
      query += ' AND s.school = ?';
      params.push(schoolFilter.school);
    }

    if (studentId) {
      const sid = parseInt(studentId);
      if (isNaN(sid)) return badRequest('معرف الطالب غير صالح');
      query += ' AND p.student_id = ?';
      params.push(sid);
    }
    if (from) {
      query += ' AND p.payment_date >= ?';
      params.push(from);
    }
    if (to) {
      query += ' AND p.payment_date <= ?';
      params.push(to);
    }
    if (term) {
      query += ' AND p.term = ?';
      params.push(term);
    }

    query += ' ORDER BY p.payment_date DESC, p.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const payments = await db.prepare(query).all(...params);

    let countQuery = `SELECT COUNT(*) as total FROM payments p JOIN students s ON p.student_id = s.id WHERE 1=1`;
    const countParams: any[] = [];
    if (schoolFilter.school) {
      countQuery += ' AND s.school = ?';
      countParams.push(schoolFilter.school);
    }
    if (studentId) {
      countQuery += ' AND p.student_id = ?';
      countParams.push(parseInt(studentId));
    }
    if (from) { countQuery += ' AND p.payment_date >= ?'; countParams.push(from); }
    if (to) { countQuery += ' AND p.payment_date <= ?'; countParams.push(to); }

    const countRow: any = await db.prepare(countQuery).get(...countParams);

    return success({ payments, total: countRow?.total ?? payments.length });
  } catch (error) {
    console.error('Get payments error:', error);
    return serverError('فشل في جلب الدفعات');
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'fees:create')) return forbidden();

    const body = await request.json();
    const { student_id, amount, payment_date, term, method, receipt_no, notes } = body;

    const sid = parseInt(student_id);
    if (isNaN(sid)) return badRequest('يجب اختيار طالب صحيح');

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return badRequest('المبلغ يجب أن يكون رقماً أكبر من صفر');

    const date = payment_date ? String(payment_date).trim() : new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest('تاريخ الدفعة غير صالح');

    const m = method ? String(method) : 'cash';
    if (!PAYMENT_METHODS.includes(m)) return badRequest('طريقة الدفع غير صالحة');

    const student: any = await db.prepare('SELECT id FROM students WHERE id = ?').get(sid);
    if (!student) return badRequest('الطالب غير موجود');

    const result: any = await db.prepare(
      `INSERT INTO payments (student_id, amount, payment_date, term, method, receipt_no, notes, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      sid, amt, date,
      term ? sanitizeString(term) : '',
      m,
      receipt_no ? sanitizeString(receipt_no) : null,
      notes ? sanitizeString(notes) : null,
      user.id
    );

    const newId = Number(result?.lastInsertRowid ?? result?.lastID ?? result?.insertId ?? 0);
    let created: any = null;
    if (newId > 0) {
      created = await db.prepare(
        `SELECT p.*, s.first_name || ' ' || s.last_name AS student_name
         FROM payments p JOIN students s ON p.student_id = s.id WHERE p.id = ?`
      ).get(newId);
    }

    return success({ payment: created }, 201);
  } catch (error) {
    console.error('Create payment error:', error);
    return serverError('فشل في تسجيل الدفعة');
  }
}
