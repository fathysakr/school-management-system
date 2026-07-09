import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, serverError, success } from '@/lib/auth';
import { sanitizeString } from '@/lib/validation';
import { hasPermission, getSchoolFilter } from '@/lib/permissions';

const ENTITIES = {
  programs: 'counseling_programs',
  attendance_reports: 'counseling_attendance_reports',
  cases: 'counseling_cases',
  contracts: 'counseling_behavior_contracts',
  issues: 'counseling_behavior_issues',
} as const;

type EntityKey = keyof typeof ENTITIES;

const entityLabels: Record<EntityKey, string> = {
  programs: 'خطة برنامج',
  attendance_reports: 'تقرير غياب وسلوك',
  cases: 'دراسة حالة',
  contracts: 'عقد سلوك',
  issues: 'مشكلة طلابية',
};

function getEntityType(type: string | null): { table: string; key: EntityKey } | null {
  if (!type || !(type in ENTITIES)) return null;
  const key = type as EntityKey;
  return { table: ENTITIES[key], key };
}

function buildSelectFields(table: string, key: EntityKey): string {
  const base = `${table}.*, u.email as counselor_email, s.first_name || ' ' || s.last_name as student_name, c.class_name`;

  const studentJoin = `LEFT JOIN students s ON ${table}.student_id = s.id`;
  const classJoin = `LEFT JOIN classes c ON ${table}.class_id = c.id`;
  const userJoin = `LEFT JOIN users u ON ${table}.counselor_id = u.id`;

  if (key === 'programs') {
    return `${table}.*, u.email as created_by_email`;
  }
  return `${base} ${studentJoin} ${classJoin} ${userJoin}`;
}

function buildJoins(table: string, key: EntityKey): string {
  if (key === 'programs') {
    return `LEFT JOIN users u ON ${table}.created_by = u.id`;
  }
  return `LEFT JOIN students s ON ${table}.student_id = s.id
          LEFT JOIN classes c ON ${table}.class_id = c.id
          LEFT JOIN users u ON ${table}.counselor_id = u.id`;
}

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'counseling:view')) return forbidden();

    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type');
    const entity = getEntityType(typeParam);
    if (!entity) return badRequest('نوع الإرشاد غير صالح');

    const { table, key } = entity;

    const search = sanitizeString(searchParams.get('search') || '');
    const status = searchParams.get('status') || '';
    const student_id = searchParams.get('student_id') || '';
    const domain = searchParams.get('domain') || '';
    const report_type = searchParams.get('report_type') || '';
    const case_type = searchParams.get('case_type') || '';
    const issue_type = searchParams.get('issue_type') || '';
    const severity = searchParams.get('severity') || '';

    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const params: any[] = [];

    const schoolFilter = getSchoolFilter(user.role, searchParams.get('school') || undefined);

    if (schoolFilter.school) {
      whereClauses.push(`(${table}.class_id IS NULL OR ${table}.class_id IN (SELECT id FROM classes WHERE grade LIKE ?))`);
      params.push(`%${schoolFilter.school === 'middle' ? 'متوسط' : 'ثانوي'}%`);
    }

    if (status) {
      if (key === 'programs') {
        whereClauses.push(`${table}.status = ?`);
        params.push(status);
      } else {
        whereClauses.push(`${table}.status = ?`);
        params.push(status);
      }
    }

    if (student_id) {
      whereClauses.push(`${table}.student_id = ?`);
      params.push(parseInt(student_id));
    }

    if (key === 'programs' && domain) {
      const domains = domain.split(',').filter(Boolean);
      if (domains.length > 0) {
        whereClauses.push(`${table}.domain IN (${domains.map(() => '?').join(',')})`);
        params.push(...domains);
      }
    }

    if (key === 'attendance_reports' && report_type) {
      whereClauses.push(`${table}.report_type = ?`);
      params.push(report_type);
    }

    if (key === 'cases' && case_type) {
      const caseTypes = case_type.split(',').filter(Boolean);
      if (caseTypes.length > 0) {
        whereClauses.push(`${table}.case_type IN (${caseTypes.map(() => '?').join(',')})`);
        params.push(...caseTypes);
      }
    }

    if (key === 'issues') {
      if (issue_type) { whereClauses.push(`${table}.issue_type = ?`); params.push(issue_type); }
      if (severity) { whereClauses.push(`${table}.severity = ?`); params.push(severity); }
    }

    if (search && key !== 'programs') {
      whereClauses.push(`(s.first_name LIKE ? OR s.last_name LIKE ? OR ${table}.description LIKE ? OR ${table}.title LIKE ?)`);
      const t = `%${search}%`;
      params.push(t, t, t, t);
    }
    if (search && key === 'programs') {
      whereClauses.push(`(${table}.title LIKE ? OR ${table}.description LIKE ?)`);
      const t = `%${search}%`;
      params.push(t, t);
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const countResult = await db.prepare(`SELECT COUNT(*) as total FROM ${table} ${whereSQL}`).get(...params) as any;
    const total = countResult?.total || 0;

    const selectFields = buildSelectFields(table, key);
    const joins = buildJoins(table, key);
    const query = `SELECT ${selectFields} FROM ${table} ${joins} ${whereSQL} ORDER BY ${table}.created_at DESC LIMIT ? OFFSET ?`;

    const records = await db.prepare(query).all(...params, limit, offset) as any[];

    return success({
      records,
      label: entityLabels[key],
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    console.error('Get counseling error:', error);
    return new Response(JSON.stringify({ error: error?.message || error?.toString() || 'فشل في جلب البيانات', stack: error?.stack?.split('\n').slice(0, 5).join('\n') }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'counseling:create')) return forbidden();

    const body = await request.json();
    const typeParam = body.type;
    const entity = getEntityType(typeParam);
    if (!entity) return badRequest('نوع الإرشاد غير صالح');

    const { table, key } = entity;

    if (key === 'programs') {
      const { title, domain, description, goals, target_group, start_date, end_date } = body;
      if (!title?.trim() || !domain) return badRequest('عنوان البرنامج والمجال مطلوبان');
      if (!['academic', 'psychological', 'guidance', 'community'].includes(domain)) return badRequest('مجال غير صالح');
      await db.prepare(`INSERT INTO ${table} (title, domain, description, goals, target_group, start_date, end_date, created_by) VALUES (?,?,?,?,?,?,?,?)`).run(
        sanitizeString(title), domain, description || null, goals || null, target_group || null, start_date || null, end_date || null, user.id
      );
      return success({ message: 'تم إضافة الخطة بنجاح' }, 201);
    }

    const student_id = parseInt(body.student_id);
    if (isNaN(student_id)) return badRequest('الطالب مطلوب');
    const class_id = body.class_id ? parseInt(body.class_id) : null;

    if (key === 'attendance_reports') {
      const { report_type, description, actions_taken, follow_up } = body;
      if (!report_type || !description?.trim()) return badRequest('نوع التقرير والوصف مطلوبان');
      if (!['absence', 'behavior', 'academic', 'general'].includes(report_type)) return badRequest('نوع تقرير غير صالح');
      await db.prepare(`INSERT INTO ${table} (student_id, class_id, report_type, description, actions_taken, follow_up, counselor_id) VALUES (?,?,?,?,?,?,?)`).run(
        student_id, class_id, report_type, description, actions_taken || null, follow_up || null, user.id
      );
      return success({ message: 'تم إضافة التقرير بنجاح' }, 201);
    }

    if (key === 'cases') {
      const { case_type, title, background, analysis, intervention, outcome, recommendations } = body;
      if (!case_type || !title?.trim()) return badRequest('نوع الحالة والعنوان مطلوبان');
      if (!['academic', 'behavioral', 'psychological', 'social', 'career'].includes(case_type)) return badRequest('نوع حالة غير صالح');
      await db.prepare(`INSERT INTO ${table} (student_id, class_id, case_type, title, background, analysis, intervention, outcome, recommendations, counselor_id) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
        student_id, class_id, case_type, sanitizeString(title), background || null, analysis || null,
        intervention || null, outcome || null, recommendations || null, user.id
      );
      return success({ message: 'تم إضافة دراسة الحالة بنجاح' }, 201);
    }

    if (key === 'contracts') {
      const { title, terms, start_date, end_date, student_signed, parent_signed } = body;
      if (!title?.trim() || !terms?.trim()) return badRequest('عنوان العقد والشروط مطلوبان');
      await db.prepare(`INSERT INTO ${table} (student_id, class_id, title, terms, start_date, end_date, student_signed, parent_signed, counselor_signed, counselor_id) VALUES (?,?,?,?,?,?,?,?,1,?)`).run(
        student_id, class_id, sanitizeString(title), terms, start_date || null, end_date || null,
        student_signed ? 1 : 0, parent_signed ? 1 : 0, user.id
      );
      return success({ message: 'تم إضافة العقد بنجاح' }, 201);
    }

    if (key === 'issues') {
      const { issue_type, description, severity, actions_taken } = body;
      if (!issue_type || !description?.trim()) return badRequest('نوع المشكلة والوصف مطلوبان');
      if (!['violence', 'bullying', 'disruption', 'cyber', 'absence', 'other'].includes(issue_type)) return badRequest('نوع مشكلة غير صالح');
      if (severity && !['low', 'medium', 'high', 'critical'].includes(severity)) return badRequest('مستوى الخطورة غير صالح');
      await db.prepare(`INSERT INTO ${table} (student_id, class_id, issue_type, description, severity, actions_taken, counselor_id) VALUES (?,?,?,?,?,?,?)`).run(
        student_id, class_id, issue_type, description, severity || 'medium', actions_taken || null, user.id
      );
      return success({ message: 'تم إضافة المشكلة بنجاح' }, 201);
    }

    return badRequest('نوع غير مدعوم');
  } catch (error) {
    console.error('Create counseling error:', error);
    return serverError('فشل في إضافة السجل');
  }
}
