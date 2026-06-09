import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, unauthorized, success } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden('Admin only');

    await db.prepare("UPDATE classes SET teacher_id = NULL").run();
    return success({ message: 'تم مسح اسناد الفصول لكل المعلمين' });
  } catch (error) {
    console.error('Clear all class teachers error:', error);
    return new Response(JSON.stringify({ error: 'فشل في مسح اسناد الفصول' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
