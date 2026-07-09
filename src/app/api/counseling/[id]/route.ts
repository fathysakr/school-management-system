import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';
import { sanitizeString } from '@/lib/validation';
import { hasPermission } from '@/lib/permissions';

const ENTITIES = {
  programs: 'counseling_programs',
  attendance_reports: 'counseling_attendance_reports',
  cases: 'counseling_cases',
  contracts: 'counseling_behavior_contracts',
  issues: 'counseling_behavior_issues',
} as const;

type EntityKey = keyof typeof ENTITIES;

function buildSelect(table: string, key: EntityKey): string {
  if (key === 'programs') {
    return `${table}.*, u.email as created_by_email`;
  }
  return `${table}.*, u.email as counselor_email, s.first_name || ' ' || s.last_name as student_name, s.student_id as student_code, c.class_name`;
}

function buildJoins(table: string, key: EntityKey): string {
  if (key === 'programs') {
    return `LEFT JOIN users u ON ${table}.created_by = u.id`;
  }
  return `LEFT JOIN students s ON ${table}.student_id = s.id
          LEFT JOIN classes c ON ${table}.class_id = c.id
          LEFT JOIN users u ON ${table}.counselor_id = u.id`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'counseling:view')) return forbidden();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف غير صالح');

    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type');
    if (!typeParam || !(typeParam in ENTITIES)) return badRequest('نوع الإرشاد غير صالح');

    const table = ENTITIES[typeParam as EntityKey];
    const key = typeParam as EntityKey;
    const record = await db.prepare(
      `SELECT ${buildSelect(table, key)} FROM ${table} ${buildJoins(table, key)} WHERE ${table}.id = ?`
    ).get(id) as any;

    if (!record) return notFound('السجل غير موجود');

    return success({ record });
  } catch (error) {
    console.error('Get counseling record error:', error);
    return serverError('فشل في جلب السجل');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'counseling:edit')) return forbidden();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف غير صالح');

    const body = await request.json();
    const typeParam = body.type;
    if (!typeParam || !(typeParam in ENTITIES)) return badRequest('نوع الإرشاد غير صالح');

    const table = ENTITIES[typeParam as EntityKey];
    const key = typeParam as EntityKey;

    const existing = await db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
    if (!existing) return notFound('السجل غير موجود');

    const allowedFields: Record<string, string[]> = {
      programs: ['title', 'domain', 'description', 'goals', 'target_group', 'start_date', 'end_date', 'status'],
      attendance_reports: ['student_id', 'class_id', 'report_type', 'description', 'actions_taken', 'follow_up', 'status'],
      cases: ['student_id', 'class_id', 'case_type', 'title', 'background', 'analysis', 'intervention', 'outcome', 'recommendations', 'status'],
      contracts: ['student_id', 'class_id', 'title', 'terms', 'start_date', 'end_date', 'status', 'student_signed', 'parent_signed'],
      issues: ['student_id', 'class_id', 'issue_type', 'description', 'severity', 'actions_taken', 'status'],
    };

    const fields = allowedFields[key] || [];
    const updates: string[] = [];
    const values: any[] = [];

    for (const field of fields) {
      if (field in body && body[field] !== undefined && body[field] !== null && body[field] !== '') {
        if (field === 'title' || field === 'description' || field === 'terms' || field === 'background' || field === 'analysis' || field === 'intervention' || field === 'outcome' || field === 'recommendations' || field === 'actions_taken' || field === 'follow_up' || field === 'goals' || field === 'target_group') {
          values.push(sanitizeString(body[field]));
        } else if (field === 'student_id' || field === 'class_id') {
          const v = parseInt(body[field]);
          if (isNaN(v)) continue;
          values.push(v);
        } else if (field === 'student_signed' || field === 'parent_signed') {
          values.push(body[field] ? 1 : 0);
        } else {
          values.push(body[field]);
        }
        updates.push(`${field} = ?`);
      }
    }

    if (updates.length === 0) return badRequest('لا توجد بيانات صالحة للتحديث');

    values.push(id);
    await db.prepare(`UPDATE ${table} SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);

    return success({ message: 'تم التحديث بنجاح' });
  } catch (error) {
    console.error('Update counseling error:', error);
    return serverError('فشل في تحديث السجل');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'counseling:delete')) return forbidden();

    const id = parseInt(params.id);
    if (isNaN(id)) return badRequest('معرف غير صالح');

    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type');
    if (!typeParam || !(typeParam in ENTITIES)) return badRequest('نوع الإرشاد غير صالح');

    const table = ENTITIES[typeParam as EntityKey];
    const existing = await db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
    if (!existing) return notFound('السجل غير موجود');

    await db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    return success({ message: 'تم الحذف بنجاح' });
  } catch (error) {
    console.error('Delete counseling error:', error);
    return serverError('فشل في حذف السجل');
  }
}
