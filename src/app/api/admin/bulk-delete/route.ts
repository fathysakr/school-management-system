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
  'factory_reset',
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
      return badRequest('إجراء غير صالح. الإجراءات المتاحة: ' + ACTIONS.join(', '));
    }

    if (action === 'factory_reset') {
      await db.exec('PRAGMA foreign_keys=OFF');
      await db.exec('DELETE FROM attendance');
      await db.exec('DELETE FROM grades');
      await db.exec('DELETE FROM teacher_reports');
      await db.exec('DELETE FROM enrollments');
      await db.exec('DELETE FROM subject_classes');
      await db.exec('DELETE FROM substitutions');
      await db.exec('DELETE FROM schedules');
      await db.exec('DELETE FROM notifications');
      await db.exec('DELETE FROM management_position_assignments');
      await db.exec('DELETE FROM announcements');
      await db.exec('DELETE FROM leave_requests');
      await db.exec('DELETE FROM parents');
      await db.exec('DELETE FROM students');
      await db.exec('DELETE FROM classes');
      await db.exec('DELETE FROM subjects');
      await db.exec('DELETE FROM management_positions');
      await db.exec('DELETE FROM teachers');
      await db.exec('DELETE FROM users');
      await db.exec('DELETE FROM _init_done WHERE flag = 1');
      await db.exec('PRAGMA foreign_keys=ON');
      return success({ message: 'تم إعادة تعيين النظام بالكامل. سيتم إعادة تهيئة البيانات الافتراضية في الزيارة التالية. يرجى تسجيل الدخول مرة أخرى.' });
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

    const result = await run(action as BulkAction);
    return success(result);
  } catch (error) {
    console.error('Bulk delete error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return serverError(`فشلت العملية: ${msg}`);
  }
}
