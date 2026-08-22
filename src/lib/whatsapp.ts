// WhatsApp Cloud API (Meta) service.
// Activates automatically when WHATSAPP_PHONE_ID + WHATSAPP_TOKEN env vars are set.
// Otherwise all send functions silently skip (log-only) so the app keeps working.

interface SendResult {
  sent: boolean;
  reason?: string;
}

function isConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_TOKEN);
}

/** Normalize Egyptian phone numbers to E.164 (+20XXXXXXXXXX) */
export function normalizeEgyptianPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let p = String(raw).replace(/[\s\-()]/g, '').trim();
  if (!p) return null;
  // Local formats: 010xxxxxxxx, 012..., 011..., 015...
  const localMatch = p.match(/^0(1[0125]\d{8})$/);
  if (localMatch) return `+20${localMatch[1]}`;
  // Already international: +2010... or 002010...
  if (/^\+20\d{10}$/.test(p)) return p;
  if (/^0020\d{10}$/.test(p)) return `+${p.slice(2)}`;
  if (/^20\d{10}$/.test(p)) return `+${p}`;
  return null;
}

async function sendText(to: string, message: string): Promise<SendResult> {
  if (!isConfigured()) {
    console.log(`[WHATSAPP] not configured — would send to ${to}: ${message.substring(0, 60)}...`);
    return { sent: false, reason: 'not-configured' };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[WHATSAPP] send failed to ${to}:`, errText.substring(0, 200));
      return { sent: false, reason: 'api-error' };
    }
    return { sent: true };
  } catch (error) {
    console.error('[WHATSAPP] network error:', error instanceof Error ? error.message : error);
    return { sent: false, reason: 'network-error' };
  }
}

/** Fire-and-forget helpers — never throw into the caller's request flow */

export async function sendAbsenceAlert(opts: {
  parentPhone: string;
  studentName: string;
  className: string;
  date: string;
  period?: number;
  status: 'absent' | 'late' | 'escape';
}): Promise<SendResult> {
  const phone = normalizeEgyptianPhone(opts.parentPhone);
  if (!phone) return { sent: false, reason: 'invalid-phone' };

  const statusLabel = opts.status === 'escape' ? 'الخروج بدون إذن' : opts.status === 'late' ? 'التأخير' : 'الغياب';
  const emoji = opts.status === 'escape' ? '🚨' : opts.status === 'late' ? '⏰' : '❌';

  const message =
    `${emoji} تنبيه من مدرسة صفوة الرواد الأهلية\n\n` +
    `سيد ولي الأمر،\n` +
    `نفيدكم بأن الطالب: *${opts.studentName}*\n` +
    `الفصل: ${opts.className}\n` +
    `تم تسجيل *${statusLabel}* بتاريخ ${opts.date}${opts.period ? ` - الحصة ${opts.period}` : ''}.\n\n` +
    `برجاء التواصل مع إدارة المدرسة عند الضرورة.`;

  return sendText(phone, message);
}

export async function sendAnnouncement(opts: {
  parentPhone: string;
  title: string;
  content: string;
}): Promise<SendResult> {
  const phone = normalizeEgyptianPhone(opts.parentPhone);
  if (!phone) return { sent: false, reason: 'invalid-phone' };

  const message = `📢 *${opts.title}*\nمدرسة صفوة الرواد الأهلية\n\n${opts.content}`;
  return sendText(phone, message);
}

export function whatsappEnabled(): boolean {
  return isConfigured();
}
