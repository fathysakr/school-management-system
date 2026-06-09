import { NextRequest } from 'next/server';
import db, { ensureTursoReady, getOrCreateTeacher } from '@/lib/database';
import { authenticate, unauthorized, serverError, success } from '@/lib/auth';
import { getSchoolStage, hasPermission } from '@/lib/permissions';
import { cached } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    await ensureTursoReady();
    const user = await authenticate(request);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, 'dashboard:stats')) return unauthorized();

    const { searchParams } = new URL(request.url);
    const schoolOverride = searchParams.get('school') || undefined;
    const stage = getSchoolStage(user.role);
    const effectiveStage = stage === 'both' && schoolOverride ? schoolOverride : stage;
    const isMiddle = effectiveStage === 'middle';
    const stageLikeMiddle = effectiveStage === 'both' ? null : (isMiddle ? '%متوسط%' : '%ثانوي%');
    const teacherSchoolParam = effectiveStage === 'both' ? null : effectiveStage;

    const stageParams = stageLikeMiddle ? [stageLikeMiddle] : [];
    const schoolParams = teacherSchoolParam ? [teacherSchoolParam] : [];

    const isTeacher = user.role === 'middle_teacher' || user.role === 'high_teacher';
    let generalStats = { stats: {}, reportCounts: [], middleVsHigh: [], recentReports: [], gradeDistribution: [], scheduleStats: [], teacherWorkload: [], subjectDistribution: [], hourlyDistribution: [] };
    if (!isTeacher) {
      const baseCacheKey = `stats:${effectiveStage || 'both'}`;
      generalStats = await cached(baseCacheKey, async () => {
        const [
          teacherCount, studentCount, classCount, attendanceStats, gradeStats,
          reportCounts, middleVsHigh, recentReports, gradeDistribution, scheduleStats,
          teacherWorkload, subjectDistribution, hourlyDistribution,
        ] = await Promise.all([
          db.prepare(`SELECT COUNT(*) as c FROM teachers t WHERE t.status = 'active' ${teacherSchoolParam ? 'AND t.school = ?' : ''}`).get(...schoolParams) as any,
          db.prepare(`SELECT COUNT(DISTINCT e.student_id) as c FROM enrollments e JOIN classes c ON e.class_id = c.id WHERE e.status = 'active' ${stageLikeMiddle ? 'AND c.grade LIKE ?' : ''}`).get(...stageParams) as any,
          db.prepare(`SELECT COUNT(*) as c FROM classes WHERE status = 'active' ${stageLikeMiddle ? 'AND grade LIKE ?' : ''}`).get(...stageParams) as any,
          db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) as present, SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) as absent, SUM(CASE WHEN a.status='late' THEN 1 ELSE 0 END) as late, SUM(CASE WHEN a.status='excused' THEN 1 ELSE 0 END) as excused, SUM(CASE WHEN a.status='escape' THEN 1 ELSE 0 END) as escapeCount FROM attendance a JOIN classes c ON a.class_id = c.id WHERE 1=1 ${stageLikeMiddle ? 'AND c.grade LIKE ?' : ''}`).get(...stageParams) as any,
          db.prepare(`SELECT AVG(g.score*1.0/g.total_score*100) as avg_score, COUNT(*) as total FROM grades g JOIN classes c ON g.class_id = c.id WHERE 1=1 ${stageLikeMiddle ? 'AND c.grade LIKE ?' : ''}`).get(...stageParams) as any,
          db.prepare(`SELECT r.report_type, COUNT(*) as c FROM teacher_reports r JOIN classes c ON r.class_id = c.id WHERE r.status='active' ${stageLikeMiddle ? 'AND c.grade LIKE ?' : ''} GROUP BY r.report_type`).all(...stageParams) as any,
          db.prepare(`SELECT CASE WHEN grade LIKE '%ثانوي%' THEN 'الثانوية' ELSE 'المتوسطة' END as stage, COUNT(*) as c FROM classes WHERE status='active' ${stageLikeMiddle ? 'AND grade LIKE ?' : ''} GROUP BY stage`).all(...stageParams) as any,
          db.prepare(`SELECT r.*, s.first_name as student_first, s.last_name as student_last, t.first_name as teacher_first, t.last_name as teacher_last, c.class_name FROM teacher_reports r JOIN students s ON r.student_id=s.id JOIN teachers t ON r.teacher_id=t.id JOIN classes c ON r.class_id=c.id WHERE r.status='active' ${stageLikeMiddle ? 'AND c.grade LIKE ?' : ''} ORDER BY r.created_at DESC LIMIT 5`).all(...stageParams) as any,
          db.prepare(`SELECT CASE WHEN g.score*1.0/g.total_score*100>=90 THEN 'ممتاز' WHEN g.score*1.0/g.total_score*100>=75 THEN 'جيد جداً' WHEN g.score*1.0/g.total_score*100>=60 THEN 'جيد' WHEN g.score*1.0/g.total_score*100>=50 THEN 'مقبول' ELSE 'ضعيف' END as level, COUNT(*) as c FROM grades g JOIN classes c ON g.class_id=c.id WHERE 1=1 ${stageLikeMiddle ? 'AND c.grade LIKE ?' : ''} GROUP BY level`).all(...stageParams) as any,
          db.prepare(`SELECT day_of_week, COUNT(*) as c FROM schedules s JOIN classes c ON s.class_id=c.id WHERE s.status='active' ${stageLikeMiddle ? 'AND c.grade LIKE ?' : ''} GROUP BY day_of_week`).all(...stageParams) as any,
          db.prepare(`SELECT t.id, t.first_name, t.last_name, COUNT(s.id) as session_count FROM schedules s JOIN teachers t ON s.teacher_id=t.id JOIN classes c ON s.class_id=c.id WHERE s.status='active' ${stageLikeMiddle ? 'AND c.grade LIKE ?' : ''} ${teacherSchoolParam ? 'AND t.school=?' : ''} GROUP BY t.id ORDER BY session_count DESC LIMIT 8`).all(...[...stageParams, ...schoolParams]) as any,
          db.prepare(`SELECT sub.name as subject_name, COUNT(s.id) as session_count FROM schedules s JOIN subjects sub ON sub.name=s.subject JOIN classes c ON s.class_id=c.id WHERE s.status='active' ${stageLikeMiddle ? 'AND c.grade LIKE ?' : ''} GROUP BY sub.id ORDER BY session_count DESC LIMIT 8`).all(...stageParams) as any,
          db.prepare(`SELECT CAST(SUBSTR(s.start_time,1,2) AS INTEGER) as hour, COUNT(*) as c FROM schedules s JOIN classes c ON s.class_id=c.id WHERE s.status='active' ${stageLikeMiddle ? 'AND c.grade LIKE ?' : ''} GROUP BY hour ORDER BY hour`).all(...stageParams) as any,
        ]);

        const attendanceRate = attendanceStats.total > 0
          ? Math.round((attendanceStats.present / attendanceStats.total) * 100)
          : 0;
        const avgScore = gradeStats.avg_score ? Math.round(gradeStats.avg_score) : 0;

        return {
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
            escapeCount: attendanceStats.escapeCount || 0,
          },
          reportCounts,
          middleVsHigh,
          recentReports,
          gradeDistribution,
          scheduleStats,
          teacherWorkload,
          subjectDistribution,
          hourlyDistribution,
        };
      }, 8_000);
    }

    // Teacher-specific stats
    let teacherStats = null;
    if (isTeacher) {
      const tid = await getOrCreateTeacher(user);
      if (tid) {
        const classFilter = "(c.teacher_id = ? OR c.id IN (SELECT class_id FROM schedules WHERE teacher_id = ? AND status = 'active') OR c.id IN (SELECT sc.class_id FROM subject_classes sc JOIN subjects s ON sc.subject_id = s.id WHERE s.teacher_id = ?))";
        const [myClasses, myStudents, myAttendance, myGradeStats, myPendingSubs, mySubjects] = await Promise.all([
          db.prepare(`SELECT COUNT(*) as c FROM classes WHERE status = 'active' AND (teacher_id = ? OR id IN (SELECT class_id FROM schedules WHERE teacher_id = ? AND status = 'active') OR id IN (SELECT sc.class_id FROM subject_classes sc JOIN subjects s ON sc.subject_id = s.id WHERE s.teacher_id = ?))`).get(tid, tid, tid),
          db.prepare(`SELECT COUNT(DISTINCT e.student_id) as c FROM enrollments e JOIN classes c ON e.class_id = c.id WHERE e.status = 'active' AND ${classFilter}`).get(tid, tid, tid),
          db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) as present, SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) as absent, SUM(CASE WHEN a.status='late' THEN 1 ELSE 0 END) as late, SUM(CASE WHEN a.status='excused' THEN 1 ELSE 0 END) as excused, SUM(CASE WHEN a.status='escape' THEN 1 ELSE 0 END) as escapeCount FROM attendance a JOIN classes c ON a.class_id = c.id WHERE ${classFilter}`).get(tid, tid, tid),
          db.prepare(`SELECT AVG(g.score*1.0/g.total_score*100) as avg_score, COUNT(*) as total FROM grades g JOIN classes c ON g.class_id = c.id WHERE ${classFilter}`).get(tid, tid, tid),
          db.prepare("SELECT COUNT(*) as c FROM substitutions WHERE substitute_teacher_id = ? AND status = 'pending'").get(tid),
          db.prepare("SELECT COUNT(*) as c FROM (SELECT s.subject FROM schedules s WHERE s.teacher_id = ? AND s.status = 'active' UNION SELECT s2.name FROM subjects s2 WHERE s2.teacher_id = ?)").get(tid, tid),
        ]);
        const myAttendanceRate = myAttendance.total > 0 ? Math.round((myAttendance.present / myAttendance.total) * 100) : 0;
        const myAvgScore = myGradeStats.avg_score ? Math.round(myGradeStats.avg_score) : 0;
        teacherStats = {
          teacherId: tid,
          classes: myClasses.c || 0,
          students: myStudents.c || 0,
          attendanceRate: myAttendanceRate,
          presentCount: myAttendance.present || 0,
          absentCount: myAttendance.absent || 0,
          lateCount: myAttendance.late || 0,
          excusedCount: myAttendance.excused || 0,
          escapeCount: myAttendance.escapeCount || 0,
          totalAttendance: myAttendance.total || 0,
          avgScore: myAvgScore,
          totalGrades: myGradeStats.total || 0,
          pendingSubstitutions: myPendingSubs.c || 0,
          subjects: mySubjects.c || 0,
        };
      }
    }

    return success({ ...generalStats, teacherStats });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return serverError('فشل في جلب الإحصائيات');
  }
}
