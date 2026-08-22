import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { badRequest, serverError, success } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import jwt from 'jsonwebtoken';

const RESET_EXPIRY = '15m';

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();

    const ipLimit = rateLimit(`forgot:${getClientIp(request)}`, 5, 60 * 60 * 1000);
    if (!ipLimit.allowed) {
      return badRequest('عدد كبير من المحاولات. حاول بعد ساعة');
    }

    const body = await request.json();
    const { email } = body;

    if (!email) return badRequest('البريد الإلكتروني مطلوب');

    // Generic response regardless of account existence (no user enumeration)
    const genericMsg = 'إذا كان البريد مسجلاً لدينا، ستصلك رسالة تحتوي رابط إعادة التعيين';

    const user = await db.prepare('SELECT id, email FROM users WHERE email = ?').get(String(email).toLowerCase()) as any;
    if (!user) {
      return success({ message: genericMsg });
    }

    if (!process.env.RESEND_API_KEY) {
      console.warn('[RESET] RESEND_API_KEY not configured; cannot send reset email for', user.email);
      return success({ message: 'خدمة البريد غير مهيأة حالياً. برجاء التواصل مع إدارة المدرسة لإعادة تعيين كلمة المرور' });
    }

    const secret = process.env.JWT_SECRET || '';
    if (!secret) return serverError('خطأ في الإعدادات');

    const token = jwt.sign({ id: user.id, email: user.email, purpose: 'password-reset' }, secret, { expiresIn: RESET_EXPIRY });

    const originHeader = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://safwa-school.vercel.app';
    const resetLink = `${originHeader}/reset-password?token=${token}`;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'مدرسة صفوة الرواد <onboarding@resend.dev>',
        to: [user.email],
        subject: 'إعادة تعيين كلمة المرور - مدرسة صفوة الرواد الأهلية',
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1976d2;">إعادة تعيين كلمة المرور</h2>
            <p>مرحباً،</p>
            <p>توصلنا بطلب لإعادة تعيين كلمة المرور الخاصة بحسابك في نظام إدارة مدرسة صفوة الرواد الأهلية.</p>
            <p style="text-align: center; margin: 24px 0;">
              <a href="${resetLink}" style="background-color: #1976d2; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; display: inline-block;">إعادة تعيين كلمة المرور</a>
            </p>
            <p style="color: #666; font-size: 13px;">هذا الرابط صالح لمدة 15 دقيقة فقط. إذا لم تطلب ذلك، تجاهل هذه الرسالة.</p>
          </div>
        `,
      }),
    });

    if (!resendResponse.ok) {
      console.error('[RESET] Resend error:', await resendResponse.text());
      return serverError('فشل إرسال البريد. حاول مرة أخرى');
    }

    return success({ message: genericMsg });
  } catch (error) {
    console.error('Forgot password error:', error);
    return serverError('حدث خطأ. حاول مرة أخرى');
  }
}
