'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, Card, CardContent, Grid, Button, CircularProgress,
  Chip, Avatar, Paper
} from '@mui/material';
import {
  School, Grade, EventNote, Assessment, Schedule, Person
} from '@mui/icons-material';

export default function ParentDashboard() {
  const { token } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    const fetchStudents = async () => {
      try {
        const res = await api.get('/parent/students', token);
        setStudents(res.students || []);
      } catch {
        setError('فشل في جلب بيانات الطلاب');
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [token, router]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
        <Typography color="error">{error}</Typography>
        <Button variant="contained" sx={{ mt: 2 }} onClick={() => window.location.reload()}>إعادة المحاولة</Button>
      </Paper>
    );
  }

  if (students.length === 0) {
    return (
      <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
        <School sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">لا يوجد طلاب مرتبطون بحسابك</Typography>
        <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>يرجى التواصل مع المدرسة لربط الطلاب بحساب ولي الأمر</Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="bold">مرحباً بك في بوابة ولي الأمر</Typography>
        <Typography color="text.secondary">يمكنك متابعة أداء أبنائك الدراسي من هنا</Typography>
      </Box>

      <Grid container spacing={3}>
        {students.map((student: any) => (
          <Grid item xs={12} md={6} key={student.id}>
            <Card sx={{ borderRadius: 3, overflow: 'visible', transition: '0.2s', '&:hover': { transform: 'translateY(-3px)', boxShadow: 6 } }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontSize: 24, fontWeight: 600 }}>
                    {student.first_name?.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">{student.first_name} {student.last_name}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Chip icon={<Person sx={{ fontSize: 14 }} />} label={student.student_id} size="small" variant="outlined" />
                      {student.school && (
                        <Chip label={student.school === 'middle' ? 'المرحلة المتوسطة' : 'المرحلة الثانوية'} size="small" color="primary" variant="outlined" />
                      )}
                    </Box>
                  </Box>
                </Box>

                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                  <Grid item xs={4}>
                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, textAlign: 'center' }}>
                      <Typography variant="h6" fontWeight="bold" color="primary.main">{student.subjects_count ?? '-'}</Typography>
                      <Typography variant="caption" color="text.secondary">عدد المواد</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, textAlign: 'center' }}>
                      <Typography variant="h6" fontWeight="bold" color="success.main">{student.grades_count ?? '-'}</Typography>
                      <Typography variant="caption" color="text.secondary">عدد الدرجات</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, textAlign: 'center' }}>
                      <Typography variant="h6" fontWeight="bold" color="info.main">{student.attendance_rate != null ? `${student.attendance_rate}%` : '-'}</Typography>
                      <Typography variant="caption" color="text.secondary">نسبة الحضور</Typography>
                    </Paper>
                  </Grid>
                </Grid>

                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Button fullWidth variant="outlined" startIcon={<Grade />} onClick={() => router.push(`/dashboard/parent/grades?student_id=${student.id}`)} sx={{ justifyContent: 'flex-start', borderRadius: 2, py: 1 }}>
                      عرض الدرجات
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button fullWidth variant="outlined" startIcon={<EventNote />} onClick={() => router.push(`/dashboard/parent/attendance?student_id=${student.id}`)} sx={{ justifyContent: 'flex-start', borderRadius: 2, py: 1 }}>
                      عرض الحضور
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button fullWidth variant="outlined" startIcon={<Assessment />} onClick={() => router.push(`/dashboard/parent/reports?student_id=${student.id}`)} sx={{ justifyContent: 'flex-start', borderRadius: 2, py: 1 }}>
                      عرض التقارير
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button fullWidth variant="outlined" startIcon={<Schedule />} onClick={() => router.push(`/dashboard/parent/schedule?student_id=${student.id}`)} sx={{ justifyContent: 'flex-start', borderRadius: 2, py: 1 }}>
                      عرض الجدول
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
