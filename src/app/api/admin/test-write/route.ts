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

    // Test: write a temp row, read it back, delete it
    await db.prepare("CREATE TABLE IF NOT EXISTS _write_test (val INTEGER)").run();
    await db.prepare("DELETE FROM _write_test").run();
    await db.prepare("INSERT INTO _write_test (val) VALUES (42)").run();
    const row = await db.prepare("SELECT val FROM _write_test LIMIT 1").get() as any;
    await db.prepare("DROP TABLE _write_test").run();

    const writeOk = row?.val === 42;

    return success({
      writeTest: writeOk ? 'PASS' : 'FAIL',
      status,
    });
  } catch (error) {
    console.error('Test write error:', error);
    return new Response(JSON.stringify({ error: 'فشل اختبار الكتابة', status: getDbStatus() }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
