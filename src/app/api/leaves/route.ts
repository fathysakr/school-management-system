import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, badRequest, serverError, success } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('user_id');
    let sql = `SELECT lr.*, u.email as user_email FROM leave_requests lr LEFT JOIN users u ON lr.user_id = u.id`;
    const params: any[] = [];
    const clauses: string[] = [];
    if (status) { clauses.push('lr.status = ?'); params.push(status); }
    if (userId) { clauses.push('lr.user_id = ?'); params.push(parseInt(userId)); }
    if (!hasPermission(user.role, 'settings:edit')) {
      clauses.push('lr.user_id = ?'); params.push(user.id);
    }
    if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
    sql += ' ORDER BY lr.created_at DESC';
    const leaves = await db.prepare(sql).all(...params);
    return success({ leaves });
  } catch {
    return serverError('Failed to fetch leaves');
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    const body = await request.json();
    const { leave_type, start_date, end_date, reason } = body;
    if (!leave_type || !start_date || !end_date) return badRequest('نوع الإجازة وتاريخ البداية والنهاية مطلوبان');
    if (!['sick', 'personal', 'emergency', 'annual'].includes(leave_type)) return badRequest('نوع إجازة غير صحيح');
    await db.prepare(
      'INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, reason, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(user.id, leave_type, start_date, end_date, reason || null, 'pending');
    return success({ message: 'تم تقديم طلب الإجازة' });
  } catch {
    return serverError('Failed to create leave request');
  }
}
