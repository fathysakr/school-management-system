import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, serverError, success } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '20') || 20);
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);

    let where = 'WHERE n.user_id = ?';
    const params: any[] = [user.id];
    if (unreadOnly) { where += ' AND n.is_read = 0'; }

    const count = await db.prepare(`SELECT COUNT(*) as cnt FROM notifications n ${where}`).get(...params) as any;
    const notifications = await db.prepare(
      `SELECT * FROM notifications n ${where} ORDER BY n.created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    return success({ notifications, unread_count: count.cnt });
  } catch (error) {
    console.error('Get notifications error:', error);
    return serverError('فشل في جلب الإشعارات');
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();

    const body = await request.json();
    const { id, mark_all } = body;

    if (mark_all) {
      await db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(user.id);
    } else if (id) {
      const nid = parseInt(id);
      if (!isNaN(nid)) {
        await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(nid, user.id);
      }
    }

    return success({ message: 'تم التحديث' });
  } catch (error) {
    console.error('Update notification error:', error);
    return serverError('فشل في تحديث الإشعار');
  }
}
