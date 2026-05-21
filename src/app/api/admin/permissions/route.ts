import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';
import { rolePermissions, allPermissions } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    if (!userId) return badRequest('معرف المستخدم مطلوب');

    const targetUser = await db.prepare('SELECT id, role, custom_permissions FROM users WHERE id = ?').get(parseInt(userId)) as any;
    if (!targetUser) return notFound('المستخدم غير موجود');

    const roleDefault = rolePermissions[targetUser.role as keyof typeof rolePermissions] || [];
    let customPermissions: string[] | null = null;
    if (targetUser.custom_permissions) {
      try { customPermissions = JSON.parse(targetUser.custom_permissions); } catch { customPermissions = null; }
    }

    return success({
      user_id: targetUser.id,
      role: targetUser.role,
      role_defaults: roleDefault,
      custom_permissions: customPermissions,
      has_custom: customPermissions !== null,
    });
  } catch (error) {
    console.error('Get permissions error:', error);
    return serverError('فشل في جلب الصلاحيات');
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const body = await request.json();
    const { user_id, permissions } = body;

    if (!user_id) return badRequest('معرف المستخدم مطلوب');
    if (!Array.isArray(permissions)) return badRequest('الصلاحيات يجب أن تكون مصفوفة');

    const targetUser = await db.prepare('SELECT id FROM users WHERE id = ?').get(user_id) as any;
    if (!targetUser) return notFound('المستخدم غير موجود');

    if (permissions.length === 0) {
      await db.prepare('UPDATE users SET custom_permissions = NULL WHERE id = ?').run(user_id);
      return success({ message: 'تم إزالة الصلاحيات المخصصة، استخدام صلاحيات الدور الافتراضية' });
    }

    const validPermissions = permissions.filter((p: string) => allPermissions.includes(p as any));
    await db.prepare('UPDATE users SET custom_permissions = ? WHERE id = ?').run(JSON.stringify(validPermissions), user_id);

    return success({ message: 'تم تحديث الصلاحيات بنجاح', enabled: validPermissions });
  } catch (error) {
    console.error('Update permissions error:', error);
    return serverError('فشل في تحديث الصلاحيات');
  }
}
