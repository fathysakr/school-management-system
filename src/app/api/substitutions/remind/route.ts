import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { sendSubstitutionReminder } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

/**
 * Cron-triggered endpoint (runs every minute via Vercel cron).
 * Finds approved substitutions starting in ~4 minutes and sends WhatsApp reminders.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    await ensureTursoReady();

    const now = new Date();
    // Saudi Arabia is UTC+3
    const saudiNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const today = saudiNow.toISOString().split('T')[0];
    const currentHHMM = `${String(saudiNow.getHours()).padStart(2, '0')}:${String(saudiNow.getMinutes()).padStart(2, '0')}`;

    // Target: substitutions whose start_time is within 4 minutes from now
    const [curH, curM] = currentHHMM.split(':').map(Number);
    const targetMins = curH * 60 + curM + 4;
    const targetH = String(Math.floor(targetMins / 60) % 24).padStart(2, '0');
    const targetM = String(targetMins % 60).padStart(2, '0');
    const targetTime = `${targetH}:${targetM}`;

    // Find approved substitutions for today with this start_time that haven't been reminded
    const subs = await db.prepare(`
      SELECT s.id, s.subject, s.class_id, s.start_time, s.end_time, s.period_number,
             c.class_name,
             t.first_name, t.last_name, t.phone as teacher_phone
      FROM substitutions s
      JOIN classes c ON c.id = s.class_id
      JOIN teachers t ON t.id = s.substitute_teacher_id
      WHERE s.date = ?
        AND s.status = 'approved'
        AND s.start_time = ?
        AND s.reminder_sent = 0
    `).all(today, targetTime) as any[];

    if (subs.length === 0) {
      return Response.json({ ok: true, sent: 0, message: 'لا توجد بدلاء لتذكيرهم' });
    }

    let sent = 0;
    let skipped = 0;

    for (const sub of subs) {
      if (!sub.teacher_phone) {
        skipped++;
        continue;
      }

      // Get period_number from period_times if not set
      let periodNum = sub.period_number;
      if (!periodNum) {
        const pt = await db.prepare(
          'SELECT period_number FROM period_times WHERE start_time = ? AND end_time = ?'
        ).get(sub.start_time, sub.end_time) as any;
        periodNum = pt?.period_number ?? null;
      }

      const result = await sendSubstitutionReminder({
        teacherPhone: sub.teacher_phone,
        teacherName: `${sub.first_name} ${sub.last_name}`,
        subject: sub.subject,
        className: sub.class_name,
        periodNumber: periodNum ?? 0,
        startTime: sub.start_time,
        date: today,
      });

      if (result.sent) {
        await db.prepare('UPDATE substitutions SET reminder_sent = 1 WHERE id = ?').run(sub.id);
        sent++;
      } else {
        skipped++;
      }
    }

    return Response.json({ ok: true, sent, skipped, targetTime, date: today });
  } catch (error: any) {
    console.error('Substitution reminder error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
