'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, CircularProgress
} from '@mui/material';
import { ArrowBack, Grade } from '@mui/icons-material';

const assessmentLabels: Record<string, string> = {
  test: 'اختبار', quiz: 'كويز', assignment: 'واجب', midterm: 'نصفي', final: 'نهائي',
};

export default function ParentGradesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get('student_id');
  const [grades, setGrades] = useState<any[]>([]);
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
    const fetchGrades = async () => {
      try {
        const res = await api.get(`/parent/students/${studentId}/grades`, token);
        setGrades(res.grades || []);
        setStudentName(res.student_name || '');
      } catch {
        setError('فشل في جلب الدرجات');
      } finally {
        setLoading(false);
      }
    };
    fetchGrades();
  }, [token, studentId, router]);

  if (!studentId) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Grade sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">يرجى اختيار طالب لعرض الدرجات</Typography>
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

  const getPercentageColor = (score: number, total: number) => {
    const pct = (score / total) * 100;
    if (pct >= 90) return 'success';
    if (pct >= 75) return 'info';
    if (pct >= 50) return 'warning';
    return 'error';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => router.push('/dashboard/parent')}>العودة</Button>
        <Box>
          <Typography variant="h5" fontWeight="bold">الدرجات</Typography>
          {studentName && <Typography variant="body2" color="text.secondary">الطالب: {studentName}</Typography>}
        </Box>
      </Box>

      {grades.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <Grade sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">لا توجد درجات مسجلة لهذا الطالب</Typography>
        </Paper>
      ) : (
        <Paper sx={{ overflow: 'auto', borderRadius: 3 }}>
          <TableContainer>
            <Table dir="rtl">
              <TableHead>
                <TableRow>
                  <TableCell>المادة</TableCell>
                  <TableCell>نوع التقييم</TableCell>
                  <TableCell>الدرجة</TableCell>
                  <TableCell>التاريخ</TableCell>
                  <TableCell>ملاحظات</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {grades.map((g: any) => (
                  <TableRow key={g.id}>
                    <TableCell sx={{ fontWeight: 600 }}>{g.subject}</TableCell>
                    <TableCell>
                      <Chip label={assessmentLabels[g.assessment_type] || g.assessment_type} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography fontWeight="bold">{g.score} / {g.total_score}</Typography>
                        <Chip
                          label={`${Math.round((g.score / g.total_score) * 100)}%`}
                          color={getPercentageColor(g.score, g.total_score) as any}
                          size="small"
                        />
                      </Box>
                    </TableCell>
                    <TableCell>{g.assessment_date || '-'}</TableCell>
                    <TableCell>{g.remarks || '-'}</TableCell>
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
