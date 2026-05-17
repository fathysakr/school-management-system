import { NextRequest } from 'next/server';
import db from '@/lib/database';
import { authenticate, unauthorized, serverError, success } from '@/lib/auth';
import { getSchoolStage, hasPermission } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'dashboard:stats')) return unauthorized();

    const { searchParams } = new URL(request.url);
    const schoolOverride = searchParams.get('school') || undefined;
    const stage = getSchoolStage(user.role);
    const effectiveStage = stage === 'both' && schoolOverride ? schoolOverride : stage;
    const isMiddle = effectiveStage === 'middle';
    const stageFilter = effectiveStage === 'both' ? '' : isMiddle ? "AND c.grade = 'المتوسطة'" : "AND c.grade = 'الثانوية'";
    const teacherStageFilter = effectiveStage === 'both' ? '' : isMiddle ? "AND c.grade = 'المتوسطة'" : "AND c.grade = 'الثانوية'";
    const classStageFilter = effectiveStage === 'both' ? '' : "AND grade = '" + (isMiddle ? 'المتوسطة' : 'الثانوية') + "'";

    const teacherCount = await db.prepare(`
      SELECT COUNT(DISTINCT t.id) as c FROM teachers t
      LEFT JOIN classes c ON t.id = c.teacher_id
      WHERE t.status = 'active' ${teacherStageFilter}
    `).get() as any;

    const studentCount = await db.prepare(`
      SELECT COUNT(DISTINCT e.student_id) as c FROM enrollments e
      JOIN classes c ON e.class_id = c.id
      WHERE e.status = 'active' ${stageFilter}
    `).get() as any;

    const classCount = await db.prepare(`
      SELECT COUNT(*) as c FROM classes WHERE status = 'active' ${classStageFilter}
    `).get() as any;

    const attendanceStats = await db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
             SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
             SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late,
             SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused
      FROM attendance a
      JOIN classes c ON a.class_id = c.id
      WHERE 1=1 ${stageFilter}
    `).get() as any;

    const gradeStats = await db.prepare(`
      SELECT AVG(g.score * 1.0 / g.total_score * 100) as avg_score,
             COUNT(*) as total
      FROM grades g
      JOIN classes c ON g.class_id = c.id
      WHERE 1=1 ${stageFilter}
    `).get() as any;

    const reportCounts = await db.prepare(`
      SELECT r.report_type, COUNT(*) as c
      FROM teacher_reports r
      JOIN classes c ON r.class_id = c.id
      WHERE r.status = 'active' ${stageFilter}
      GROUP BY r.report_type
    `).all() as any[];

    const middleVsHigh = await db.prepare(`
      SELECT grade, COUNT(*) as c FROM classes WHERE status = 'active' ${classStageFilter} GROUP BY grade
    `).all() as any[];

    const recentReports = await db.prepare(`
      SELECT r.*, s.first_name as student_first, s.last_name as student_last,
             t.first_name as teacher_first, t.last_name as teacher_last,
             c.class_name
      FROM teacher_reports r
      JOIN students s ON r.student_id = s.id
      JOIN teachers t ON r.teacher_id = t.id
      JOIN classes c ON r.class_id = c.id
      WHERE r.status = 'active' ${stageFilter}
      ORDER BY r.created_at DESC LIMIT 5
    `).all();

    const gradeDistribution = await db.prepare(`
      SELECT
        CASE
          WHEN g.score * 1.0 / g.total_score * 100 >= 90 THEN 'ممتاز'
          WHEN g.score * 1.0 / g.total_score * 100 >= 75 THEN 'جيد جداً'
          WHEN g.score * 1.0 / g.total_score * 100 >= 60 THEN 'جيد'
          WHEN g.score * 1.0 / g.total_score * 100 >= 50 THEN 'مقبول'
          ELSE 'ضعيف'
        END as level,
        COUNT(*) as c
      FROM grades g
      JOIN classes c ON g.class_id = c.id
      WHERE 1=1 ${stageFilter}
      GROUP BY level
    `).all();

    const attendanceRate = attendanceStats.total > 0
      ? Math.round((attendanceStats.present / attendanceStats.total) * 100)
      : 0;

    const avgScore = gradeStats.avg_score ? Math.round(gradeStats.avg_score) : 0;

    return success({
      stats: {
        teachers: teacherCount.c || 0,
        students: studentCount.c || 0,
        classes: classCount.c || 0,
        attendanceRate,
        totalAttendance: attendanceStats.total || 0,
        totalGrades: gradeStats.total || 0,
        avgScore,
        presentCount: attendanceStats.present || 0,
        absentCount: attendanceStats.absent || 0,
        lateCount: attendanceStats.late || 0,
        excusedCount: attendanceStats.excused || 0,
      },
      reportCounts,
      middleVsHigh,
      recentReports,
      gradeDistribution,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return serverError('Failed to fetch stats');
  }
}
