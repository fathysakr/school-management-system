'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { hasPermission, rolePermissions } from '@/lib/permissions';
import {
  Box, Typography, Grid, Paper, Card, CardContent, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress,
  Avatar, Button, IconButton
} from '@mui/material';
import {
  People, School, Class as ClassIcon, Campaign,
  Schedule, TrendingUp, AccessTime, WbSunny, NightsStay,
  CheckCircle, Psychology, MenuBook, EmojiEvents,
  Percent, Speed, Assignment, Refresh, SwapHoriz
} from '@mui/icons-material';
import EmptyState from '@/components/empty-state';

const roleLabels: Record<string, string> = {
  admin: 'مدير النظام',
  middle_supervisor: 'مشرف المرحلة المتوسطة',
  high_supervisor: 'مشرف المرحلة الثانوية',
  middle_teacher: 'معلم المرحلة المتوسطة',
  high_teacher: 'معلم المرحلة الثانوية',
  middle_counselor: 'مرشد طلابي - متوسط',
  high_counselor: 'مرشد طلابي - ثانوي',
  middle_principal: 'مدير المدرسة - متوسط',
  high_principal: 'مدير المدرسة - ثانوي',
};

const dayLabels: Record<string, string> = {
  sunday: 'الأحد', monday: 'الاثنين', tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء', thursday: 'الخميس',
};

const reportIcons: Record<string, React.ReactNode> = {
  activity: <Assignment sx={{ color: '#1976d2' }} />,
  positive: <EmojiEvents sx={{ color: '#2e7d32' }} />,
  behavioral: <Psychology sx={{ color: '#ed6c02' }} />,
  academic_deficiency: <MenuBook sx={{ color: '#d32f2f' }} />,
};

const reportLabels: Record<string, string> = {
  activity: 'نشاط', positive: 'إيجابي', behavioral: 'سلوكي', academic_deficiency: 'قصور دراسي',
};

function StatCard({ title, value, icon, color, subtitle, trend }: { title: string; value: number | string; icon: React.ReactNode; color: string; subtitle?: string; trend?: { up: boolean; text: string } }) {
  return (
    <Card sx={{ height: '100%', borderRadius: 3, transition: '0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 } }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="text.secondary" variant="body2" gutterBottom sx={{ fontWeight: 500 }}>{title}</Typography>
            <Typography variant="h4" fontWeight="bold">{value}</Typography>
            {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
            {trend && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                <TrendingUp sx={{ fontSize: 14, color: trend.up ? 'success.main' : 'error.main' }} />
                <Typography variant="caption" sx={{ color: trend.up ? 'success.main' : 'error.main' }}>{trend.text}</Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${color}.50`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, textAlign: 'center' }}>
      <Typography variant="h5" fontWeight="bold" sx={{ color }}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Paper>
  );
}

export default function DashboardPage() {
  const { user, token, selectedSchool } = useAuth();
  const schoolParam = selectedSchool && selectedSchool !== 'all' ? `&school=${selectedSchool}` : '';
  const router = useRouter();
  const [stats, setStats] = useState<any>({});
  const [reportCounts, setReportCounts] = useState<any[]>([]);
  const [middleVsHigh, setMiddleVsHigh] = useState<any[]>([]);
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [gradeDistribution, setGradeDistribution] = useState<any[]>([]);
  const [scheduleStats, setScheduleStats] = useState<any[]>([]);
  const [teacherWorkload, setTeacherWorkload] = useState<any[]>([]);
  const [subjectDistribution, setSubjectDistribution] = useState<any[]>([]);
  const [hourlyDistribution, setHourlyDistribution] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<any[]>([]);
  const [pendingSubstitutions, setPendingSubstitutions] = useState(0);
  const isTeacher = user?.role === 'middle_teacher' || user?.role === 'high_teacher';
  const [teacherStats, setTeacherStats] = useState<any>(null);
  const [teacherSubstitutions, setTeacherSubstitutions] = useState<any[]>([]);
  const [lastLogin, setLastLogin] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const todayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'][new Date().getDay() === 6 ? 0 : new Date().getDay() - 1] || 'sunday';

  const fetchAll = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const statsPromise = api.get(`/dashboard/stats${schoolParam ? '?' + schoolParam.replace('&', '') : ''}`, token).catch(() => null);
      const announcementsPromise = api.get(`/announcements${schoolParam ? '?' + schoolParam.replace('&', '') : ''}`, token).catch(() => null);

      const [statsRes, announcementsRes] = await Promise.all([statsPromise, announcementsPromise]);

      // Schedules: teacher gets filtered by teacher_id, others get all
      let schedulesRes = null;
      if (statsRes?.teacherStats?.teacherId && isTeacher) {
        schedulesRes = await api.get(`/schedules?day=${todayKey}&teacher_id=${statsRes.teacherStats.teacherId}`, token).catch(() => null);
      } else {
        schedulesRes = await api.get(`/schedules?day=${todayKey}${schoolParam}`, token).catch(() => null);
      }

      if (statsRes) {
        setStats(statsRes.stats || {});
        setReportCounts(statsRes.reportCounts || []);
        setMiddleVsHigh(statsRes.middleVsHigh || []);
        setRecentReports(statsRes.recentReports || []);
        setGradeDistribution(statsRes.gradeDistribution || []);
        setScheduleStats(statsRes.scheduleStats || []);
        setTeacherWorkload(statsRes.teacherWorkload || []);
        setSubjectDistribution(statsRes.subjectDistribution || []);
        setHourlyDistribution(statsRes.hourlyDistribution || []);
        setTeacherStats(statsRes.teacherStats || null);
      }

      if (announcementsRes?.announcements) setAnnouncements(announcementsRes.announcements.slice(0, 4));
      if (schedulesRes?.schedules) setTodaySchedules(schedulesRes.schedules);

      // Fetch teacher-specific substitutions
      if (isTeacher) {
        const subsRes = await api.get(`/substitutions?status=pending&as_substitute=true`, token).catch(() => null);
        if (subsRes?.substitutions) setTeacherSubstitutions(subsRes.substitutions);
      } else {
        const subsRes = await api.get(`/substitutions?status=pending${schoolParam}`, token).catch(() => null);
        if (subsRes?.substitutions) setPendingSubstitutions(subsRes.substitutions.length);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, schoolParam, todayKey, isTeacher]);

  useEffect(() => {
    if (!token) return;
    setLastLogin(localStorage.getItem('lastLogin') || '');
    fetchAll();
  }, [token, todayKey, selectedSchool, fetchAll]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><CircularProgress size={60} /></Box>;
  }

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'صباح الخير', icon: <WbSunny /> };
    if (hour < 17) return { text: 'مساء الخير', icon: <WbSunny /> };
    return { text: 'مساء الخير', icon: <NightsStay /> };
  };
  const greet = greeting();

  const can = (perm: any) => hasPermission(user?.role as any, perm);
  const gradeColor = (level: string) => {
    switch (level) {
      case 'ممتاز': return '#2e7d32';
      case 'جيد جداً': return '#1976d2';
      case 'جيد': return '#0288d1';
      case 'مقبول': return '#ed6c02';
      default: return '#d32f2f';
    }
  };

  return (
    <Box>
      {/* Header */}
      <Card sx={{ mb: 3, borderRadius: 3, background: 'linear-gradient(135deg, #1a237e 0%, #4a148c 100%)', color: 'white' }}>
        <CardContent sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight="bold">{greet.text}، {user?.name || user?.email}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ opacity: 0.85, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTime sx={{ fontSize: 16 }} />
                آخر دخول: {lastLogin ? formatDate(lastLogin) : 'أول مرة'}
              </Typography>
              <Chip label={roleLabels[user?.role || ''] || user?.role} size="small" sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', fontWeight: 600 }} variant="outlined" />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={() => fetchAll(true)} disabled={refreshing} sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
              <Refresh />
            </IconButton>
          </Box>
        </CardContent>
      </Card>

      {/* Teacher Stats */}
      {isTeacher && teacherStats ? (
        <>
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3} md={2}>
              <StatCard title="فصولي" value={teacherStats.classes} icon={<ClassIcon sx={{ color: '#0288d1' }} />} color="#0288d1" subtitle="الخاصة بك" />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <StatCard title="المواد" value={teacherStats.subjects} icon={<MenuBook sx={{ color: '#7c4dff' }} />} color="#7c4dff" subtitle="التي تدرسها" />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <StatCard title="الطلاب" value={teacherStats.students} icon={<School sx={{ color: '#2e7d32' }} />} color="#2e7d32" subtitle="في فصولي" />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <StatCard title="معدل الحضور" value={teacherStats.attendanceRate != null ? `${teacherStats.attendanceRate}%` : '0%'} icon={<Percent sx={{ color: (teacherStats.attendanceRate ?? 0) >= 80 ? '#2e7d32' : '#ed6c02' }} />} color={(teacherStats.attendanceRate ?? 0) >= 80 ? '#2e7d32' : '#ed6c02'} subtitle={teacherStats.totalAttendance != null ? `${teacherStats.totalAttendance} سجل` : '0 سجل'} />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <StatCard title="المتوسط العام" value={teacherStats.avgScore != null ? `${teacherStats.avgScore}%` : '0%'} icon={<Speed sx={{ color: (teacherStats.avgScore ?? 0) >= 75 ? '#2e7d32' : '#ed6c02' }} />} color={(teacherStats.avgScore ?? 0) >= 75 ? '#2e7d32' : '#ed6c02'} subtitle={teacherStats.totalGrades != null ? `${teacherStats.totalGrades} درجة` : '0 درجة'} />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <StatCard title="حصص الانتظار" value={teacherStats.pendingSubstitutions} icon={<SwapHoriz sx={{ color: '#e65100' }} />} color="#e65100" subtitle="قيد الانتظار" />
            </Grid>
          </Grid>

          {/* Detailed Attendance */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={2.4}>
              <MiniStat label="حاضر" value={teacherStats.presentCount || 0} color="#2e7d32" />
            </Grid>
            <Grid item xs={6} sm={2.4}>
              <MiniStat label="غائب" value={teacherStats.absentCount || 0} color="#d32f2f" />
            </Grid>
            <Grid item xs={6} sm={2.4}>
              <MiniStat label="متأخر" value={teacherStats.lateCount || 0} color="#ed6c02" />
            </Grid>
            <Grid item xs={6} sm={2.4}>
              <MiniStat label="استئذان" value={teacherStats.excusedCount || 0} color="#0288d1" />
            </Grid>
            <Grid item xs={6} sm={2.4}>
              <MiniStat label="هروب" value={teacherStats.escapeCount || 0} color="#d32f2f" />
            </Grid>
          </Grid>

          {/* Teacher Pending Substitutions */}
          {teacherSubstitutions.length > 0 && (
            <Card sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <SwapHoriz color="warning" />
                  <Typography variant="h6" fontWeight="bold">حصص الانتظار القادمة</Typography>
                  <Chip label={`${teacherSubstitutions.length} حصة`} size="small" color="warning" variant="outlined" sx={{ mr: 'auto' }} />
                  <Button size="small" variant="text" onClick={() => router.push('/dashboard/substitutions')}>عرض الكل</Button>
                </Box>
                <TableContainer>
                  <Table size="small" dir="rtl">
                    <TableHead>
                      <TableRow>
                        <TableCell>التاريخ</TableCell>
                        <TableCell>الوقت</TableCell>
                        <TableCell>المادة</TableCell>
                        <TableCell>الفصل</TableCell>
                        <TableCell>المعلم الأصلي</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {teacherSubstitutions.slice(0, 5).map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{s.date}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{s.start_time} - {s.end_time}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{s.subject}</TableCell>
                          <TableCell>{s.class_name}</TableCell>
                          <TableCell>{s.absent_first} {s.absent_last}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <>
          {/* Main Stats */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={2}>
              <StatCard title="المعلمون" value={stats.teachers} icon={<People sx={{ color: '#7c4dff' }} />} color="#7c4dff" subtitle="إجمالي" />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <StatCard title="الطلاب" value={stats.students} icon={<School sx={{ color: '#2e7d32' }} />} color="#2e7d32" subtitle="إجمالي" />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <StatCard title="الفصول" value={stats.classes} icon={<ClassIcon sx={{ color: '#0288d1' }} />} color="#0288d1" subtitle="نشطة" />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <StatCard title="معدل الحضور" value={stats.attendanceRate != null ? `${stats.attendanceRate}%` : '0%'} icon={<Percent sx={{ color: (stats.attendanceRate ?? 0) >= 80 ? '#2e7d32' : '#ed6c02' }} />} color={(stats.attendanceRate ?? 0) >= 80 ? '#2e7d32' : '#ed6c02'} subtitle={stats.totalAttendance != null ? `${stats.totalAttendance} سجل` : '0 سجل'} />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <StatCard title="المتوسط العام" value={stats.avgScore != null ? `${stats.avgScore}%` : '0%'} icon={<Speed sx={{ color: (stats.avgScore ?? 0) >= 75 ? '#2e7d32' : '#ed6c02' }} />} color={(stats.avgScore ?? 0) >= 75 ? '#2e7d32' : '#ed6c02'} subtitle={stats.totalGrades != null ? `${stats.totalGrades} درجة` : '0 درجة'} />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <StatCard title="استبدالات معلقة" value={pendingSubstitutions} icon={<Schedule sx={{ color: '#e65100' }} />} color="#e65100" subtitle="قيد الانتظار" />
            </Grid>
          </Grid>

          {/* Detailed Attendance */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={2.4}>
              <MiniStat label="حاضر" value={stats.presentCount || 0} color="#2e7d32" />
            </Grid>
            <Grid item xs={6} sm={2.4}>
              <MiniStat label="غائب" value={stats.absentCount || 0} color="#d32f2f" />
            </Grid>
            <Grid item xs={6} sm={2.4}>
              <MiniStat label="متأخر" value={stats.lateCount || 0} color="#ed6c02" />
            </Grid>
            <Grid item xs={6} sm={2.4}>
              <MiniStat label="استئذان" value={stats.excusedCount || 0} color="#0288d1" />
            </Grid>
            <Grid item xs={6} sm={2.4}>
              <MiniStat label="هروب" value={stats.escapeCount || 0} color="#d32f2f" />
            </Grid>
          </Grid>
        </>
      )}

      {/* Reports count */}
      {reportCounts.length > 0 && (
        <Card sx={{ borderRadius: 3, mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Assignment color="primary" />
              <Typography variant="h6" fontWeight="bold">التقارير</Typography>
            </Box>
            <Grid container spacing={1.5}>
              {reportCounts.map((r: any) => (
                <Grid item xs={6} sm={3} key={r.report_type}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    {reportIcons[r.report_type] || <Assignment />}
                    <Box>
                      <Typography variant="caption" color="text.secondary">{reportLabels[r.report_type] || r.report_type}</Typography>
                      <Typography fontWeight="bold">{r.c}</Typography>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Middle vs High */}
      {middleVsHigh.length > 0 && (
        <Card sx={{ borderRadius: 3, mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <ClassIcon color="primary" />
              <Typography variant="h6" fontWeight="bold">توزيع الفصول حسب المرحلة</Typography>
            </Box>
            <Grid container spacing={1.5}>
              {middleVsHigh.map((m: any) => (
                <Grid item xs={6} key={m.stage}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: 'center', bgcolor: m.stage === 'المتوسطة' ? '#e3f2fd' : '#fff3e0' }}>
                    <Typography fontWeight="bold" sx={{ color: m.stage === 'المتوسطة' ? '#1565c0' : '#e65100' }}>
                      {m.stage === 'المتوسطة' ? 'المدرسة المتوسطة' : 'المدرسة الثانوية'}
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" sx={{ color: m.stage === 'المتوسطة' ? '#1565c0' : '#e65100' }}>
                      {m.c}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">فصل</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={3}>
        {/* Left column */}
        <Grid item xs={12} md={7}>
          {/* Announcements */}
          {can('announcements:view') && (
            <Card sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Campaign color="primary" />
                  <Typography variant="h6" fontWeight="bold">آخر التنبيهات</Typography>
                  <Button size="small" variant="text" sx={{ mr: 'auto' }} onClick={() => router.push('/dashboard/announcements')}>عرض الكل</Button>
                </Box>
                {announcements.length === 0 ? (
                  <EmptyState message="لا توجد تنبيهات" icon={<Campaign sx={{ fontSize: 48, color: 'grey.300' }} />} />
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {announcements.map((a) => (
                      <Paper key={a.id} variant="outlined" sx={{ p: 2, borderRadius: 2, borderRight: '3px solid #1976d2' }}>
                        <Typography fontWeight="bold" sx={{ mb: 0.5 }}>{a.title}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{
                          overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
                        }}>
                          {a.content}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                          {a.published_date ? formatDate(a.published_date) : ''}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          {/* Today's Schedule */}
          <Card sx={{ borderRadius: 3, mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Schedule color="primary" />
                <Typography variant="h6" fontWeight="bold">حصص اليوم ({dayLabels[todayKey]})</Typography>
                <Chip label={`${todaySchedules.length} حصة`} size="small" color="primary" variant="outlined" sx={{ mr: 'auto' }} />
                <Button size="small" variant="text" onClick={() => router.push('/dashboard/schedules')}>عرض الكل</Button>
              </Box>
              {todaySchedules.length === 0 ? (
                  <EmptyState message="لا توجد حصص اليوم" icon={<Schedule sx={{ fontSize: 48, color: 'grey.300' }} />} />
              ) : (
                <TableContainer>
                  <Table size="small" dir="rtl">
                    <TableHead>
                      <TableRow>
                        <TableCell>الوقت</TableCell>
                        <TableCell>المادة</TableCell>
                        <TableCell>الفصل</TableCell>
                        <TableCell>المعلم</TableCell>
                        <TableCell>القاعة</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {todaySchedules.sort((a, b) => a.start_time.localeCompare(b.start_time)).map((s) => (
                        <TableRow key={s.id}>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{s.start_time} - {s.end_time}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{s.subject}</TableCell>
                          <TableCell>{s.class_name}</TableCell>
                          <TableCell>{s.teacher_first} {s.teacher_last}</TableCell>
                          <TableCell>{s.room_number || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          {/* Recent Reports */}
          {recentReports.length > 0 && (
            <Card sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Assignment color="primary" />
                  <Typography variant="h6" fontWeight="bold">آخر التقارير</Typography>
                  <Button size="small" variant="text" sx={{ mr: 'auto' }} onClick={() => router.push('/dashboard/reports')}>عرض الكل</Button>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {recentReports.map((r: any) => (
                    <Paper key={r.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      {reportIcons[r.report_type] || <Assignment />}
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body2" fontWeight="bold">{r.title || reportLabels[r.report_type]}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {r.student_first} {r.student_last} · {r.class_name}
                        </Typography>
                      </Box>
                      <Chip label={reportLabels[r.report_type]} size="small" variant="outlined" />
                    </Paper>
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Right column */}
        <Grid item xs={12} md={5}>
          {/* Quick Actions */}
          {(can('teachers:create') || can('students:create') || can('reports:create') || can('announcements:create')) && (
            <Card sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Speed color="primary" />
                  <Typography variant="h6" fontWeight="bold">إجراءات سريعة</Typography>
                </Box>
                <Grid container spacing={1}>
                  {can('teachers:create') && (
                    <Grid item xs={6}>
                      <Button variant="outlined" fullWidth startIcon={<People />} onClick={() => router.push('/dashboard/teachers')} sx={{ justifyContent: 'flex-start', py: 1.5, borderRadius: 2 }}>
                        معلم جديد
                      </Button>
                    </Grid>
                  )}
                  {can('students:create') && (
                    <Grid item xs={6}>
                      <Button variant="outlined" fullWidth startIcon={<School />} onClick={() => router.push('/dashboard/students')} sx={{ justifyContent: 'flex-start', py: 1.5, borderRadius: 2 }}>
                        طالب جديد
                      </Button>
                    </Grid>
                  )}
                  {can('reports:create') && (
                    <Grid item xs={6}>
                      <Button variant="outlined" fullWidth startIcon={<Assignment />} onClick={() => router.push('/dashboard/reports')} sx={{ justifyContent: 'flex-start', py: 1.5, borderRadius: 2 }}>
                        تقرير جديد
                      </Button>
                    </Grid>
                  )}
                  {can('announcements:create') && (
                    <Grid item xs={6}>
                      <Button variant="outlined" fullWidth startIcon={<Campaign />} onClick={() => router.push('/dashboard/announcements')} sx={{ justifyContent: 'flex-start', py: 1.5, borderRadius: 2 }}>
                        تنبيه جديد
                      </Button>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Schedule Overview */}
          {scheduleStats.length > 0 && (
            <Card sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Schedule color="primary" />
                  <Typography variant="h6" fontWeight="bold">توزيع الحصص الأسبوعي</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'].map(day => {
                    const stat = scheduleStats.find((s: any) => s.day_of_week === day);
                    const count = stat?.c || 0;
                    const maxCount = Math.max(...scheduleStats.map((s: any) => s.c), 1);
                    const pct = (count / maxCount) * 100;
                    return (
                      <Paper key={day} variant="outlined" sx={{ p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography variant="body2" sx={{ minWidth: 70, fontWeight: 600 }}>{dayLabels[day]}</Typography>
                        <Box sx={{ flexGrow: 1, height: 8, bgcolor: 'grey.100', borderRadius: 4, overflow: 'hidden' }}>
                          <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: '#1976d2', borderRadius: 4, transition: 'width 0.5s' }} />
                        </Box>
                        <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 30, textAlign: 'left' }}>{count}</Typography>
                      </Paper>
                    );
                  })}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Grade Distribution */}
          {gradeDistribution.length > 0 && (
            <Card sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <EmojiEvents color="primary" />
                  <Typography variant="h6" fontWeight="bold">توزيع الدرجات</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {gradeDistribution.map((g: any) => (
                    <Paper key={g.level} variant="outlined" sx={{ p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: gradeColor(g.level), flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ flexGrow: 1 }}>{g.level}</Typography>
                      <Chip label={g.c} size="small" sx={{ bgcolor: `${gradeColor(g.level)}15`, color: gradeColor(g.level), fontWeight: 600 }} />
                    </Paper>
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Teacher Workload */}
          {teacherWorkload.length > 0 && (
            <Card sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <People color="primary" />
                  <Typography variant="h6" fontWeight="bold">توزيع الحصص على المعلمين</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {teacherWorkload.map((t: any) => {
                    const maxCount = Math.max(...teacherWorkload.map((x: any) => x.session_count), 1);
                    const pct = (t.session_count / maxCount) * 100;
                    return (
                      <Paper key={t.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: '#7c4dff', fontSize: 12 }}>
                          {t.first_name?.charAt(0)}
                        </Avatar>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight="bold" noWrap>{t.first_name} {t.last_name}</Typography>
                          <Box sx={{ height: 6, bgcolor: 'grey.100', borderRadius: 3, overflow: 'hidden', mt: 0.5 }}>
                            <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: '#7c4dff', borderRadius: 3, transition: 'width 0.5s' }} />
                          </Box>
                        </Box>
                        <Typography variant="body2" fontWeight="bold" sx={{ color: '#7c4dff', minWidth: 24, textAlign: 'center' }}>{t.session_count}</Typography>
                      </Paper>
                    );
                  })}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Subject Distribution */}
          {subjectDistribution.length > 0 && (
            <Card sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <MenuBook color="primary" />
                  <Typography variant="h6" fontWeight="bold">توزيع الحصص حسب المواد</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {subjectDistribution.map((sub: any, i: number) => {
                    const maxCount = Math.max(...subjectDistribution.map((x: any) => x.session_count), 1);
                    const pct = (sub.session_count / maxCount) * 100;
                    const colors = ['#1976d2', '#2e7d32', '#ed6c02', '#d32f2f', '#7c4dff', '#00838f', '#4a148c', '#e65100'];
                    return (
                      <Paper key={sub.subject_name} variant="outlined" sx={{ p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colors[i % colors.length], flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 500 }} noWrap>{sub.subject_name}</Typography>
                        <Box sx={{ width: 80, height: 6, bgcolor: 'grey.100', borderRadius: 3, overflow: 'hidden' }}>
                          <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: colors[i % colors.length], borderRadius: 3, transition: 'width 0.5s' }} />
                        </Box>
                        <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 24, textAlign: 'center' }}>{sub.session_count}</Typography>
                      </Paper>
                    );
                  })}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Hourly Distribution */}
          {hourlyDistribution.length > 0 && (
            <Card sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <AccessTime color="primary" />
                  <Typography variant="h6" fontWeight="bold">توزيع الحصص حسب الوقت</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {hourlyDistribution.map((h: any) => {
                    const maxCount = Math.max(...hourlyDistribution.map((x: any) => x.c), 1);
                    const pct = (h.c / maxCount) * 100;
                    return (
                      <Paper key={h.hour} variant="outlined" sx={{ p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography variant="body2" sx={{ minWidth: 40, fontWeight: 600 }}>{h.hour}:00</Typography>
                        <Box sx={{ flexGrow: 1, height: 8, bgcolor: 'grey.100', borderRadius: 4, overflow: 'hidden' }}>
                          <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: '#00838f', borderRadius: 4, transition: 'width 0.5s' }} />
                        </Box>
                        <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 24, textAlign: 'left' }}>{h.c}</Typography>
                      </Paper>
                    );
                  })}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Recent Students */}
          <Card sx={{ borderRadius: 3, mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <School color="success" />
                <Typography variant="h6" fontWeight="bold">أحدث الطلاب</Typography>
                <Button size="small" variant="text" sx={{ mr: 'auto' }} onClick={() => router.push('/dashboard/students')}>عرض الكل</Button>
              </Box>
              <Typography color="text.secondary" textAlign="center" sx={{ py: 3 }}>لا يوجد طلاب</Typography>
            </CardContent>
          </Card>

          {/* Your Permissions */}
          {user?.role && !isTeacher && (
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CheckCircle color="primary" />
                  <Typography variant="h6" fontWeight="bold">الصلاحيات المتاحة</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(rolePermissions[user.role as keyof typeof rolePermissions] || []).slice(0, 12).map((perm) => (
                    <Chip key={perm} label={perm} size="small" color="primary" variant="outlined" />
                  ))}
                  {(rolePermissions[user.role as keyof typeof rolePermissions] || []).length > 12 && (
                    <Chip label={`+${(rolePermissions[user.role as keyof typeof rolePermissions] || []).length - 12} أخرى`} size="small" variant="outlined" />
                  )}
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
