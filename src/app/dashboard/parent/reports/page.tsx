'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box, Typography, Button, Card, CardContent, Paper, Chip, CircularProgress, Avatar
} from '@mui/material';
import { ArrowBack, Assessment, Psychology, EmojiEvents, MenuBook, Assignment } from '@mui/icons-material';

const reportConfig: Record<string, { label: string; icon: React.ReactNode; color: string; lightBg: string }> = {
  behavioral: {
    label: 'تقرير سلوكي', icon: <Psychology />, color: '#ed6c02', lightBg: '#fff3e0',
  },
  positive: {
    label: 'تقرير إيجابي', icon: <EmojiEvents />, color: '#2e7d32', lightBg: '#e8f5e9',
  },
  academic_deficiency: {
    label: 'تقرير قصور دراسي', icon: <MenuBook />, color: '#d32f2f', lightBg: '#ffebee',
  },
  activity: {
    label: 'تقرير نشاط', icon: <Assignment />, color: '#1976d2', lightBg: '#e3f2fd',
  },
};

const formatDate = (d: string) => {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
};

export default function ParentReportsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get('student_id');
  const [reports, setReports] = useState<any[]>([]);
  const [studentName, setStudentName] = useState('');
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
    const fetchReports = async () => {
      try {
        const res = await api.get(`/parent/students/${studentId}/reports`, token);
        setReports(res.reports || []);
        setStudentName(res.student_name || '');
      } catch {
        setError('فشل في جلب التقارير');
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [token, studentId, router]);

  if (!studentId) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Assessment sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">يرجى اختيار طالب لعرض التقارير</Typography>
        <Button variant="contained" startIcon={<ArrowBack />} sx={{ mt: 2 }} onClick={() => router.push('/dashboard/parent')}>العودة للرئيسية</Button>
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
        <Button variant="contained" sx={{ mt: 2 }} onClick={() => router.push('/dashboard/parent')}>العودة</Button>
      </Paper>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => router.push('/dashboard/parent')}>العودة</Button>
        <Box>
          <Typography variant="h5" fontWeight="bold">التقارير</Typography>
          {studentName && <Typography variant="body2" color="text.secondary">الطالب: {studentName}</Typography>}
        </Box>
      </Box>

      {reports.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <Assessment sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">لا توجد تقارير لهذا الطالب</Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {reports.map((r: any) => {
            const cfg = reportConfig[r.report_type] || reportConfig.activity;
            return (
              <Card key={r.id} sx={{ borderRadius: 2, borderRight: `4px solid ${cfg.color}`, transition: '0.2s', '&:hover': { boxShadow: 4 } }}>
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Avatar sx={{ bgcolor: cfg.lightBg, width: 48, height: 48 }}>
                      {cfg.icon}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                        <Chip label={cfg.label} size="small" sx={{ bgcolor: cfg.lightBg, color: cfg.color, fontWeight: 600 }} />
                        {r.title && <Typography fontWeight="bold">{r.title}</Typography>}
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, mb: 1.5 }}>
                        {r.content}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {r.teacher_first && (
                          <Chip
                            avatar={<Avatar sx={{ width: 20, height: 20, fontSize: 10 }}>{r.teacher_first?.charAt(0)}</Avatar>}
                            label={`${r.teacher_first} ${r.teacher_last}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        <Chip label={formatDate(r.date)} size="small" variant="outlined" />
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
