const DEFAULT_API = 'https://graph.facebook.com/v22.0';

function getApiUrl(): string {
  return process.env.WHATSAPP_API_URL || DEFAULT_API;
}

function getPhoneId(): string | null {
  return process.env.WHATSAPP_PHONE_ID || null;
}

function getToken(): string | null {
  return process.env.WHATSAPP_TOKEN || null;
}

function isConfigured(): boolean {
  return !!(getToken());
}

function formatPhone(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('05') || cleaned.startsWith('5')) {
    cleaned = '966' + cleaned.replace(/^0?5/, '5');
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }
  return cleaned.replace(/\D/g, '');
}

type SendResult = { success: boolean; error?: string };

async function sendMessage(to: string, body: string): Promise<SendResult> {
  if (!isConfigured()) return { success: false, error: 'WHATSAPP_TOKEN not configured' };
  const phone = formatPhone(to);
  if (!phone) return { success: false, error: 'رقم الهاتف غير صالح' };
  try {
    const apiUrl = getApiUrl();
    const phoneId = getPhoneId();

    // Meta Cloud API
    if (apiUrl.includes('graph.facebook.com')) {
      if (!phoneId) return { success: false, error: 'WHATSAPP_PHONE_ID مطلوب' };
      const resp = await fetch(`${apiUrl}/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: 'text',
          text: { preview_url: false, body },
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        return { success: false, error: `WhatsApp API error: ${resp.status} ${text}` };
      }
      return { success: true };
    }

    // Generic provider - sends POST with JSON body
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: phone, message: body, phone: phoneId }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return { success: false, error: `Provider error: ${resp.status} ${text}` };
    }
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

const reportTypes: Record<string, string> = {
  behavioral: '🗂 تقرير سلوكي',
  positive: '⭐ تقرير إيجابي',
  activity: '📋 تقرير نشاط',
  academic_deficiency: '📚 تقرير ضعف أكاديمي',
};

export async function sendSubstitutionNotification(
  teacherPhone: string,
  data: { subject: string; class_name: string; date: string; time: string; absent_teacher: string }
): Promise<SendResult> {
  return sendMessage(teacherPhone,
    `🔔 تنبيه حصة انتظار
تم تكليفك بحصة بديلة:
• المادة: ${data.subject}
• الفصل: ${data.class_name}
• التاريخ: ${data.date}
• الوقت: ${data.time}
• المعلم الغائب: ${data.absent_teacher}

مدرسة صفوة الرواد الأهلية`);
}

export async function sendReportNotification(
  phone: string,
  data: { student_name: string; report_type: string; title?: string; content: string; teacher_name: string }
): Promise<SendResult> {
  const header = reportTypes[data.report_type] || '📋 تقرير';
  const titleLine = data.title ? `\n• العنوان: ${data.title}` : '';
  return sendMessage(phone,
    `${header}
الطالب: ${data.student_name}${titleLine}
• المحتوى: ${data.content.slice(0, 500)}
• المعلم: ${data.teacher_name}

مدرسة صفوة الرواد الأهلية`);
}

export async function sendCustomNotification(phone: string, message: string): Promise<SendResult> {
  return sendMessage(phone, `📢 تنبيه\n${message}\n\nمدرسة صفوة الرواد الأهلية`);
}

export { isConfigured, formatPhone };
