import { NextRequest } from 'next/server';
import db from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, serverError, success } from '@/lib/auth';
import { validateClass, sanitizeString } from '@/lib/validation';
import { hasPermission, getSchoolFilter } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
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

    // Auto-filter by teacher for teacher roles
    const isTeacher = user.role === 'middle_teacher' || user.role === 'high_teacher';
    if (isTeacher) {
      const teacher = await db.prepare('SELECT t.id FROM teachers t JOIN users u ON u.teacher_id = t.id WHERE u.id = ?').get(user.id) as any;
      if (teacher) {
        whereClause += ' AND c.teacher_id = ?';
        params.push(teacher.id);
      }
    } else if (teacherId) {
      whereClause += ' AND c.teacher_id = ?';
      params.push(parseInt(teacherId));
    }

    // Count
    const countQuery = `SELECT COUNT(*) as total FROM classes c ${whereClause}`;
    const countResult = await db.prepare(countQuery).get(...params) as any;

    // Data
    const query = `
      SELECT c.*, 
             t.first_name || ' ' || t.last_name as teacher_name,
             COUNT(DISTINCT e.id) as student_count
      FROM classes c
      LEFT JOIN teachers t ON c.teacher_id = t.id
      LEFT JOIN enrollments e ON c.id = e.class_id AND e.status = 'active'
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.grade, c.class_name
      LIMIT ? OFFSET ?
    `;

    const classes = await db.prepare(query).all(...params, limit, offset);

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
    return serverError('Failed to fetch classes');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'classes:create')) return forbidden();

    const body = await request.json();

    // Validate
    const validation = validateClass(body);
    if (!validation.valid) {
      return badRequest(`Validation failed: ${validation.errors[0].message}`);
    }

    // Check teacher exists
    const teacher = await db.prepare("SELECT id FROM teachers WHERE id = ? AND status = 'active'")
      .get(body.teacher_id);
    if (!teacher) {
      return badRequest('Teacher not found or inactive');
    }

    const { class_name, grade, section, teacher_id, room_number, capacity } = body;

    // Check unique constraint
    const existing = await db.prepare(
      'SELECT id FROM classes WHERE class_name = ? AND grade = ? AND ((section IS NULL AND ? IS NULL) OR section = ?)'
    ).get(class_name, grade, section, section);
    if (existing) {
      return badRequest('Class already exists');
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
    return serverError('Failed to create class');
  }
}
