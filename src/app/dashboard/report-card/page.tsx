'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Chip, Grid, CircularProgress
} from '@mui/material';
import { Print, ArrowBack } from '@mui/icons-material';

const gradeColors: Record<string, string> = {
  ممتاز: '#2e7d32',
  'جيد جداً': '#1976d2',
  جيد: '#00838f',
  مقبول: '#ed6c02',
  ضعيف: '#d32f2f',
};

export default function ReportCardPage() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get('student_id');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    if (!studentId) {
      setLoading(false);
      return;
    }
    const fetchReport = async () => {
      try {
        const res = await api.get(`/report-card?student_id=${studentId}`, token);
        setData(res);
      } catch {
        setError('فشل في تحميل كشف الدرجات');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [token, studentId, router]);

  const handlePrint = () => {
    window.print();
  };

  const getGradeLevel = (avgPct: number) => {
    if (avgPct >= 90) return 'ممتاز';
    if (avgPct >= 75) return 'جيد جداً';
    if (avgPct >= 60) return 'جيد';
    if (avgPct >= 50) return 'مقبول';
    return 'ضعيف';
  };

  if (!studentId) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary">يرجى اختيار طالب لعرض كشف الدرجات</Typography>
        <Button variant="contained" startIcon={<ArrowBack />} sx={{ mt: 2 }} onClick={() => router.back()}>العودة</Button>
      </Box>
    );
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}><CircularProgress size={60} /></Box>;
  }

  if (error) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
        <Typography color="error">{error}</Typography>
        <Button variant="contained" sx={{ mt: 2 }} onClick={() => router.back()}>العودة</Button>
      </Paper>
    );
  }

  if (!data) return null;

  return (
    <Box>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0.5in; font-size: 12pt; }
          .report-card { box-shadow: none !important; border: 1px solid #ccc; }
          .report-card-header { background: #1a237e !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <Box className="no-print" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => router.back()}>العودة</Button>
        <Button variant="contained" startIcon={<Print />} onClick={handlePrint}>طباعة</Button>
      </Box>

      <Paper className="report-card" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box className="report-card-header" sx={{ bgcolor: '#1a237e', color: 'white', p: 3, textAlign: 'center' }}>
          <Typography variant="h4" fontWeight="bold">المدرسة</Typography>
          <Typography variant="h5" sx={{ mt: 1 }}>كشف الدرجات</Typography>
        </Box>

        <Box sx={{ p: 3 }}>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">الاسم</Typography>
              <Typography fontWeight="bold">{data.student.first_name} {data.student.last_name}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">رقم الطالب</Typography>
              <Typography fontWeight="bold">{data.student.student_id}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">الفصل</Typography>
              <Typography fontWeight="bold">{data.class_info?.class_name || '-'}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">الصف</Typography>
              <Typography fontWeight="bold">{data.class_info?.grade || '-'}</Typography>
            </Grid>
          </Grid>

          <TableContainer>
            <Table dir="rtl">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>المادة</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>عدد الاختبارات</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>متوسط النسبة</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>التقدير</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.subjects.map((s: any, i: number) => {
                  const level = getGradeLevel(s.avg_pct);
                  return (
                    <TableRow key={i}>
                      <TableCell sx={{ fontWeight: 600 }}>{s.subject}</TableCell>
                      <TableCell>{s.total_tests}</TableCell>
                      <TableCell>{isNaN(s.avg_pct) ? '-' : `${s.avg_pct.toFixed(1)}%`}</TableCell>
                      <TableCell>
                        <Chip label={level} size="small" sx={{ bgcolor: `${gradeColors[level]}20`, color: gradeColors[level], fontWeight: 600 }} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">المجموع الكلي</Typography>
                <Typography variant="h6" fontWeight="bold">
                  {data.subjects.reduce((sum: number, s: any) => sum + (isNaN(s.avg_pct) ? 0 : s.avg_pct), 0).toFixed(1)}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">النسبة المئوية</Typography>
                <Typography variant="h6" fontWeight="bold">{data.overall_pct.toFixed(1)}%</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">المستوى العام</Typography>
                <Chip label={data.grade_level} sx={{ bgcolor: `${gradeColors[data.grade_level]}20`, color: gradeColors[data.grade_level], fontWeight: 700, fontSize: '1rem' }} />
              </Grid>
            </Grid>
          </Box>

          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>ملخص الحضور</Typography>
            <Grid container spacing={1}>
              <Grid item xs={3}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                  <Typography variant="h6" fontWeight="bold" sx={{ color: '#2e7d32' }}>{data.attendance.present || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">الحضور</Typography>
                </Paper>
              </Grid>
              <Grid item xs={3}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                  <Typography variant="h6" fontWeight="bold" sx={{ color: '#d32f2f' }}>{data.attendance.absent || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">الغياب</Typography>
                </Paper>
              </Grid>
              <Grid item xs={3}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                  <Typography variant="h6" fontWeight="bold" sx={{ color: '#ed6c02' }}>{data.attendance.late || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">التأخر</Typography>
                </Paper>
              </Grid>
              <Grid item xs={3}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                  <Typography variant="h6" fontWeight="bold" sx={{ color: '#0288d1' }}>{data.attendance.excused || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">المعذرة</Typography>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
