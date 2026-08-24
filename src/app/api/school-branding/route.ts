import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, badRequest, serverError, success } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SLOTS = ['logo', 'moe', 'vision'] as const;
type Slot = typeof SLOTS[number];

const MAX_BYTES = 800 * 1024; // 800KB
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon'];

async function ensureTable() {
  await db.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
}

// Public: any page (even login) can render the branding images.
export async function GET() {
  try {
    await ensureTursoReady();
    await ensureTable();
    const rows = await db.prepare("SELECT key, value FROM settings WHERE key IN ('brand_logo','brand_moe','brand_vision')").all() as any[];
    const map: Record<string, string | null> = { logo: null, moe: null, vision: null };
    for (const r of rows) {
      if (r.key === 'brand_logo') map.logo = r.value;
      else if (r.key === 'brand_moe') map.moe = r.value;
      else if (r.key === 'brand_vision') map.vision = r.value;
    }
    return success(map);
  } catch (error: any) {
    console.error('GET school-branding error:', error);
    return serverError('فشل تحميل هوية المدرسة');
  }
}

// Admin only: upload/replace one of the brand images (stored as data URL).
export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    await ensureTable();
    const user = await authenticate(request);
    if (!user) return badRequest('غير مصرح');
    if (user.role !== 'admin') return forbidden('Admin only');

    const formData = await request.formData();
    const slot = String(formData.get('slot') || '');
    if (!SLOTS.includes(slot as Slot)) return badRequest('نوع الشعار غير صالح');
    const file = formData.get('file') as File | null;
    if (!file) return badRequest('يرجى اختيار صورة');
    if (!ALLOWED.includes(file.type)) return badRequest('الصيغة غير مدعومة (PNG/JPG/SVG/WEBP)');
    if (file.size > MAX_BYTES) return badRequest('حجم الصورة كبير جداً (الحد 800 كيلوبايت)');

    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const dataUrl = `data:${file.type};base64,${btoa(bin)}`;

    const key = slot === 'logo' ? 'brand_logo' : slot === 'moe' ? 'brand_moe' : 'brand_vision';
    await db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(key, dataUrl);

    return success({ message: 'تم تحديث الشعار بنجاح', slot });
  } catch (error: any) {
    console.error('POST school-branding error:', error);
    return serverError('فشل رفع الشعار');
  }
}
