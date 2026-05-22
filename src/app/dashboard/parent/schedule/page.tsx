'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box, Typography, Button, Paper, CircularProgress, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip
} from '@mui/material';
import { ArrowBack, Schedule } from '@mui/icons-material';

const dayLabels: Record<string, string> = {
  sunday: 'الأحد', monday: 'الاثنين', tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء', thursday: 'الخميس',
};

const daysOrder = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];

const subjectColors = [
  '#1976d2', '#2e7d32', '#ed6c02', '#7c4dff', '#00838f',
  '#d32f2f', '#4a148c', '#e65100', '#558b2f', '#283593',
];

const getSubjectColor = (_subject: string, index: number) => {
  const colors = subjectColors;
  return colors[index % colors.length];
};

export default function ParentSchedulePage() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get('student_id');
  const [schedules, setSchedules] = useState<any[]>([]);
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
    const fetchSchedule = async () => {
      try {
        const res = await api.get(`/parent/students/${studentId}/schedule`, token);
        setSchedules(res.schedules || []);
        setStudentName(res.student_name || '');
      } catch {
        setError('فشل في جلب الجدول الدراسي');
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, [token, studentId, router]);

  if (!studentId) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Schedule sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">يرجى اختيار طالب لعرض الجدول</Typography>
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

  const allSubjects = [...new Set(schedules.map((s: any) => s.subject))];
  const subjectMap: Record<string, number> = {};
  allSubjects.forEach((sub, idx) => { subjectMap[sub as string] = idx; });

  const timeSlots = [...new Set(schedules.map((s: any) => `${s.start_time}-${s.end_time}`))].sort();

  const getCell = (day: string, timeSlot: string) => {
    const [start, end] = timeSlot.split('-');
    const entry = schedules.find(
      (s: any) => s.day_of_week === day && s.start_time === start && s.end_time === end
    );
    return entry;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => router.push('/dashboard/parent')}>العودة</Button>
        <Box>
          <Typography variant="h5" fontWeight="bold">الجدول الدراسي</Typography>
          {studentName && <Typography variant="body2" color="text.secondary">الطالب: {studentName}</Typography>}
        </Box>
      </Box>

      {schedules.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <Schedule sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">لا يوجد جدول دراسي لهذا الطالب</Typography>
        </Paper>
      ) : (
        <Paper sx={{ overflow: 'auto', borderRadius: 3 }}>
          <TableContainer>
            <Table dir="rtl" sx={{ minWidth: 700 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>الوقت</TableCell>
                  {daysOrder.map((day) => (
                    <TableCell key={day} sx={{ fontWeight: 700, textAlign: 'center' }}>{dayLabels[day]}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {timeSlots.map((timeSlot) => (
                  <TableRow key={timeSlot}>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600, color: 'text.secondary' }}>
                      {timeSlot.replace('-', ' - ')}
                    </TableCell>
                    {daysOrder.map((day) => {
                      const cell = getCell(day, timeSlot);
                      if (!cell) {
                        return (
                          <TableCell key={day} sx={{ textAlign: 'center', bgcolor: 'grey.50' }}>
                            <Typography variant="caption" color="text.disabled">-</Typography>
                          </TableCell>
                        );
                      }
                      const colorIdx = subjectMap[cell.subject] || 0;
                      const color = getSubjectColor(cell.subject, colorIdx);
                      return (
                        <TableCell key={day} sx={{ textAlign: 'center', p: 1 }}>
                          <Chip
                            label={cell.subject}
                            sx={{
                              bgcolor: `${color}15`,
                              color: color,
                              fontWeight: 600,
                              width: '100%',
                              maxWidth: 140,
                              borderRadius: 2,
                              border: `1px solid ${color}40`,
                            }}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {allSubjects.length > 0 && (
        <Paper sx={{ p: 2, mt: 2, borderRadius: 3 }}>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>المواد الدراسية</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {allSubjects.map((sub, _idx) => (
              <Chip
                key={sub}
                label={sub}
                size="small"
                sx={{
                  bgcolor: `${getSubjectColor(sub, subjectMap[sub])}15`,
                  color: getSubjectColor(sub, subjectMap[sub]),
                  fontWeight: 600,
                }}
              />
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  );
}
