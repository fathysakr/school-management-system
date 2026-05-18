type Provider = 'meta' | 'evolution';
type SendResult = { success: boolean; error?: string };

function getProvider(): Provider {
  return (process.env.WHATSAPP_PROVIDER as Provider) || 'meta';
}

function getApiUrl(): string {
  return process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v22.0';
}

function getPhoneId(): string {
  return process.env.WHATSAPP_PHONE_ID || '';
}

function getToken(): string {
  return process.env.WHATSAPP_TOKEN || '';
}

function isConfigured(): boolean {
  return !!getToken();
}

function formatPhone(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('05') || cleaned.startsWith('5')) {
    cleaned = '966' + cleaned.replace(/^0?5/, '5');
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }
  if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);
  return cleaned.replace(/\D/g, '');
}

async function sendMessage(to: string, body: string): Promise<SendResult> {
  if (!isConfigured()) return { success: false, error: 'WHATSAPP_TOKEN غير مضبوط' };
  const phone = formatPhone(to);
  if (!phone) return { success: false, error: 'رقم الهاتف غير صالح' };
  try {
    const provider = getProvider();

    if (provider === 'evolution') {
      const instanceName = process.env.WHATSAPP_INSTANCE || 'default';
      const apiUrl = `${getApiUrl()}/message/sendText/${instanceName}`;
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'apiKey': getToken(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: phone, text: body }),
      });
      if (!resp.ok) return { success: false, error: `Evolution API error: ${resp.status}` };
      return { success: true };
    }

    // Default: Meta Cloud API
    const phoneId = getPhoneId();
    if (!phoneId) return { success: false, error: 'WHATSAPP_PHONE_ID مطلوب' };
    const resp = await fetch(`${getApiUrl()}/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', recipient_type: 'individual', to: phone,
        type: 'text', text: { preview_url: false, body },
      }),
    });
    if (!resp.ok) return { success: false, error: `WhatsApp API error: ${resp.status}` };
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

const reportTypeLabels: Record<string, string> = {
  behavioral: '🗂 تقرير سلوكي', positive: '⭐ تقرير إيجابي',
  activity: '📋 تقرير نشاط', academic_deficiency: '📚 تقرير ضعف أكاديمي',
};

export async function sendSubstitutionNotification(teacherPhone: string, data: { subject: string; class_name: string; date: string; time: string; absent_teacher: string }): Promise<SendResult> {
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

export async function sendReportNotification(phone: string, data: { student_name: string; report_type: string; title?: string; content: string; teacher_name: string }): Promise<SendResult> {
  const header = reportTypeLabels[data.report_type] || '📋 تقرير';
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
