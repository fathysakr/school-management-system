'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, CircularProgress, Grid
} from '@mui/material';
import { ArrowBack, EventNote } from '@mui/icons-material';

const statusLabels: Record<string, string> = {
  present: 'حاضر', absent: 'غائب', late: 'متأخر', excused: 'معذر', escape: 'هروب',
};

const statusColors: Record<string, string> = {
  present: '#2e7d32', absent: '#d32f2f', late: '#ed6c02', excused: '#0288d1', escape: '#d32f2f',
};

export default function ParentAttendancePage() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get('student_id');
  const [records, setRecords] = useState<any[]>([]);
  const [studentName, setStudentName] = useState('');
  const [summary, setSummary] = useState({ present: 0, absent: 0, late: 0, excused: 0 });
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
    const fetchAttendance = async () => {
      try {
        const res = await api.get(`/parent/students/${studentId}/attendance`, token);
        const attRecords = res.attendance || [];
        setRecords(attRecords);
        setStudentName(res.student_name || '');
        setSummary({
          present: attRecords.filter((r: any) => r.status === 'present').length,
          absent: attRecords.filter((r: any) => r.status === 'absent').length,
          late: attRecords.filter((r: any) => r.status === 'late').length,
          excused: attRecords.filter((r: any) => r.status === 'excused').length,
        });
      } catch {
        setError('فشل في جلب بيانات الحضور');
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, [token, studentId, router]);

  if (!studentId) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <EventNote sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">يرجى اختيار طالب لعرض الحضور</Typography>
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
          <Typography variant="h5" fontWeight="bold">سجل الحضور</Typography>
          {studentName && <Typography variant="body2" color="text.secondary">الطالب: {studentName}</Typography>}
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={3}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: 'center', borderTop: '3px solid #2e7d32' }}>
            <Typography variant="h5" fontWeight="bold" sx={{ color: '#2e7d32' }}>{summary.present}</Typography>
            <Typography variant="caption" color="text.secondary">إجمالي أيام الحضور</Typography>
          </Paper>
        </Grid>
        <Grid item xs={3}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: 'center', borderTop: '3px solid #d32f2f' }}>
            <Typography variant="h5" fontWeight="bold" sx={{ color: '#d32f2f' }}>{summary.absent}</Typography>
            <Typography variant="caption" color="text.secondary">الغياب</Typography>
          </Paper>
        </Grid>
        <Grid item xs={3}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: 'center', borderTop: '3px solid #ed6c02' }}>
            <Typography variant="h5" fontWeight="bold" sx={{ color: '#ed6c02' }}>{summary.late}</Typography>
            <Typography variant="caption" color="text.secondary">التأخر</Typography>
          </Paper>
        </Grid>
        <Grid item xs={3}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: 'center', borderTop: '3px solid #0288d1' }}>
            <Typography variant="h5" fontWeight="bold" sx={{ color: '#0288d1' }}>{summary.excused}</Typography>
            <Typography variant="caption" color="text.secondary">معذر</Typography>
          </Paper>
        </Grid>
      </Grid>

      {records.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <EventNote sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">لا توجد سجلات حضور لهذا الطالب</Typography>
        </Paper>
      ) : (
        <Paper sx={{ overflow: 'auto', borderRadius: 3 }}>
          <TableContainer>
            <Table dir="rtl">
              <TableHead>
                <TableRow>
                  <TableCell>التاريخ</TableCell>
                  <TableCell>الحالة</TableCell>
                  <TableCell>ملاحظات</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.attendance_date}</TableCell>
                    <TableCell>
                      <Chip
                        label={statusLabels[r.status] || r.status}
                        sx={{
                          fontWeight: 600,
                          color: '#fff',
                          bgcolor: statusColors[r.status] || 'grey.500',
                        }}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{r.remarks || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}
