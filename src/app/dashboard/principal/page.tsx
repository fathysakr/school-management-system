'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, Grid, Card, CardContent, Avatar, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress
} from '@mui/material';
import {
  People, School, Class as ClassIcon, EventNote, Grade,
  AdminPanelSettings, TrendingUp
} from '@mui/icons-material';

const roleLabels: Record<string, string> = {
  middle_principal: 'مدير المدرسة - المتوسطة',
  high_principal: 'مدير المدرسة - الثانوية',
};

const schoolLabel: Record<string, string> = {
  middle: 'المتوسطة',
  high: 'الثانوية',
};

export default function PrincipalPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    if (!user.role.includes('principal')) {
      router.push('/dashboard');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (!token) return;
    api.get('/dashboard/stats', token).then((res) => {
      setStats(res);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  if (!user || loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><CircularProgress size={60} /></Box>;

  const isHigh = user.role === 'high_principal';
  const primaryColor = isHigh ? '#880e4f' : '#4a148c';

  const statCards = [
    { label: 'المعلمون', value: stats?.teacherCount || 0, icon: <People />, color: '#1565c0' },
    { label: 'الطلاب', value: stats?.studentCount || 0, icon: <School />, color: '#2e7d32' },
    { label: 'الفصول', value: stats?.classCount || 0, icon: <ClassIcon />, color: '#e65100' },
    { label: 'سجلات الحضور', value: stats?.attendanceCount || 0, icon: <EventNote />, color: '#6a1b9a' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Avatar sx={{ bgcolor: primaryColor, width: 48, height: 48 }}>
          <AdminPanelSettings />
        </Avatar>
        <Box>
          <Typography variant="h4" fontWeight="bold">شؤون المدرسة</Typography>
          <Typography variant="body2" color="text.secondary">
            {roleLabels[user.role]} — {schoolLabel[user.school || (isHigh ? 'high' : 'middle')]}
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map((card) => (
          <Grid item xs={6} sm={3} key={card.label}>
            <Card sx={{ borderRadius: 3, borderTop: `3px solid ${card.color}` }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Box sx={{ color: card.color, mb: 0.5 }}>{card.icon}</Box>
                <Typography variant="h4" fontWeight="bold">{card.value}</Typography>
                <Typography variant="body2" color="text.secondary">{card.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <TrendingUp color="primary" />
                <Typography variant="h6" fontWeight="bold">آخر الحضور</Typography>
              </Box>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>التاريخ</TableCell>
                      <TableCell>حاضر</TableCell>
                      <TableCell>غائب</TableCell>
                      <TableCell>النسبة</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(stats?.recentAttendance || []).length === 0 ? (
                      <TableRow><TableCell colSpan={4} align="center">لا توجد بيانات</TableCell></TableRow>
                    ) : (
                      (stats?.recentAttendance || []).slice(0, 5).map((r: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell>{r.date}</TableCell>
                          <TableCell>{r.present}</TableCell>
                          <TableCell>{r.absent}</TableCell>
                          <TableCell>
                            <Chip
                              label={`${Math.round((r.present / (r.present + r.absent || 1)) * 100)}%`}
                              size="small"
                              color={((r.present / (r.present + r.absent || 1)) >= 0.8) ? 'success' : 'warning'}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Grade color="primary" />
                <Typography variant="h6" fontWeight="bold">معدل الدرجات</Typography>
              </Box>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>المادة</TableCell>
                      <TableCell>عدد التقييمات</TableCell>
                      <TableCell>المعدل</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(stats?.gradeAverages || []).length === 0 ? (
                      <TableRow><TableCell colSpan={3} align="center">لا توجد بيانات</TableCell></TableRow>
                    ) : (
                      (stats?.gradeAverages || []).slice(0, 5).map((r: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell>{r.subject}</TableCell>
                          <TableCell>{r.count}</TableCell>
                          <TableCell>
                            <Chip
                              label={Math.round(r.average * 10) / 10}
                              size="small"
                              color={r.average >= 70 ? 'success' : r.average >= 50 ? 'warning' : 'error'}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
