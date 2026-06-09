import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, badRequest, notFound, serverError, success } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const studentIdStr = searchParams.get('student_id');
    if (!studentIdStr) return badRequest('معرف الطالب مطلوب');

    const studentId = parseInt(studentIdStr);
    if (isNaN(studentId)) return badRequest('معرف الطالب غير صالح');

    const student = await db.prepare('SELECT id, first_name, last_name, student_id FROM students WHERE id = ?').get(studentId) as any;
    if (!student) return notFound('الطالب غير موجود');

    const classInfo = await db.prepare(`
      SELECT c.class_name, c.grade FROM enrollments e JOIN classes c ON e.class_id = c.id
      WHERE e.student_id = ? AND e.status = 'active'
    `).get(studentId) as any;

    const subjects = await db.prepare(`
      SELECT g.subject, 
             COUNT(*) as total_tests,
             AVG(g.score * 1.0 / g.total_score * 100) as avg_pct,
             MIN(g.score * 1.0 / g.total_score * 100) as min_pct,
             MAX(g.score * 1.0 / g.total_score * 100) as max_pct
      FROM grades g
      WHERE g.student_id = ?
      GROUP BY g.subject
    `).all(studentId) as any[];

    const attendanceRow = await db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present,
             SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) as absent,
             SUM(CASE WHEN status='late' THEN 1 ELSE 0 END) as late,
             SUM(CASE WHEN status='excused' THEN 1 ELSE 0 END) as excused
      FROM attendance WHERE student_id = ?
    `).get(studentId) as any;

    let totalWeightedSum = 0;
    let totalSubjects = 0;
    const subjectEntries = subjects.map((s: any) => {
      const avg = Math.round(s.avg_pct * 100) / 100;
      if (!isNaN(avg)) {
        totalWeightedSum += avg;
        totalSubjects++;
      }
      return {
        subject: s.subject,
        total_tests: s.total_tests,
        avg_pct: avg,
        min_pct: Math.round(s.min_pct * 100) / 100,
        max_pct: Math.round(s.max_pct * 100) / 100,
      };
    });

    const overallPct = totalSubjects > 0 ? Math.round((totalWeightedSum / totalSubjects) * 100) / 100 : 0;

    let gradeLevel: string;
    if (overallPct >= 90) gradeLevel = 'ممتاز';
    else if (overallPct >= 75) gradeLevel = 'جيد جداً';
    else if (overallPct >= 60) gradeLevel = 'جيد';
    else if (overallPct >= 50) gradeLevel = 'مقبول';
    else gradeLevel = 'ضعيف';

    return success({
      student: {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        student_id: student.student_id,
      },
      class_info: classInfo || null,
      subjects: subjectEntries,
      attendance: attendanceRow || { total: 0, present: 0, absent: 0, late: 0, excused: 0 },
      overall_avg: totalSubjects > 0 ? Math.round(totalWeightedSum / totalSubjects * 100) / 100 : 0,
      overall_pct: overallPct,
      grade_level: gradeLevel,
    });
  } catch (error) {
    console.error('Report card error:', error);
    return serverError('فشل في إنشاء كشف الدرجات');
  }
}
