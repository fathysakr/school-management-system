import { NextRequest } from 'next/server';
import db from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, serverError, success } from '@/lib/auth';
import { validateTeacher, sanitizeString } from '@/lib/validation';
import { hasPermission, getSchoolFilter, getSchoolStage } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'teachers:view')) return forbidden();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '10') || 10));
    const search = sanitizeString(searchParams.get('search') || '');
    const status = searchParams.get('status') || 'active';

    const offset = (page - 1) * limit;

    // Build query
    let whereClause = 'WHERE t.status = ?';
    const params: any[] = [status];

    const schoolFilter = getSchoolFilter(user.role, searchParams.get('school') || undefined);
    if (schoolFilter.school) {
      whereClause += ' AND t.school = ?';
      params.push(schoolFilter.school);
    }

    if (search) {
      whereClause += ' AND (t.first_name LIKE ? OR t.last_name LIKE ? OR t.email LIKE ? OR t.teacher_id LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM teachers t ${whereClause}`;
    const countResult = await db.prepare(countQuery).get(...params) as any;
    const total = countResult.total;

    // Get data
    const query = `
      SELECT t.*, 
             COUNT(DISTINCT c.id) as classes_count,
             u.email as user_email,
             u.role as user_role
      FROM teachers t
      LEFT JOIN classes c ON t.id = c.teacher_id
      LEFT JOIN users u ON u.teacher_id = t.id
      ${whereClause}
      GROUP BY t.id
      ORDER BY t.last_name, t.first_name
      LIMIT ? OFFSET ?
    `;

    // Also fetch teacher-to-class mapping from schedules for the تعيين page
    const scheduleClassMap = await db.prepare(`
      SELECT teacher_id, GROUP_CONCAT(DISTINCT class_id) as class_ids
      FROM schedules
      WHERE status = 'active'
      GROUP BY teacher_id
    `).all() as any[];
    const scheduleClassById: Record<number, number[]> = {};
    for (const row of scheduleClassMap) {
      scheduleClassById[row.teacher_id] = (row.class_ids || '').split(',').map(Number);
    }

    const teachers = await db.prepare(query).all(...params, limit, offset) as any[];

    // Attach schedule class IDs to each teacher for the تعيين page
    for (const t of teachers) {
      t.schedule_class_ids = scheduleClassById[t.id] || [];
    }

    return success({
      teachers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get teachers error:', error);
    return serverError('Failed to fetch teachers');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'teachers:create')) return forbidden();

    const body = await request.json();

    // Validate
    const validation = validateTeacher(body);
    if (!validation.valid) {
      return badRequest(`Validation failed: ${validation.errors[0].message}`);
    }

    const {
      teacher_id, first_name, last_name, date_of_birth,
      address, phone, email, specialization
    } = body;

    // Sanitize inputs
    const teacherId = sanitizeString(teacher_id);
    const firstName = sanitizeString(first_name);
    const lastName = sanitizeString(last_name);
    const spec = sanitizeString(specialization || '');
    const addr = sanitizeString(address || '');

    // Check if teacher_id exists
    const existing = await db.prepare('SELECT id FROM teachers WHERE teacher_id = ?').get(teacherId);
    if (existing) {
      return badRequest('Teacher ID already exists');
    }

    if (email) {
      const existingEmail = await db.prepare('SELECT id FROM teachers WHERE email = ?').get(email);
      if (existingEmail) {
        return badRequest('Email already exists');
      }
    }

    const stage = getSchoolStage(user.role);
    const teacherSchool = stage === 'both' ? (body.school || 'middle') : stage;

    // Convert empty strings to null for nullable fields to avoid UNIQUE conflicts
    const finalEmail = email || null;
    const finalPhone = phone || null;
    const finalDob = date_of_birth || null;

    // Insert teacher (IGNORE to handle any remaining constraint gracefully)
    const stmt = await db.prepare(`
      INSERT OR IGNORE INTO teachers (
        teacher_id, first_name, last_name, date_of_birth,
        address, phone, email, specialization, school, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `);

    const result = await stmt.run(
      teacherId, firstName, lastName, finalDob,
      addr, finalPhone, finalEmail, spec, teacherSchool
    );

    if (result.changes === 0) {
      return badRequest('تعذرت الإضافة (ربما رقم المعلم أو البريد الإلكتروني موجود مسبقاً)');
    }

    return success(
      {
        message: 'Teacher added successfully',
        teacher_id: result.lastInsertRowid
      },
      201
    );
  } catch (error) {
    console.error('Create teacher error:', error);
    return serverError('Failed to add teacher');
  }
}
