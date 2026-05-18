import db from '@/lib/database';

export async function GET() {
  try {
    const users = await db.prepare('SELECT id, email, role FROM users LIMIT 5').all();
    const tursoUrl = !!process.env.TURSO_DB_URL;
    const tursoToken = !!process.env.TURSO_DB_TOKEN;
    return Response.json({
      ok: true,
      tursoUrl,
      tursoToken,
      users,
    });
  } catch (e: any) {
    return Response.json({
      ok: false,
      error: e?.message || String(e),
    }, { status: 500 });
  }
}
