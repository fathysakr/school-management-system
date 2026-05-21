import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, serverError, success } from '@/lib/auth';

const ACTIONS = [
  'delete_all_grades',
  'delete_all_classes',
  'delete_all_reports',
  'delete_all_students',
  'delete_all_teachers',
  'delete_all_schedules',
  'delete_all_announcements',
  'new_semester',
] as const;

type BulkAction = typeof ACTIONS[number];

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden('Admin only');

    const { action } = await request.json() as { action?: string };

    if (!action || !ACTIONS.includes(action as BulkAction)) {
      return badRequest('Invalid action. Valid actions: ' + ACTIONS.join(', '));
    }

    const run = db.transaction(async (act: BulkAction) => {
      switch (act) {
        case 'delete_all_grades':
          await db.prepare('DELETE FROM grades').run();
          return { message: 'تم حذف جميع الدرجات بنجاح', count: 0 };

        case 'delete_all_classes':
          await db.prepare('DELETE FROM schedules').run();
          await db.prepare('DELETE FROM attendance').run();
          await db.prepare('DELETE FROM teacher_reports').run();
          await db.prepare('DELETE FROM enrollments').run();
          await db.prepare('DELETE FROM classes').run();
          return { message: 'تم حذف جميع الفصول والبيانات المرتبطة بها بنجاح' };

        case 'delete_all_reports':
          await db.prepare('DELETE FROM teacher_reports').run();
          return { message: 'تم حذف جميع التقارير بنجاح' };

        case 'delete_all_students':
          await db.prepare('DELETE FROM enrollments').run();
          await db.prepare('DELETE FROM attendance').run();
          await db.prepare('DELETE FROM grades').run();
          await db.prepare('DELETE FROM teacher_reports').run();
          await db.prepare('DELETE FROM students').run();
          return { message: 'تم حذف جميع الطلاب والبيانات المرتبطة بهم بنجاح' };

        case 'delete_all_teachers':
          await db.prepare('DELETE FROM schedules').run();
          await db.prepare('DELETE FROM teacher_reports').run();
          await db.prepare('DELETE FROM classes').run();
          await db.prepare('DELETE FROM teachers').run();
          return { message: 'تم حذف جميع المعلمين والبيانات المرتبطة بهم بنجاح' };

        case 'delete_all_schedules':
          await db.prepare('DELETE FROM schedules').run();
          return { message: 'تم حذف جميع جداول الحصص بنجاح' };

        case 'delete_all_announcements':
          await db.prepare('DELETE FROM announcements').run();
          return { message: 'تم حذف جميع الإعلانات بنجاح' };

        case 'new_semester':
          await db.prepare('DELETE FROM grades').run();
          await db.prepare('DELETE FROM attendance').run();
          await db.prepare('DELETE FROM schedules').run();
          await db.prepare('DELETE FROM teacher_reports').run();
          await db.prepare('DELETE FROM enrollments').run();
          return { message: 'تم بدء فصل دراسي جديد - تم مسح الدرجات والحضور والجداول والتقارير والتسجيلات' };

        default:
          return { message: 'Unknown action' };
      }
    });

    const result = run(action as BulkAction);
    return success(result);
  } catch (error) {
    console.error('Bulk delete error:', error);
    const message = error instanceof Error ? error.message : 'فشلت العملية';
    return serverError(message);
  }
}
