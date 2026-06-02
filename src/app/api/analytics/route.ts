import { NextRequest } from 'next/server';
import db, { ensureTursoReady } from '@/lib/database';
import { authenticate, unauthorized, forbidden, serverError, success } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { cached } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'students:view')) return forbidden('ليس لديك صلاحية الوصول إلى هذه البيانات');

    const data = await cached('analytics', async () => {
      const allResults = (await Promise.all([
        db.prepare("SELECT COUNT(*) as c FROM students WHERE status = 'active'").get() as any,
        db.prepare(`
          SELECT COALESCE(att.att_total,0) as att_total, COALESCE(att.att_present,0) as att_present,
                 grd.avg_grade, COALESCE(rpt.behavioral_reports,0) as behavioral_reports
          FROM students s
          LEFT JOIN (SELECT a.student_id, COUNT(*) as att_total, SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) as att_present FROM attendance a GROUP BY a.student_id) att ON att.student_id = s.id
          LEFT JOIN (SELECT g.student_id, AVG(g.score*1.0/g.total_score*100) as avg_grade FROM grades g GROUP BY g.student_id) grd ON grd.student_id = s.id
          LEFT JOIN (SELECT r.student_id, COUNT(*) as behavioral_reports FROM teacher_reports r WHERE r.report_type='behavioral' GROUP BY r.student_id) rpt ON rpt.student_id = s.id
          WHERE s.status = 'active'
        `).all() as any,
        db.prepare(`SELECT c.grade as name, COUNT(DISTINCT e.student_id) as count FROM enrollments e JOIN classes c ON c.id = e.class_id WHERE e.status = 'active' GROUP BY c.grade ORDER BY count DESC`).all() as any,
      ])) as any[];
      const [totalResult, studentStats, gradeDistribution] = allResults;

      let atRiskCount = 0, totalAttendanceRate = 0, attendanceCount = 0, totalGradeSum = 0, gradeCount = 0;

      for (const s of studentStats) {
        const attTotal = s.att_total || 0, attPresent = s.att_present || 0;
        const avgGrade = s.avg_grade, behaviorReports = s.behavioral_reports || 0;
        if (attTotal > 0) { totalAttendanceRate += (attPresent / attTotal) * 100; attendanceCount++; }
        if (avgGrade !== null) { totalGradeSum += avgGrade; gradeCount++; }
        if ((attTotal > 0 && (attPresent / attTotal) * 100 < 80) || (avgGrade !== null && avgGrade < 60) || behaviorReports >= 2) atRiskCount++;
      }

      return {
        total_students: totalResult?.c || 0,
        total_at_risk: atRiskCount,
        avg_attendance: attendanceCount > 0 ? Math.round(totalAttendanceRate / attendanceCount) : 0,
        avg_grade: gradeCount > 0 ? Math.round(totalGradeSum / gradeCount) : 0,
        grade_distribution: gradeDistribution,
      };
    }, 15_000);

    return success(data);
  } catch (error) {
    console.error('Analytics error:', error);
    return serverError('فشل في جلب البيانات التحليلية');
  }
}
