import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, forbidden, badRequest, serverError, success } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { previewPdfPages } from '@/lib/pdf-schedule-parser';

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'schedules:create')) return forbidden();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return badRequest('الملف مطلوب');
    if (!file.name.toLowerCase().endsWith('.pdf')) return badRequest('يرجى رفع ملف PDF');

    const ptRows = await db.prepare('SELECT period_number, start_time, end_time FROM period_times ORDER BY period_number').all() as any[];
    const periodTimes = ptRows.map((r: any) => ({ start: r.start_time, end: r.end_time }));

    const buffer = new Uint8Array(await file.arrayBuffer());
    const preview = await previewPdfPages(buffer, periodTimes);

    const allClasses = await db.prepare('SELECT id, class_name, grade, section FROM classes WHERE status = ?').all('active') as any[];

    return success({ preview, classes: allClasses });
  } catch (error: any) {
    console.error('Preview PDF error:', error);
    const msg = error.message || 'فشل معاينة PDF';
    return serverError(msg);
  }
}
