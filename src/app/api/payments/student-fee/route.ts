import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'fees:edit')) return forbidden();

    const body = await request.json();
    const { student_id, annual_fee } = body;

    const sid = parseInt(student_id);
    if (isNaN(sid)) return badRequest('معرف الطالب غير صالح');

    const fee = parseFloat(annual_fee);
    if (isNaN(fee) || fee < 0) return badRequest('قيمة الرسوم السنوية غير صالحة');

    const student: any = await db.prepare('SELECT id FROM students WHERE id = ?').get(sid);
    if (!student) return notFound('الطالب غير موجود');

    try { await db.prepare('UPDATE students SET annual_fee = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(fee, sid); }
    catch {
      await db.prepare('UPDATE students SET annual_fee = ? WHERE id = ?').run(fee, sid);
    }

    return success({ student_id: sid, annual_fee: fee });
  } catch (error) {
    console.error('Set annual fee error:', error);
    return serverError('فشل في تحديث الرسوم السنوية');
  }
}
