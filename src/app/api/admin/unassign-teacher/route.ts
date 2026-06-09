import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, serverError, success } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden('Admin only');

    const { teacher_id } = await request.json() as { teacher_id?: number };
    if (!teacher_id || typeof teacher_id !== 'number') {
      return badRequest('معرف المدرس مطلوب');
    }

    await db.transaction(async () => {
      await db.prepare('UPDATE subjects SET teacher_id = NULL WHERE teacher_id = ?').run(teacher_id);
      await db.prepare('UPDATE classes SET teacher_id = NULL WHERE teacher_id = ?').run(teacher_id);
      await db.prepare('UPDATE teachers SET specialization = ? WHERE id = ?').run('[]', teacher_id);
    })();

    return success({ message: 'تم إلغاء التعيينات بنجاح' });
  } catch (error) {
    console.error('Unassign teacher error:', error);
    return serverError('فشل في إلغاء التعيينات');
  }
}
