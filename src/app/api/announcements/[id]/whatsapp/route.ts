import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { sendAnnouncement, whatsappEnabled, normalizeArabicPhone } from '@/lib/whatsapp';

// POST /api/announcements/[id]/whatsapp — send an announcement to targeted parents via WhatsApp
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'announcements:create')) return forbidden();

    if (!whatsappEnabled()) {
      return badRequest('خدمة الواتساب غير مفعلة. برجاء إعداد WHATSAPP_PHONE_ID و WHATSAPP_TOKEN');
    }

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف الإعلان غير صالح');

    const announcement = await db.prepare('SELECT * FROM announcements WHERE id = ? AND status = ?').get(id, 'active') as any;
    if (!announcement) return notFound('الإعلان غير موجود');

    // Only parents-targeted or all announcements make sense to broadcast
    const target = String(announcement.target_audience || 'all');
    if (target === 'teachers' || target === 'students') {
      return badRequest('لا يمكن إرسال هذا الإعلان لأولياء الأمور (الفئة المستهدفة مختلفة)');
    }

    // Resolve recipients: parents of a specific class, or all parents
    let phones: string[] = [];
    if (announcement.class_id) {
      const rows = await db.prepare(`
        SELECT s.parent_phone, s.parent_phones FROM students s
        JOIN enrollments e ON e.student_id = s.id
        WHERE e.class_id = ? AND e.status = 'active' AND s.status = 'active'
      `).all(announcement.class_id) as any[];
      for (const r of rows) {
        phones.push(r.parent_phone, ...String(r.parent_phones || '').split(','));
      }
    } else {
      const rows = await db.prepare("SELECT parent_phone, parent_phones FROM students WHERE status = 'active'").all() as any[];
      for (const r of rows) {
        phones.push(r.parent_phone, ...String(r.parent_phones || '').split(','));
      }
    }

    const normalized = Array.from(new Set(
      phones.map((p: string) => normalizeArabicPhone(String(p || '').trim())).filter(Boolean)
    )) as string[];

    if (normalized.length === 0) {
      return success({ message: 'لا توجد أرقام والدين صالحة للإرسال', sent: 0, failed: 0 });
    }

    let sentCount = 0;
    let failedCount = 0;

    // Parallel waves: chunks of 25 sent concurrently, up to 4 chunks in flight.
    // Keeps well under Meta rate limits while finishing ~10x faster than sequential
    // sending so the request stays inside serverless timeout limits.
    const CHUNK = 25;
    const WAVES = 4;
    const chunks: string[][] = [];
    for (let i = 0; i < normalized.length; i += CHUNK) {
      chunks.push(normalized.slice(i, i + CHUNK));
    }

    for (let w = 0; w < chunks.length; w += WAVES) {
      const wave = chunks.slice(w, w + WAVES);
      const results = await Promise.all(
        wave.map((chunk) =>
          Promise.allSettled(
            chunk.map((phone) =>
              sendAnnouncement({
                parentPhone: phone,
                title: announcement.title,
                content: announcement.content,
              })
            )
          )
        )
      );
      for (const chunkResults of results) {
        for (const r of chunkResults) {
          if (r.status === 'fulfilled' && r.value.sent) sentCount++;
          else failedCount++;
        }
      }
    }

    return success({
      message: `تم إرسال ${sentCount} رسالة${failedCount > 0 ? ` — فشل ${failedCount}` : ''}`,
      total: normalized.length,
      sent: sentCount,
      failed: failedCount,
    });
  } catch (error) {
    console.error('Announcement WhatsApp error:', error);
    return serverError('فشل إرسال الإعلان');
  }
}
