'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, Grid, Card, CardContent, Avatar, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress,
  Button, IconButton
} from '@mui/material';
import {
  People, School, Class as ClassIcon, Assessment, TrendingUp,
  AdminPanelSettings, CheckCircle, Cancel, CalendarMonth
} from '@mui/icons-material';

const roleLabels: Record<string, string> = {
  middle_principal: 'مدير المدرسة - المتوسطة',
  high_principal: 'مدير المدرسة - الثانوية',
};

export default function PrincipalPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    if (!user.role.includes('principal')) { router.push('/dashboard'); return; }
  }, [user, router]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.get('/dashboard/stats', token),
      api.get('/leaves?status=pending', token),
    ]).then(([s, l]: any[]) => {
      setStats(s.stats || s);
      setPendingLeaves(l.leaves || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  const approveLeave = async (id: number) => {
    try { await api.put(`/leaves/${id}`, { status: 'approved' }, token); setPendingLeaves(prev => prev.filter((l: any) => l.id !== id)); } catch {}
  };

  const rejectLeave = async (id: number) => {
    try { await api.put(`/leaves/${id}`, { status: 'rejected' }, token); setPendingLeaves(prev => prev.filter((l: any) => l.id !== id)); } catch {}
  };

  if (!user || loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><CircularProgress size={60} /></Box>;

  const isHigh = user.role === 'high_principal';
  const primaryColor = isHigh ? '#880e4f' : '#4a148c';

  const statCards = [
    { label: 'المعلمون', value: stats?.teachers || 0, icon: <People />, color: '#1565c0' },
    { label: 'الطلاب', value: stats?.students || 0, icon: <School />, color: '#2e7d32' },
    { label: 'الفصول', value: stats?.classes || 0, icon: <ClassIcon />, color: '#e65100' },
    { label: 'نسبة الحضور', value: stats?.attendanceRate ? `${Math.round(stats.attendanceRate)}%` : '—', icon: <Assessment />, color: '#6a1b9a' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Avatar sx={{ bgcolor: primaryColor, width: 48, height: 48 }}><AdminPanelSettings /></Avatar>
        <Box>
          <Typography variant="h4" fontWeight="bold">شؤون المدرسة</Typography>
          <Typography variant="body2" color="text.secondary">
            {roleLabels[user.role]}
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
        <Grid item xs={12} md={7}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CalendarMonth color="warning" />
                <Typography variant="h6" fontWeight="bold">طلبات الإجازات قيد الانتظار</Typography>
                {pendingLeaves.length > 0 && <Chip label={pendingLeaves.length} size="small" color="warning" />}
              </Box>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>المستخدم</TableCell>
                      <TableCell>النوع</TableCell>
                      <TableCell>من</TableCell>
                      <TableCell>إلى</TableCell>
                      <TableCell>السبب</TableCell>
                      <TableCell>إجراءات</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingLeaves.length === 0 ? (
                      <TableRow><TableCell colSpan={6} align="center">لا توجد طلبات معلقة</TableCell></TableRow>
                    ) : pendingLeaves.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.user_email || '—'}</TableCell>
                        <TableCell><Chip label={l.leave_type} size="small" /></TableCell>
                        <TableCell>{l.start_date}</TableCell>
                        <TableCell>{l.end_date}</TableCell>
                        <TableCell>{l.reason || '—'}</TableCell>
                        <TableCell>
                          <IconButton size="small" color="success" onClick={() => approveLeave(l.id)}><CheckCircle /></IconButton>
                          <IconButton size="small" color="error" onClick={() => rejectLeave(l.id)}><Cancel /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Button sx={{ mt: 1 }} size="small" onClick={() => router.push('/dashboard/leaves')}>عرض جميع الإجازات</Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <TrendingUp color="primary" />
                <Typography variant="h6" fontWeight="bold">نظرة سريعة</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box><Typography variant="body2" fontWeight="bold">المعلمون</Typography><Typography variant="h5" fontWeight="bold" color="primary">{stats?.teachers || 0}</Typography></Box>
                  <People sx={{ fontSize: 36, opacity: 0.2 }} />
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box><Typography variant="body2" fontWeight="bold">الطلاب</Typography><Typography variant="h5" fontWeight="bold" color="success.main">{stats?.students || 0}</Typography></Box>
                  <School sx={{ fontSize: 36, opacity: 0.2 }} />
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box><Typography variant="body2" fontWeight="bold">الفصول</Typography><Typography variant="h5" fontWeight="bold" color="warning.main">{stats?.classes || 0}</Typography></Box>
                  <ClassIcon sx={{ fontSize: 36, opacity: 0.2 }} />
                </Paper>
              </Box>
              <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button variant="outlined" size="small" onClick={() => router.push('/dashboard/schedules')}>الجدول</Button>
                <Button variant="outlined" size="small" onClick={() => router.push('/dashboard/attendance')}>الحضور</Button>
                <Button variant="outlined" size="small" onClick={() => router.push('/dashboard/grades')}>الدرجات</Button>
                <Button variant="outlined" size="small" onClick={() => router.push('/dashboard/reports')}>التقارير</Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
