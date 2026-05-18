import { NextRequest } from 'next/server';
import db from '@/lib/database';
import { authenticate, unauthorized, forbidden, serverError } from '@/lib/auth';

const BACKUP_TABLES = [
  'users', 'subjects', 'teachers', 'students', 'classes',
  'enrollments', 'attendance', 'grades', 'schedules',
  'teacher_reports', 'announcements', 'leave_requests',
  'substitutions', 'notifications', '_migrations',
];

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden('Admin only');

    const backup: Record<string, any[]> = {};

    for (const table of BACKUP_TABLES) {
      try {
        const rows = await db.prepare(`SELECT * FROM \`${table}\``).all() as any[];
        backup[table] = rows.map((r: any) => ({ ...r }));
      } catch {
        backup[table] = [];
      }
    }

    const blob = new TextEncoder().encode(JSON.stringify({ version: 1, exported_at: new Date().toISOString(), data: backup }, null, 2));

    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="safwa-backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('Backup export error:', error);
    return serverError('فشل تصدير النسخة الاحتياطية');
  }
}
