import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, forbidden, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';
import { sanitizeString, isValidScore } from '@/lib/validation';
import { hasPermission } from '@/lib/permissions';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'grades:view')) return forbidden();

    const grade = await db.prepare(`
      SELECT g.*, s.first_name as student_first, s.last_name as student_last,
             c.class_name
      FROM grades g
      JOIN students s ON g.student_id = s.id
      JOIN classes c ON g.class_id = c.id
      WHERE g.id = ?
    `).get(parseInt(params.id)) as any;

    if (!grade) return notFound('Grade record not found');

    return success({ grade });
  } catch (error) {
    console.error('Get grade error:', error);
    return serverError('Failed to fetch grade record');
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'grades:edit')) return forbidden();

    const body = await request.json();
    const { score, total_score, assessment_type, remarks, assessment_date } = body;

    const grade = await db.prepare('SELECT * FROM grades WHERE id = ?').get(parseInt(params.id)) as any;
    if (!grade) return notFound('Grade record not found');

    const newTotal = total_score ?? grade.total_score;
    const newScore = score ?? grade.score;

    if (score !== undefined && !isValidScore(newScore, newTotal)) {
      return badRequest(`Score must be between 0 and ${newTotal}`);
    }

    if (assessment_type !== undefined && !['test', 'quiz', 'assignment', 'midterm', 'final'].includes(assessment_type)) {
      return badRequest('Invalid assessment type');
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (score !== undefined) { updates.push('score = ?'); values.push(score); }
    if (total_score !== undefined) { updates.push('total_score = ?'); values.push(total_score); }
    if (assessment_type !== undefined) { updates.push('assessment_type = ?'); values.push(assessment_type); }
    if (remarks !== undefined) { updates.push('remarks = ?'); values.push(remarks ? sanitizeString(remarks) : null); }
    if (assessment_date !== undefined) { updates.push('assessment_date = ?'); values.push(assessment_date || null); }

    if (updates.length === 0) return badRequest('No fields to update');

    values.push(parseInt(params.id));
    await db.prepare(`UPDATE grades SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);

    return success({ message: 'Grade record updated successfully' });
  } catch (error) {
    console.error('Update grade error:', error);
    return serverError('Failed to update grade record');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'grades:delete')) return forbidden();

    const grade = await db.prepare('SELECT * FROM grades WHERE id = ?').get(parseInt(params.id));
    if (!grade) return notFound('Grade record not found');

    await db.prepare('DELETE FROM grades WHERE id = ?').run(parseInt(params.id));

    return success({ message: 'Grade record deleted successfully' });
  } catch (error) {
    console.error('Delete grade error:', error);
    return serverError('Failed to delete grade record');
  }
}
