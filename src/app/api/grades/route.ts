import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';
import { sanitizeString, isValidScore } from '@/lib/validation';
import { hasPermission, getSchoolFilter } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'grades:view')) return forbidden();

    const { searchParams } = new URL(request.url);
    const student_id = searchParams.get('student_id');
    const class_id = searchParams.get('class_id');
    const subject = searchParams.get('subject');
    const transcript = searchParams.get('transcript');

    const schoolFilter = getSchoolFilter(user.role, searchParams.get('school') || undefined);
    const schoolJoin = schoolFilter.grade ? ' JOIN classes c ON g.class_id = c.id' : '';
    const schoolWhere = schoolFilter.grade ? ' AND c.grade = ?' : '';
    const schoolParams: any[] = schoolFilter.grade ? [schoolFilter.grade] : [];

    if (transcript === 'true' && student_id) {
      const student = await db.prepare('SELECT * FROM students WHERE id = ?').get(parseInt(student_id));
      if (!student) return notFound('الطالب غير موجود');

      const grades = await db.prepare(`
        SELECT subject, COUNT(*) as assessment_count, AVG(score) as average,
          MAX(score) as highest, MIN(score) as lowest
        FROM grades WHERE student_id = ? GROUP BY subject ORDER BY subject
      `).all(parseInt(student_id));

      const overall = await db.prepare(`
        SELECT COUNT(*) as total_assessments, AVG(score) as overall_average
        FROM grades WHERE student_id = ?
      `).get(parseInt(student_id)) as any;

      return success({ student, grades, overall });
    }

    let query = `SELECT g.* FROM grades g${schoolJoin} WHERE 1=1${schoolWhere}`;
    const params: any[] = [...schoolParams];

    if (student_id) { query += ' AND g.student_id = ?'; params.push(parseInt(student_id)); }
    if (class_id) { query += ' AND g.class_id = ?'; params.push(parseInt(class_id)); }
    if (subject) { query += ' AND g.subject LIKE ?'; params.push(`%${subject}%`); }

    query += ' ORDER BY g.assessment_date DESC, g.student_id';
    const grades = await db.prepare(query).all(...params);

    return success({ grades });
  } catch (error) {
    console.error('Get grades error:', error);
    return serverError('فشل في جلب الدرجات');
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'grades:create')) return forbidden();

    const body = await request.json();
    const { student_id, class_id, subject, assessment_type, score, total_score, assessment_date, remarks } = body;

    if (!student_id || !class_id || !subject || !assessment_type || score === undefined) {
      return badRequest('الحقول المطلوبة: معرف الطالب والفصل والمادة ونوع التقييم والدرجة');
    }

    if (!['test', 'quiz', 'assignment', 'midterm', 'final'].includes(assessment_type)) {
      return badRequest('نوع التقييم غير صالح');
    }

    const totalScore = total_score || 100;
    if (!isValidScore(score, totalScore)) {
      return badRequest(`Score must be between 0 and ${totalScore}`);
    }

    // Verify student and class
    const student = await db.prepare('SELECT id FROM students WHERE id = ?').get(student_id);
    if (!student) return badRequest('الطالب غير موجود');

    const classData = await db.prepare('SELECT id FROM classes WHERE id = ?').get(class_id);
    if (!classData) return badRequest('الفصل غير موجود');

    const stmt = db.prepare(`
      INSERT INTO grades (
        student_id, class_id, subject, assessment_type, 
        score, total_score, assessment_date, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await stmt.run(
      student_id,
      class_id,
      sanitizeString(subject),
      assessment_type,
      score,
      totalScore,
      assessment_date || null,
      remarks ? sanitizeString(remarks) : null
    );

    return success({
      message: 'Grade recorded successfully',
      grade_id: result.lastInsertRowid
    }, 201);
  } catch (error) {
    console.error('Record grade error:', error);
    return serverError('فشل في تسجيل الدرجة');
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'grades:edit')) return forbidden();

    const { searchParams } = new URL(request.url);
    const grade_id = searchParams.get('id');

    if (!grade_id) return badRequest('معرف الدرجة مطلوب');

    const body = await request.json();
    const { score, remarks } = body;

    const grade = await db.prepare('SELECT * FROM grades WHERE id = ?').get(parseInt(grade_id)) as any;
    if (!grade) return notFound('الدرجة غير موجودة');

    const updates: string[] = [];
    const values: any[] = [];

    if (score !== undefined) {
      if (!isValidScore(score, grade.total_score)) {
        return badRequest(`Score must be between 0 and ${grade.total_score}`);
      }
      updates.push('score = ?');
      values.push(score);
    }

    if (remarks !== undefined) {
      updates.push('remarks = ?');
      values.push(remarks ? sanitizeString(remarks) : null);
    }

    if (updates.length === 0) {
      return badRequest('لا توجد بيانات للتحديث');
    }

    values.push(parseInt(grade_id));
    const query = `UPDATE grades SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await db.prepare(query).run(...values);

    return success({ message: 'Grade updated successfully' });
  } catch (error) {
    console.error('Update grade error:', error);
    return serverError('فشل في تحديث الدرجة');
  }
}

