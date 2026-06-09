import { NextRequest } from 'next/server';
import db, { ensureTursoReady, getDbStatus } from '@/lib/database';
import { authenticate, forbidden, unauthorized, success } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden('Admin only');

    const status = getDbStatus();

    const classCount = await db.prepare('SELECT COUNT(*) as cnt FROM classes').get() as any;
    const teacherCount = await db.prepare('SELECT COUNT(*) as cnt FROM teachers').get() as any;
    const subjectCount = await db.prepare('SELECT COUNT(*) as cnt FROM subjects').get() as any;

    return success({ ...status, counts: { classes: classCount?.cnt || 0, teachers: teacherCount?.cnt || 0, subjects: subjectCount?.cnt || 0 } });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
