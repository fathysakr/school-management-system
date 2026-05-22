import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, forbidden, serverError, success } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'students:view')) return forbidden('ليس لديك صلاحية الوصول إلى هذه البيانات');

    const totalStudentsResult = await db.prepare("SELECT COUNT(*) as c FROM students WHERE status = 'active'").get() as any;
    const totalStudents = totalStudentsResult?.c || 0;

    const allStudents = await db.prepare(`
      SELECT s.id,
             (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id) as att_total,
             (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id AND a.status = 'present') as att_present,
             (SELECT AVG(g.score * 1.0 / g.total_score * 100) FROM grades g WHERE g.student_id = s.id) as avg_grade,
             (SELECT COUNT(*) FROM teacher_reports r WHERE r.student_id = s.id AND r.report_type = 'behavioral') as behavioral_reports
      FROM students s
      WHERE s.status = 'active'
    `).all() as any[];

    let atRiskCount = 0;
    let totalAttendanceRate = 0;
    let attendanceCount = 0;
    let totalGradeSum = 0;
    let gradeCount = 0;

    for (const s of allStudents) {
      const attTotal = s.att_total || 0;
      const attPresent = s.att_present || 0;
      const avgGrade = s.avg_grade;
      const behaviorReports = s.behavioral_reports || 0;

      if (attTotal > 0) {
        const rate = (attPresent / attTotal) * 100;
        totalAttendanceRate += rate;
        attendanceCount++;
      }

      if (avgGrade !== null) {
        totalGradeSum += avgGrade;
        gradeCount++;
      }

      let isAtRisk = false;
      if (attTotal > 0 && (attPresent / attTotal) * 100 < 80) isAtRisk = true;
      if (avgGrade !== null && avgGrade < 60) isAtRisk = true;
      if (behaviorReports >= 2) isAtRisk = true;

      if (isAtRisk) atRiskCount++;
    }

    const avgAttendance = attendanceCount > 0 ? Math.round(totalAttendanceRate / attendanceCount) : 0;
    const avgGrade = gradeCount > 0 ? Math.round(totalGradeSum / gradeCount) : 0;

    const gradeDistribution = await db.prepare(`
      SELECT c.grade as name, COUNT(DISTINCT e.student_id) as count
      FROM enrollments e
      JOIN classes c ON c.id = e.class_id
      WHERE e.status = 'active'
      GROUP BY c.grade
      ORDER BY count DESC
    `).all() as any[];

    return success({
      total_students: totalStudents,
      total_at_risk: atRiskCount,
      avg_attendance: avgAttendance,
      avg_grade: avgGrade,
      grade_distribution: gradeDistribution,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return serverError('فشل في جلب البيانات التحليلية');
  }
}
