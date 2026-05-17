const ULTRAMSG_API = 'https://api.ultramsg.com';

function getInstanceId(): string | null {
  return process.env.ULTRAMSG_INSTANCE_ID || null;
}

function getToken(): string | null {
  return process.env.ULTRAMSG_TOKEN || null;
}

function isConfigured(): boolean {
  return !!(getInstanceId() && getToken());
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
  if (!isConfigured()) return { success: false, error: 'ULTRAMSG not configured' };
  const phone = formatPhone(to);
  if (!phone) return { success: false, error: 'رقم الهاتف غير صالح' };
  try {
    const resp = await fetch(`${ULTRAMSG_API}/${getInstanceId()}/messages/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: getToken(), to: phone, body }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return { success: false, error: `UltraMsg API error: ${resp.status} ${text}` };
    }
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function sendSubstitutionNotification(
  teacherPhone: string,
  data: { subject: string; class_name: string; date: string; time: string; absent_teacher: string }
): Promise<SendResult> {
  const msg = `🔔 *تنبيه حصة انتظار*
تم تكليفك بحصة بديلة:
• المادة: ${data.subject}
• الفصل: ${data.class_name}
• التاريخ: ${data.date}
• الوقت: ${data.time}
• المعلم الغائب: ${data.absent_teacher}

مدرسة صفوة الرواد الأهلية`;
  return sendMessage(teacherPhone, msg);
}

export async function sendReportNotification(
  parentPhone: string,
  data: { student_name: string; report_type: string; title?: string; content: string; teacher_name: string }
): Promise<SendResult> {
  const typeLabels: Record<string, string> = {
    behavioral: '🗂 *تقرير سلوكي*',
    positive: '⭐ *تقرير إيجابي*',
    activity: '📋 *تقرير نشاط*',
    academic_deficiency: '📚 *تقرير ضعف أكاديمي*',
  };
  const header = typeLabels[data.report_type] || '📋 *تقرير*';
  const titleLine = data.title ? `\n• العنوان: ${data.title}` : '';
  const msg = `${header}
الطالب: ${data.student_name}${titleLine}
• المحتوى: ${data.content.slice(0, 500)}
• المعلم: ${data.teacher_name}

مدرسة صفوة الرواد الأهلية`;
  return sendMessage(parentPhone, msg);
}

export async function sendCustomNotification(
  phone: string,
  message: string
): Promise<SendResult> {
  return sendMessage(phone, `📢 *تنبيه*\n${message}\n\nمدرسة صفوة الرواد الأهلية`);
}

export { isConfigured, formatPhone };
