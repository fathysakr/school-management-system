// WhatsApp Cloud API (Meta) service.
// Activates automatically when WHATSAPP_PHONE_ID + WHATSAPP_TOKEN env vars are set.
// Otherwise all send functions silently skip (log-only) so the app keeps working.
//
// TEST MODE: set WHATSAPP_ALLOWED_NUMBERS (comma-separated, any format) to restrict
// sending to specific numbers only — e.g. "01012345678, 01234567890".
// Leave empty to allow sending to everyone.

interface SendResult {
  sent: boolean;
  reason?: string;
}

function isConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_TOKEN);
}

function getAllowedNumbers(): string[] | null {
  const raw = process.env.WHATSAPP_ALLOWED_NUMBERS;
  if (!raw || !raw.trim()) return null; // no restriction
  return raw
    .split(',')
    .map((n) => normalizeArabicPhone(n))
    .filter(Boolean) as string[];
}

/** Returns true if the destination passes the optional allowlist */
export function isNumberAllowed(normalizedPhone: string): boolean {
  const allowed = getAllowedNumbers();
  if (!allowed) return true; // unrestricted
  return allowed.includes(normalizedPhone);
}

/**
 * Normalize Arabic phone numbers to E.164.
 * Supports Saudi (+966, local 05XXXXXXXX) and Egyptian (+20, local 01XXXXXXXXX).
 */
export function normalizeArabicPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let p = String(raw).replace(/[\s\-()]/g, '').trim();
  if (!p) return null;
  // Strip leading zeros used for international dialing (00 / 000)
  p = p.replace(/^0{2,}/, '00');
  // --- Saudi Arabia (+966): mobiles start with 5 after country code
  const saLocal = p.match(/^0(5\d{8})$/);            // 05XXXXXXXX
  if (saLocal) return `+966${saLocal[1]}`;
  if (/^\+966\d{9}$/.test(p)) return p;              // +9665XXXXXXXX
  if (/^00966\d{9}$/.test(p)) return `+${p.slice(2)}`;
  if (/^966\d{9}$/.test(p)) return `+${p}`;          // 9665XXXXXXXX
  // --- Egypt (+20): mobiles start with 1 after country code
  const egLocal = p.match(/^0(1[0125]\d{8})$/);      // 01XXXXXXXXX
  if (egLocal) return `+20${egLocal[1]}`;
  if (/^\+20\d{10}$/.test(p)) return p;
  if (/^0020\d{10}$/.test(p)) return `+${p.slice(2)}`;
  if (/^20\d{10}$/.test(p)) return `+${p}`;
  return null;
}

/** @deprecated use normalizeArabicPhone — kept as alias for compatibility */
export function normalizeEgyptianPhone(raw: string | null | undefined): string | null {
  return normalizeArabicPhone(raw);
}

async function sendText(to: string, message: string): Promise<SendResult> {
  if (!isNumberAllowed(to)) {
    console.log(`[WHATSAPP] ${to} blocked by WHATSAPP_ALLOWED_NUMBERS allowlist — skipped`);
    return { sent: false, reason: 'not-allowed' };
  }
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
        signal: AbortSignal.timeout(15000),
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
  const phone = normalizeArabicPhone(opts.parentPhone);
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
  const phone = normalizeArabicPhone(opts.parentPhone);
  if (!phone) return { sent: false, reason: 'invalid-phone' };

  const message = `📢 *${opts.title}*\nمدرسة صفوة الرواد الأهلية\n\n${opts.content}`;
  return sendText(phone, message);
}

export function whatsappEnabled(): boolean {
  return isConfigured();
}
