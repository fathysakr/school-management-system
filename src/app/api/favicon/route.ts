import { NextRequest, NextResponse } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    try {
      await db.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
      const row = await db.prepare("SELECT value FROM settings WHERE key = 'brand_logo'").get() as any;
      const val: string | undefined = row?.value;
      if (val && val.startsWith('data:')) {
        const m = /^data:([^;,]+);base64,([\s\S]*)$/.exec(val);
        if (m) {
          const buf = Buffer.from(m[2], 'base64');
          return new NextResponse(buf, {
            headers: { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=300' },
          });
        }
      }
    } catch {
      /* fall through to default */
    }
    return NextResponse.redirect(new URL('/logo.png', request.url), 302);
  } catch {
    return NextResponse.redirect(new URL('/logo.png', request.url), 302);
  }
}
