import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, serverError, success } from '@/lib/auth';
import { validateClass, sanitizeString } from '@/lib/validation';
import { hasPermission, getSchoolFilter } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'classes:view')) return forbidden();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '10') || 10));
    const search = sanitizeString(searchParams.get('search') || '');
    const grade = searchParams.get('grade');
    const teacherId = searchParams.get('teacher_id');

    const offset = (page - 1) * limit;

    let whereClause = 'WHERE c.status = \'active\'';
    const params: any[] = [];

    const schoolFilter = getSchoolFilter(user.role, searchParams.get('school') || undefined);
    if (schoolFilter.grade) {
      whereClause += ' AND c.grade LIKE ?';
      params.push(`%${schoolFilter.grade}%`);
    }

    if (search) {
      whereClause += ' AND (c.class_name LIKE ? OR c.grade LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (grade) {
      whereClause += ' AND c.grade = ?';
      params.push(grade);
    }

    // Auto-filter by teacher for teacher roles — also include classes from schedules
    const isTeacher = user.role === 'middle_teacher' || user.role === 'high_teacher';
    let teacherFilterId: number | null = null;
    if (isTeacher) {
      const teacher = await db.prepare('SELECT COALESCE(u.teacher_id, t.id) as id FROM users u LEFT JOIN teachers t ON t.user_id = u.id WHERE u.id = ?').get(user.id) as any;
      if (teacher?.id) {
        teacherFilterId = teacher.id;
        whereClause += ' AND (c.teacher_id = ? OR c.id IN (SELECT class_id FROM schedules WHERE teacher_id = ? AND status = \'active\') OR c.id IN (SELECT sc.class_id FROM subject_classes sc JOIN subjects s ON sc.subject_id = s.id WHERE s.teacher_id = ?))';
        params.push(teacher.id, teacher.id, teacher.id);
      }
    } else if (teacherId) {
      const tid = parseInt(teacherId);
      if (isNaN(tid)) return badRequest('معرف المعلم غير صالح');
      whereClause += ' AND c.teacher_id = ?';
      params.push(tid);
    }

    // Count
    const countQuery = `SELECT COUNT(*) as total FROM classes c ${whereClause}`;
    const countResult = await db.prepare(countQuery).get(...params) as any;

    const subjectsSubquery = teacherFilterId
      ? `(SELECT GROUP_CONCAT(subj, '، ') FROM (SELECT DISTINCT s.subject as subj FROM schedules s WHERE s.class_id = c.id AND s.status = 'active' AND s.teacher_id = ? UNION SELECT DISTINCT s2.name as subj FROM subjects s2 JOIN subject_classes sc2 ON sc2.subject_id = s2.id WHERE sc2.class_id = c.id AND s2.teacher_id = ?))`
      : `(SELECT GROUP_CONCAT(subject, '، ') FROM (SELECT DISTINCT s.subject FROM schedules s WHERE s.class_id = c.id AND s.status = 'active'))`;

    // Data
    const query = `
      SELECT c.*, 
             t.first_name || ' ' || t.last_name as teacher_name,
             COUNT(DISTINCT e.id) as student_count,
             ${subjectsSubquery} as subjects
      FROM classes c
      LEFT JOIN teachers t ON c.teacher_id = t.id
      LEFT JOIN enrollments e ON c.id = e.class_id AND e.status = 'active'
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.grade, c.class_name
      LIMIT ? OFFSET ?
    `;

    const queryParams = teacherFilterId ? [teacherFilterId, teacherFilterId, ...params, limit, offset] : [...params, limit, offset];

    const classes = await db.prepare(query).all(...queryParams);

    return success({
      classes,
      pagination: {
        page,
        limit,
        total: countResult.total,
        pages: Math.ceil(countResult.total / limit)
      }
    });
  } catch (error) {
    console.error('Get classes error:', error);
    return serverError('فشل في جلب الفصول');
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'classes:create')) return forbidden();

    const body = await request.json();

    // Validate
    const validation = validateClass(body);
    if (!validation.valid) {
      return badRequest(`فشل التحقق من صحة البيانات: ${validation.errors[0].message}`);
    }

    // Check teacher exists
    const teacher = await db.prepare("SELECT id FROM teachers WHERE id = ? AND status = 'active'")
      .get(body.teacher_id);
    if (!teacher) {
      return badRequest('المعلم غير موجود أو غير نشط');
    }

    const { class_name, grade, section, teacher_id, room_number, capacity } = body;

    // Check unique constraint
    const existing = await db.prepare(
      'SELECT id FROM classes WHERE class_name = ? AND grade = ? AND ((section IS NULL AND ? IS NULL) OR section = ?)'
    ).get(class_name, grade, section, section);
    if (existing) {
      return badRequest('الفصل موجود مسبقاً');
    }

    const stmt = await db.prepare(`
      INSERT INTO classes (class_name, grade, section, teacher_id, room_number, capacity, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `);

    const result = await stmt.run(
      sanitizeString(class_name),
      sanitizeString(grade),
      section ? sanitizeString(section) : null,
      teacher_id,
      room_number ? sanitizeString(room_number) : null,
      capacity || 30
    );

    return success(
      {
        message: 'Class created successfully',
        class_id: result.lastInsertRowid
      },
      201
    );
  } catch (error) {
    console.error('Create class error:', error);
    return serverError('فشل في إنشاء الفصل');
  }
}
