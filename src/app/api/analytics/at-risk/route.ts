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

    const students = await db.prepare(`
      SELECT s.id, s.first_name, s.last_name, s.student_id,
             (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id) as att_total,
             (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id AND a.status = 'present') as att_present,
             (SELECT AVG(g.score * 1.0 / g.total_score * 100) FROM grades g WHERE g.student_id = s.id) as avg_grade,
             (SELECT COUNT(*) FROM teacher_reports r WHERE r.student_id = s.id AND r.report_type = 'behavioral') as behavioral_reports,
             c.class_name
      FROM students s
      LEFT JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
      LEFT JOIN classes c ON c.id = e.class_id
      WHERE s.status = 'active'
    `).all() as any[];

    const totalStudents = students.length;

    type RiskStudent = {
      id: number;
      first_name: string;
      last_name: string;
      student_id: string;
      class_name: string;
      risk_score: number;
      attendance_rate: number | null;
      avg_grade: number | null;
      behavioral_reports: number;
      reasons: string[];
    };

    const atRiskStudents: RiskStudent[] = [];

    for (const s of students) {
      const attTotal = s.att_total || 0;
      const attPresent = s.att_present || 0;
      const avgGrade = s.avg_grade;
      const behaviorReports = s.behavioral_reports || 0;

      const attendanceRate = attTotal > 0 ? (attPresent / attTotal) * 100 : null;
      const reasons: string[] = [];

      let attendanceRisk = 0;
      let gradeRisk = 0;
      let behavioralRisk = 0;

      if (attTotal > 0 && attendanceRate! < 80) {
        attendanceRisk = (1 - attPresent / attTotal) * 30;
        reasons.push(`نسبة الحضور (${Math.round(attendanceRate!)}%) أقل من 80%`);
      }

      if (avgGrade !== null && avgGrade < 60) {
        gradeRisk = (1 - avgGrade / 100) * 50;
        reasons.push(`متوسط الدرجات (${Math.round(avgGrade)}%) أقل من 60%`);
      }

      if (behaviorReports >= 2) {
        behavioralRisk = Math.min(behaviorReports * 10, 20);
        reasons.push(`عدد التقارير السلوكية (${behaviorReports}) يتطلب متابعة`);
      }

      if (reasons.length === 0) continue;

      const riskScore = Math.round(attendanceRisk + gradeRisk + behavioralRisk);
      if (riskScore <= 20) continue;

      atRiskStudents.push({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        student_id: s.student_id,
        class_name: s.class_name || '',
        risk_score: riskScore,
        attendance_rate: attendanceRate !== null ? Math.round(attendanceRate) : null,
        avg_grade: avgGrade !== null ? Math.round(avgGrade) : null,
        behavioral_reports: behaviorReports,
        reasons,
      });
    }

    atRiskStudents.sort((a, b) => b.risk_score - a.risk_score);
    const top20 = atRiskStudents.slice(0, 20);

    const schoolAvgGradeResult = await db.prepare(`
      SELECT AVG(g.score * 1.0 / g.total_score * 100) as avg_grade
      FROM grades g
      JOIN students s ON s.id = g.student_id
      WHERE s.status = 'active'
    `).get() as any;

    const schoolAvgAttendanceResult = await db.prepare(`
      SELECT AVG(CASE WHEN a.status = 'present' THEN 100.0 ELSE 0 END) as avg_attendance
      FROM attendance a
      JOIN students s ON s.id = a.student_id
      WHERE s.status = 'active'
    `).get() as any;

    return success({
      students: top20,
      total_at_risk: atRiskStudents.length,
      total_students: totalStudents,
      school_avg_grade: schoolAvgGradeResult?.avg_grade ? Math.round(schoolAvgGradeResult.avg_grade) : null,
      school_avg_attendance: schoolAvgAttendanceResult?.avg_attendance ? Math.round(schoolAvgAttendanceResult.avg_attendance) : null,
    });
  } catch (error) {
    console.error('At-risk analytics error:', error);
    return serverError('فشل في جلب بيانات الطلاب المعرضين للخطر');
  }
}
