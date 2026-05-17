'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Chip, Alert, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Grid, IconButton
} from '@mui/material';
import { Add, Edit, Delete, FileDownload, PlaylistAdd, Save } from '@mui/icons-material';
import { exportToExcel } from '@/lib/excel';
import { hasPermission } from '@/lib/permissions';

const assessmentLabels: Record<string, string> = {
  test: 'اختبار', quiz: 'كويز', assignment: 'واجب', midterm: 'نصفي', final: 'نهائي',
};

export default function GradesPage() {
  const { user, token, selectedSchool } = useAuth();
  const schoolParam = selectedSchool && selectedSchool !== 'all' ? `&school=${selectedSchool}` : '';
  const [grades, setGrades] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState({ student_id: '', class_id: '', subject: '' });
  const [formData, setFormData] = useState({
    student_id: '', class_id: '', subject: '', assessment_type: 'test',
    score: '', total_score: '100', assessment_date: new Date().toISOString().split('T')[0], remarks: '',
  });
  const [editForm, setEditForm] = useState({ score: '', total_score: '', assessment_type: '', remarks: '', assessment_date: '' });

  const [bulkDialog, setBulkDialog] = useState(false);
  const [bulkForm, setBulkForm] = useState({ class_id: '', subject: '', assessment_type: 'test', total_score: '100', assessment_date: new Date().toISOString().split('T')[0] });
  const [bulkStudents, setBulkStudents] = useState<any[]>([]);
  const [bulkScores, setBulkScores] = useState<Record<number, string>>({});
  const [bulkSaving, setBulkSaving] = useState(false);

  const canCreateGrade = hasPermission(user?.role, 'grades:create');
  const canEditGrade = hasPermission(user?.role, 'grades:edit');
  const canDeleteGrade = hasPermission(user?.role, 'grades:delete');

  const fetchGrades = async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (filters.student_id) params.set('student_id', filters.student_id);
      if (filters.class_id) params.set('class_id', filters.class_id);
      if (filters.subject) params.set('subject', filters.subject);
      const res = await api.get(`/grades?${params.toString()}${schoolParam}`, token);
      setGrades(res.grades || []);
    } catch {
      setError('فشل في جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    if (!token) return;
    try {
      const res = await api.get(`/students?page=1&limit=100${schoolParam}`, token);
      setStudents(res.students || []);
    } catch {
      console.error('Failed to fetch students');
    }
  };

  const fetchClasses = async () => {
    if (!token) return;
    try {
      const res = await api.get(`/classes?page=1&limit=100${schoolParam}`, token);
      setClasses(res.classes || []);
    } catch {
      console.error('Failed to fetch classes');
    }
  };

  useEffect(() => { fetchGrades(); fetchStudents(); fetchClasses(); }, [token, filters.student_id, filters.class_id, filters.subject]);

  const handleSubmit = async () => {
    if (!token) return;
    setError('');
    setSuccess('');

    try {
      await api.post('/grades', {
        student_id: parseInt(formData.student_id),
        class_id: parseInt(formData.class_id),
        subject: formData.subject,
        assessment_type: formData.assessment_type,
        score: parseFloat(formData.score),
        total_score: parseFloat(formData.total_score),
        assessment_date: formData.assessment_date || null,
        remarks: formData.remarks || null,
      }, token);
      setSuccess('تم تسجيل الدرجة بنجاح');
      setOpenDialog(false);
      fetchGrades();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    }
  };

  const handleEditOpen = (g: any) => {
    setEditingRecord(g);
    setEditForm({
      score: g.score.toString(),
      total_score: g.total_score.toString(),
      assessment_type: g.assessment_type,
      remarks: g.remarks || '',
      assessment_date: g.assessment_date || '',
    });
    setEditDialog(true);
  };

  const handleEditSubmit = async () => {
    if (!token || !editingRecord) return;
    try {
      await api.put(`/grades/${editingRecord.id}`, {
        score: parseFloat(editForm.score),
        total_score: parseFloat(editForm.total_score),
        assessment_type: editForm.assessment_type,
        remarks: editForm.remarks || null,
        assessment_date: editForm.assessment_date || null,
      }, token);
      setSuccess('تم تحديث الدرجة');
      setEditDialog(false);
      fetchGrades();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    try {
      await api.delete(`/grades/${id}`, token);
      setSuccess('تم حذف الدرجة');
      setDeleteConfirm(null);
      fetchGrades();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    }
  };

  const handleExport = async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (filters.class_id) params.set('class_id', filters.class_id);
      if (filters.student_id) params.set('student_id', filters.student_id);
      if (filters.subject) params.set('subject', filters.subject);
      params.set('limit', '5000');
      const res = await api.get(`/grades?${params.toString()}${schoolParam}`, token);
      const rows = (res.grades || []).map((g: any) => [
        `${g.student_first || ''} ${g.student_last || ''}`.trim() || `طالب #${g.student_id}`,
        g.class_name || `فصل #${g.class_id}`,
        g.subject,
        assessmentLabels[g.assessment_type] || g.assessment_type,
        `${g.score} / ${g.total_score}`,
        `${Math.round((g.score / g.total_score) * 100)}%`,
        g.assessment_date || '',
        g.remarks || '',
      ]);
      exportToExcel(['الطالب','الفصل','المادة','نوع التقييم','الدرجة','النسبة','التاريخ','ملاحظات'], rows, 'الدرجات', 'grades_صفوة_الرواد.xlsx');
      setSuccess('تم تصدير البيانات بنجاح');
    } catch {
      setError('فشل في تصدير البيانات');
    }
  };

  const handleBulkOpen = async () => {
    setBulkForm({ class_id: '', subject: '', assessment_type: 'test', total_score: '100', assessment_date: new Date().toISOString().split('T')[0] });
    setBulkStudents([]);
    setBulkScores({});
    setBulkDialog(true);
    setError('');
    setSuccess('');
  };

  const handleBulkClassChange = async (classId: string) => {
    setBulkForm({ ...bulkForm, class_id: classId });
    if (!classId || !token) return;
    try {
      const res = await api.get(`/classes/${classId}`, token);
      const students = res.students || [];
      setBulkStudents(students);
      setBulkScores({});
    } catch {
      setError('فشل في جلب طلاب الفصل');
      setBulkStudents([]);
    }
  };

  const handleBulkSave = async () => {
    if (!token || !bulkForm.class_id || !bulkForm.subject) {
      setError('يرجى اختيار الفصل والمادة');
      return;
    }
    setBulkSaving(true);
    setError('');
    setSuccess('');
    let successCount = 0;
    let failCount = 0;
    let lastError = '';
    for (const student of bulkStudents) {
      const scoreStr = bulkScores[student.id];
      if (!scoreStr || scoreStr.trim() === '') continue;
      const score = parseFloat(scoreStr);
      if (isNaN(score)) continue;
      try {
        await api.post('/grades', {
          student_id: student.id,
          class_id: parseInt(bulkForm.class_id),
          subject: bulkForm.subject,
          assessment_type: bulkForm.assessment_type,
          score,
          total_score: parseFloat(bulkForm.total_score),
          assessment_date: bulkForm.assessment_date || null,
        }, token);
        successCount++;
      } catch (err: any) {
        lastError = err?.message || lastError;
        failCount++;
      }
    }
    setBulkSaving(false);
    if (successCount > 0 || failCount > 0) {
      setSuccess(`تم تسجيل ${successCount} درجة${failCount > 0 ? `، فشل ${failCount} (${lastError})` : ''}`);
    }
    setBulkDialog(false);
    fetchGrades();
  };

  const getPercentage = (score: number, total: number) => {
    const pct = (score / total) * 100;
    return pct >= 90 ? 'success' : pct >= 75 ? 'info' : pct >= 50 ? 'warning' : 'error';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">الدرجات والنتائج</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<FileDownload />} onClick={handleExport}>تصدير Excel</Button>
          {canCreateGrade && (
            <>
              <Button variant="contained" startIcon={<PlaylistAdd />} color="secondary" onClick={handleBulkOpen} sx={{ ml: 1 }}>كشف درجات</Button>
              <Button variant="contained" startIcon={<Add />} onClick={() => { setOpenDialog(true); setError(''); setSuccess(''); }}>تسجيل درجة</Button>
            </>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}><FormControl fullWidth><InputLabel>الفصل</InputLabel><Select value={filters.class_id} label="الفصل" onChange={(e) => setFilters({ ...filters, class_id: e.target.value })}><MenuItem value="">الكل</MenuItem>{classes.map((c) => <MenuItem key={c.id} value={c.id}>{c.class_name}</MenuItem>)}</Select></FormControl></Grid>
          <Grid item xs={12} sm={4}><FormControl fullWidth><InputLabel>الطالب</InputLabel><Select value={filters.student_id} label="الطالب" onChange={(e) => setFilters({ ...filters, student_id: e.target.value })}><MenuItem value="">الكل</MenuItem>{students.map((s) => <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</MenuItem>)}</Select></FormControl></Grid>
          <Grid item xs={12} sm={4}><TextField fullWidth label="المادة" value={filters.subject} onChange={(e) => setFilters({ ...filters, subject: e.target.value })} /></Grid>
        </Grid>
      </Paper>

      <Paper sx={{ overflow: 'auto' }}>
        <TableContainer>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell>الطالب</TableCell>
                <TableCell>الفصل</TableCell>
                <TableCell>المادة</TableCell>
                <TableCell>نوع التقييم</TableCell>
                <TableCell>الدرجة</TableCell>
                <TableCell>النسبة</TableCell>
                <TableCell>التاريخ</TableCell>
                {(canEditGrade || canDeleteGrade) && <TableCell>الإجراءات</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={(canEditGrade || canDeleteGrade) ? 8 : 7} align="center"><CircularProgress /></TableCell></TableRow>
              ) : grades.length === 0 ? (
                <TableRow><TableCell colSpan={(canEditGrade || canDeleteGrade) ? 8 : 7} align="center">لا توجد درجات</TableCell></TableRow>
              ) : (
                grades.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>{g.student_first ? `${g.student_first} ${g.student_last}` : `طالب #${g.student_id}`}</TableCell>
                    <TableCell>{g.class_name || `فصل #${g.class_id}`}</TableCell>
                    <TableCell>{g.subject}</TableCell>
                    <TableCell>
                      <Chip label={assessmentLabels[g.assessment_type] || g.assessment_type} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{g.score} / {g.total_score}</TableCell>
                    <TableCell>
                      <Chip label={`${Math.round((g.score / g.total_score) * 100)}%`} color={getPercentage(g.score, g.total_score) as any} size="small" />
                    </TableCell>
                    <TableCell>{g.assessment_date || '-'}</TableCell>
                    {(canEditGrade || canDeleteGrade) && (
                      <TableCell>
                        {canEditGrade && <IconButton size="small" onClick={() => handleEditOpen(g)}><Edit fontSize="small" /></IconButton>}
                        {canDeleteGrade && <IconButton size="small" color="error" onClick={() => setDeleteConfirm(g.id)}><Delete fontSize="small" /></IconButton>}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>تسجيل درجة جديدة</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><FormControl fullWidth><InputLabel>الطالب</InputLabel><Select value={formData.student_id} label="الطالب" onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}>{students.map((s) => <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</MenuItem>)}</Select></FormControl></Grid>
            <Grid item xs={12}><FormControl fullWidth><InputLabel>الفصل</InputLabel><Select value={formData.class_id} label="الفصل" onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}>{classes.map((c) => <MenuItem key={c.id} value={c.id}>{c.class_name}</MenuItem>)}</Select></FormControl></Grid>
            <Grid item xs={12}><TextField fullWidth label="المادة" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} /></Grid>
            <Grid item xs={12}><FormControl fullWidth><InputLabel>نوع التقييم</InputLabel><Select value={formData.assessment_type} label="نوع التقييم" onChange={(e) => setFormData({ ...formData, assessment_type: e.target.value })}>{Object.entries(assessmentLabels).map(([val, label]) => (<MenuItem key={val} value={val}>{label}</MenuItem>))}</Select></FormControl></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="الدرجة" type="number" value={formData.score} onChange={(e) => setFormData({ ...formData, score: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="الدرجة الكاملة" type="number" value={formData.total_score} onChange={(e) => setFormData({ ...formData, total_score: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="التاريخ" type="date" value={formData.assessment_date} onChange={(e) => setFormData({ ...formData, assessment_date: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="ملاحظات" value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleSubmit}>تسجيل</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkDialog} onClose={() => !bulkSaving && setBulkDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PlaylistAdd color="secondary" />
            كشف درجات جديد
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5, mb: 2 }}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>الفصل</InputLabel>
                <Select value={bulkForm.class_id} label="الفصل" onChange={(e) => handleBulkClassChange(e.target.value)}>
                  <MenuItem value="">-- اختر الفصل --</MenuItem>
                  {classes.map((c) => <MenuItem key={c.id} value={c.id}>{c.class_name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="المادة" value={bulkForm.subject} onChange={(e) => setBulkForm({ ...bulkForm, subject: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>نوع التقييم</InputLabel>
                <Select value={bulkForm.assessment_type} label="نوع التقييم" onChange={(e) => setBulkForm({ ...bulkForm, assessment_type: e.target.value })}>
                  {Object.entries(assessmentLabels).map(([val, label]) => (<MenuItem key={val} value={val}>{label}</MenuItem>))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="الدرجة الكاملة" type="number" value={bulkForm.total_score} onChange={(e) => setBulkForm({ ...bulkForm, total_score: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="التاريخ" type="date" value={bulkForm.assessment_date} onChange={(e) => setBulkForm({ ...bulkForm, assessment_date: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
          </Grid>

          {bulkForm.class_id && (
            <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>الطالب</TableCell>
                    <TableCell sx={{ minWidth: 120 }}>الدرجة (من {bulkForm.total_score})</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bulkStudents.length === 0 ? (
                    <TableRow><TableCell colSpan={3} align="center">لا يوجد طلاب في هذا الفصل</TableCell></TableRow>
                  ) : (
                    bulkStudents.map((s, idx) => (
                      <TableRow key={s.id}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>{s.first_name} {s.last_name}</TableCell>
                        <TableCell>
                          <TextField
                            size="small" type="number" placeholder="الدرجة"
                            value={bulkScores[s.id] || ''}
                            onChange={(e) => setBulkScores({ ...bulkScores, [s.id]: e.target.value })}
                            inputProps={{ min: 0, max: parseFloat(bulkForm.total_score), step: 0.5 }}
                            sx={{ width: 120 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setBulkDialog(false)} disabled={bulkSaving}>إلغاء</Button>
          <Button variant="contained" color="secondary" startIcon={<Save />} onClick={handleBulkSave} disabled={bulkSaving || bulkStudents.length === 0}>
            {bulkSaving ? 'جاري الحفظ...' : 'حفظ الكل'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>تعديل الدرجة</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}><TextField fullWidth label="الدرجة" type="number" value={editForm.score} onChange={(e) => setEditForm({ ...editForm, score: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="الدرجة الكاملة" type="number" value={editForm.total_score} onChange={(e) => setEditForm({ ...editForm, total_score: e.target.value })} /></Grid>
            <Grid item xs={12}><FormControl fullWidth><InputLabel>نوع التقييم</InputLabel><Select value={editForm.assessment_type} label="نوع التقييم" onChange={(e) => setEditForm({ ...editForm, assessment_type: e.target.value })}>{Object.entries(assessmentLabels).map(([val, label]) => (<MenuItem key={val} value={val}>{label}</MenuItem>))}</Select></FormControl></Grid>
            <Grid item xs={12}><TextField fullWidth label="التاريخ" type="date" value={editForm.assessment_date} onChange={(e) => setEditForm({ ...editForm, assessment_date: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="ملاحظات" value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleEditSubmit}>تحديث</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>تأكيد الحذف</DialogTitle>
        <DialogContent>هل أنت متأكد من حذف هذا السجل؟</DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
          <Button color="error" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>حذف</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
