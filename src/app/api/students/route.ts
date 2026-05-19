import { NextRequest } from 'next/server';
import db from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, serverError, success } from '@/lib/auth';
import { validateStudent, sanitizeString } from '@/lib/validation';
import { hasPermission, getSchoolFilter, getSchoolStage } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
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

    if (classId) {
      whereClause += ' AND e.class_id = ?';
      params.push(parseInt(classId));
    }

    const joinClause = classId
      ? 'LEFT JOIN enrollments e ON s.id = e.student_id'
      : '';

    // Count
    const countQuery = `SELECT COUNT(DISTINCT s.id) as total FROM students s ${joinClause} ${whereClause}`;
    const countResult = await db.prepare(countQuery).get(...params) as any;

    // Data
    const query = `
      SELECT DISTINCT s.*
      FROM students s
      ${joinClause}
      ${whereClause}
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
    return serverError('Failed to fetch students');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'students:create')) return forbidden();

    const body = await request.json();

    // Validate
    const validation = validateStudent(body);
    if (!validation.valid) {
      return badRequest(`Validation failed: ${validation.errors[0].message}`);
    }

    const {
      student_id, first_name, last_name, date_of_birth,
      address, phone, email, parent_email, parent_phone, parent_phones, enrollment_date
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
      return badRequest('Student ID already exists');
    }

    // Insert student
    const stmt = await db.prepare(`
      INSERT INTO students (
        student_id, first_name, last_name, date_of_birth,
        address, phone, email, parent_email, parent_phone, parent_phones,
        enrollment_date, school, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
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
      studentSchool
    );

    return success(
      {
        message: 'Student added successfully',
        student_id: result.lastInsertRowid
      },
      201
    );
  } catch (error) {
    console.error('Create student error:', error);
    return serverError('Failed to add student');
  }
}
