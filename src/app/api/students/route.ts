import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, serverError, success } from '@/lib/auth';
import { validateStudent, sanitizeString } from '@/lib/validation';
import { hasPermission, getSchoolFilter, getSchoolStage } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    console.error('[STUDENTS] GET called, headers:', JSON.stringify(Object.fromEntries(request.headers)));
    const user = await authenticate(request);
    if (!user) {
      console.error('[STUDENTS] Auth failed');
      return unauthorized();
    }
    console.error('[STUDENTS] Auth success, user role:', user.role);
    if (!hasPermission(user.role, 'students:view')) return forbidden();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '10') || 10));
    const search = sanitizeString(searchParams.get('search') || '');
    const classId = searchParams.get('class_id');

    const offset = (page - 1) * limit;

    let whereClause = 'WHERE s.status = \'active\'';
    const params: any[] = [];

    const schoolFilter = getSchoolFilter(user.role, searchParams.get('school') || undefined);
    if (schoolFilter.school) {
      whereClause += ' AND s.school = ?';
      params.push(schoolFilter.school);
    }

    if (search) {
      whereClause += ' AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.email LIKE ? OR s.student_id LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const joinClause = 'LEFT JOIN enrollments e ON s.id = e.student_id AND e.status = \'active\' LEFT JOIN classes c ON c.id = e.class_id';

    if (classId) {
      whereClause += ' AND e.class_id = ?';
      params.push(parseInt(classId));
    }

    // Auto-filter by teacher's classes for teacher roles
    const isTeacher = user.role === 'middle_teacher' || user.role === 'high_teacher';
    if (isTeacher) {
      const teacherRec = await db.prepare('SELECT COALESCE(u.teacher_id, t.id) as id FROM users u LEFT JOIN teachers t ON t.user_id = u.id WHERE u.id = ?').get(user.id) as any;
      if (teacherRec?.id) {
        whereClause += ' AND e.class_id IN (SELECT id FROM classes WHERE teacher_id = ? AND status = \'active\' UNION SELECT class_id FROM schedules WHERE teacher_id = ? AND status = \'active\' UNION SELECT sc.class_id FROM subject_classes sc JOIN subjects s ON sc.subject_id = s.id WHERE s.teacher_id = ?)';
        params.push(teacherRec.id, teacherRec.id, teacherRec.id);
      }
    }

    // Count
    const countQuery = `SELECT COUNT(DISTINCT s.id) as total FROM students s ${joinClause} ${whereClause}`;
    const countResult = await db.prepare(countQuery).get(...params) as any;

    // Data
    const query = `
      SELECT s.*, c.id as class_id, c.class_name, c.grade as class_grade
      FROM students s
      ${joinClause}
      ${whereClause}
      GROUP BY s.id
      ORDER BY s.last_name, s.first_name
      LIMIT ? OFFSET ?
    `;

    const students = await db.prepare(query).all(...params, limit, offset);

    return success({
      students,
      pagination: {
        page,
        limit,
        total: countResult.total,
        pages: Math.ceil(countResult.total / limit)
      }
    });
  } catch (error) {
    console.error('Get students error:', error);
    return serverError('فشل في جلب الطلاب');
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'students:create')) return forbidden();

    const body = await request.json();

    // Validate
    const validation = validateStudent(body);
    if (!validation.valid) {
      return badRequest(`فشل التحقق من صحة البيانات: ${validation.errors[0].message}`);
    }

    const {
      student_id, first_name, last_name, date_of_birth,
      address, phone, email, parent_email, parent_phone, parent_phones, enrollment_date, semester
    } = body;

    // Build parent_phones array
    let phonesJson = '[]';
    if (Array.isArray(parent_phones) && parent_phones.length > 0) {
      phonesJson = JSON.stringify(parent_phones.filter(Boolean));
    } else if (parent_phone) {
      phonesJson = JSON.stringify([parent_phone]);
    }
    const finalParentPhone = parent_phone || (Array.isArray(parent_phones) && parent_phones.length > 0 ? parent_phones[0] : '');

    const stage = getSchoolStage(user.role);
    const studentSchool = stage === 'both' ? (body.school || 'middle') : stage;

    // Check if student_id exists
    const existing = await db.prepare('SELECT id FROM students WHERE student_id = ?').get(student_id);
    if (existing) {
      return badRequest('رقم الطالب موجود مسبقاً');
    }

    const studentGrade = body.grade || '';

    // Insert student
    const stmt = await db.prepare(`
      INSERT INTO students (
        student_id, first_name, last_name, date_of_birth,
        address, phone, email, parent_email, parent_phone, parent_phones,
        enrollment_date, school, semester, grade, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `);

    const result = await stmt.run(
      sanitizeString(student_id),
      sanitizeString(first_name),
      sanitizeString(last_name),
      date_of_birth,
      sanitizeString(address || ''),
      phone,
      email,
      parent_email,
      finalParentPhone,
      phonesJson,
      enrollment_date || new Date().toISOString().split('T')[0],
      studentSchool,
      semester || '',
      studentGrade
    );

    // Auto-enroll in class if class_id, or class_name + grade provided
    let targetClassId: number | null = null;
    if (body.class_id) {
      targetClassId = parseInt(body.class_id);
    } else if (body.class_name && body.grade) {
      const cn = body.class_name || '';
      const gr = body.grade || '';
      try {
        let classRow = await db.prepare('SELECT id, capacity FROM classes WHERE class_name = ? AND grade = ? AND status = ?').get(cn, gr, 'active') as any;
        if (!classRow) {
          classRow = await db.prepare('SELECT id, capacity FROM classes WHERE class_name LIKE ? AND grade = ? AND status = ? LIMIT 1').get(`${cn}/%`, gr, 'active') as any;
        }
        if (classRow) targetClassId = classRow.id;
      } catch (e) { console.error('Auto-enroll lookup error:', e); }
    }
    if (targetClassId) {
      try {
        const classRow = await db.prepare('SELECT capacity FROM classes WHERE id = ? AND status = ?').get(targetClassId, 'active') as any;
        if (classRow) {
          const cnt = (await db.prepare('SELECT COUNT(*) as count FROM enrollments WHERE class_id = ? AND status = ?').get(targetClassId, 'active') as any)?.count || 0;
          if (cnt < classRow.capacity) {
            await db.prepare("INSERT OR IGNORE INTO enrollments (student_id, class_id, enrollment_date, status) VALUES (?, ?, date('now'), 'active')").run(result.lastInsertRowid, targetClassId);
          }
        }
      } catch (e) { console.error('Auto-enroll error:', e); }
    }

    return success(
      {
        message: 'Student added successfully',
        student_id: result.lastInsertRowid
      },
      201
    );
  } catch (error) {
    console.error('Create student error:', error);
    return serverError('فشل في إضافة الطالب');
  }
}
