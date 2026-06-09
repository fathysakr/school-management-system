'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, Grid, Card, CardContent, Paper, Table, TableHead, TableBody,
  TableRow, TableCell, Chip, LinearProgress, CircularProgress, Alert
} from '@mui/material';
import { School, Warning, EventNote, Grade } from '@mui/icons-material';

export default function AnalyticsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>({});
  const [atRisk, setAtRisk] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    let cancelled = false;
    const fetchData = async () => {
      try {
        const [analyticsRes, atRiskRes] = await Promise.all([
          api.get('/analytics', token),
          api.get('/analytics/at-risk', token),
        ]);
        if (!cancelled) {
          setAnalytics(analyticsRes);
          setAtRisk(atRiskRes?.students || atRiskRes || []);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'فشل تحميل التحليلات');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [token, router]);

  const riskBgColor = (score: number) => {
    if (score < 30) return '#ff9800';
    if (score <= 60) return '#f57c00';
    return '#d32f2f';
  };

  const progressColor = (score: number) => {
    if (score < 30) return 'warning';
    if (score <= 60) return 'warning';
    return 'error';
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><CircularProgress size={60} /></Box>;
  }

  const summaryCards = [
    { title: 'إجمالي الطلاب', value: analytics.total_students || 0, icon: <School sx={{ fontSize: 32 }} />, color: 'primary' },
    { title: 'الطلاب المعرضون للخطر', value: analytics.total_at_risk || 0, icon: <Warning sx={{ fontSize: 32 }} />, color: 'error' },
    { title: 'نسبة الحضور العامة', value: analytics.avg_attendance != null ? `${analytics.avg_attendance}%` : '0%', icon: <EventNote sx={{ fontSize: 32 }} />, color: 'info' },
    { title: 'المعدل العام', value: analytics.avg_grade != null ? `${analytics.avg_grade}%` : '0%', icon: <Grade sx={{ fontSize: 32 }} />, color: 'success' },
  ];

  const gradeDistribution = analytics.grade_distribution || [];

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>التحليلات الذكية</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {summaryCards.map((card) => (
          <Grid item xs={12} sm={6} md={3} key={card.title}>
            <Card sx={{ height: '100%', borderRadius: 3, transition: '0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 } }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2" gutterBottom sx={{ fontWeight: 500 }}>{card.title}</Typography>
                    <Typography variant="h4" fontWeight="bold">{card.value}</Typography>
                  </Box>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${card.color}.50`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: `${card.color}.main` }}>
                    {card.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {gradeDistribution.length > 0 && (
        <Card sx={{ borderRadius: 3, mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>توزيع المستويات الدراسية</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {gradeDistribution.map((g: any) => (
                <Chip key={g.level || g.grade_level} label={`${g.level || g.grade_level}: ${g.count || g.c}`} variant="outlined" color="primary" />
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Box sx={{ mb: 1 }}>
            <Typography variant="h6" fontWeight="bold">الطلاب المعرضون للخطر</Typography>
            <Typography variant="body2" color="text.secondary">
              يتم تحديد الطلاب المعرضين للخطر بناءً على انخفاض نسبة الحضور (أقل من 80%) أو تدني الدرجات (أقل من 60%) أو تكرار التقارير السلوكية
            </Typography>
          </Box>
          {atRisk.length === 0 ? (
            <Alert severity="success" sx={{ borderRadius: 2, mt: 2 }}>
              لا يوجد طلاب معرضون للخطر — أداء عام ممتاز
            </Alert>
          ) : (
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <Table dir="rtl">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>اسم الطالب</TableCell>
                    <TableCell>رقم الطالب</TableCell>
                    <TableCell>الفصل</TableCell>
                    <TableCell>نسبة الخطورة</TableCell>
                    <TableCell>الحضور</TableCell>
                    <TableCell>المعدل</TableCell>
                    <TableCell>التقارير السلوكية</TableCell>
                    <TableCell>الأسباب</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {atRisk.map((s: any, i: number) => {
                    const riskScore = s.risk_score ?? s.riskPercentage ?? 0;
                    return (
                      <TableRow key={s.id || i}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{s.student_name || `${s.first_name} ${s.last_name}`}</TableCell>
                        <TableCell>{s.student_number || s.student_id || '-'}</TableCell>
                        <TableCell>{s.class_name || s.class || '-'}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ flexGrow: 1, minWidth: 80 }}>
                              <LinearProgress variant="determinate" value={riskScore} color={progressColor(riskScore)} sx={{ height: 8, borderRadius: 4 }} />
                            </Box>
                            <Chip
                              label={`${riskScore}%`}
                              size="small"
                              sx={{ bgcolor: riskBgColor(riskScore), color: '#fff', fontWeight: 600, minWidth: 48 }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ color: (s.attendance || s.attendancePercentage || 100) < 80 ? 'error.main' : 'success.main', fontWeight: 600 }}>
                            {s.attendance != null ? `${s.attendance}%` : s.attendancePercentage != null ? `${s.attendancePercentage}%` : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ color: (s.grade || s.averageGrade || 100) < 60 ? 'error.main' : 'success.main', fontWeight: 600 }}>
                            {s.grade != null ? `${s.grade}%` : s.averageGrade != null ? `${s.averageGrade}%` : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>{s.behavioral_reports ?? s.reportsCount ?? 0}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(s.reasons || s.causes || []).map((r: string, idx: number) => (
                              <Chip key={idx} label={r} size="small" variant="outlined" color="error" />
                            ))}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Paper>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
