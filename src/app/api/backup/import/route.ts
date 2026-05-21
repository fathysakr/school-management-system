import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, forbidden, badRequest, serverError, success } from '@/lib/auth';

const IMPORT_ORDER = [
  'users', 'subjects', 'teachers', 'students', 'classes',
  'enrollments', 'attendance', 'grades', 'schedules',
  'teacher_reports', 'announcements', 'leave_requests',
  'substitutions', 'notifications', '_migrations',
];

const DELETE_ORDER = [...IMPORT_ORDER].reverse();

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden('Admin only');

    const body = await request.json();
    if (!body.data || typeof body.data !== 'object') {
      return badRequest('ملف النسخة الاحتياطية غير صالح');
    }

    const backup = body.data as Record<string, any[]>;
    const stats: Record<string, number> = {};

    for (const table of DELETE_ORDER) {
      if (!backup[table]) continue;
      try {
        await db.prepare(`DELETE FROM \`${table}\``).run();
      } catch {}
    }

    for (const table of IMPORT_ORDER) {
      const rows = backup[table];
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        stats[table] = 0;
        continue;
      }

      const first = rows[0];
      const columns = Object.keys(first).filter(k => k !== 'id');
      const placeholders = columns.map(() => '?').join(',');
      const colNames = columns.map(c => `\`${c}\``).join(',');

      let inserted = 0;
      for (const row of rows) {
        try {
          const values = columns.map(c => {
            const v = row[c];
            return v === undefined || v === null ? null : v;
          });
          await db.prepare(`INSERT INTO \`${table}\` (${colNames}) VALUES (${placeholders})`).run(...values);
          inserted++;
        } catch (err: unknown) {
          console.error(`Backup import: skipping row in ${table}:`, err instanceof Error ? err.message : err);
        }
      }
      stats[table] = inserted;
    }

    return success({ message: 'تم استيراد النسخة الاحتياطية بنجاح', stats });
  } catch (error) {
    console.error('Backup import error:', error);
    return serverError('فشل استيراد النسخة الاحتياطية');
  }
}
