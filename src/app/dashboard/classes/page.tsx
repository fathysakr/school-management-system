'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton, Chip, Alert, CircularProgress,
  TablePagination, Select, MenuItem, InputLabel, FormControl, Grid
} from '@mui/material';
import { Add, Edit, Delete, People, Close, FileDownload } from '@mui/icons-material';
import { exportToExcel } from '@/lib/excel';
import { hasPermission } from '@/lib/permissions';
import EmptyState from '@/components/empty-state';

export default function ClassesPage() {
  const { user, token, selectedSchool } = useAuth();
  const schoolParam = selectedSchool && selectedSchool !== 'all' ? `&school=${selectedSchool}` : '';
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [enrollDialog, setEnrollDialog] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [classStudents, setClassStudents] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({ class_name: '', grade: '', section: '', teacher_id: '', room_number: '', capacity: '30' });
  const [enrollData, setEnrollData] = useState({ student_id: '' });
  const [isEdit, setIsEdit] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const fetchClasses = async () => {
    if (!token) return;
    try {
      const res = await api.get(`/classes?page=${page + 1}&limit=${rowsPerPage}${schoolParam}`, token);
      setClasses(res.classes || []);
      setTotal(res.pagination?.total || 0);
    } catch {
      setError('فشل في جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    if (!token) return;
    try {
      const res = await api.get(`/teachers?page=1&limit=100${schoolParam}`, token);
      setTeachers(res.teachers || []);
    } catch {}
  };

  useEffect(() => { fetchClasses(); fetchTeachers(); }, [token, page, rowsPerPage]);

  const fetchStudents = async () => {
    if (!token) return;
    try {
      const res = await api.get(`/students?page=1&limit=500${schoolParam}`, token);
      setStudents(res.students || []);
    } catch {}
  };

  const handleOpenDialog = (cls?: any) => {
    if (cls) {
      setIsEdit(true);
      setSelectedClass(cls);
      setFormData({ class_name: cls.class_name, grade: cls.grade, section: cls.section || '', teacher_id: cls.teacher_id.toString(), room_number: cls.room_number || '', capacity: cls.capacity?.toString() || '30' });
    } else {
      setIsEdit(false);
      setFormData({ class_name: '', grade: '', section: '', teacher_id: '', room_number: '', capacity: '30' });
    }
    setOpenDialog(true);
    setError('');
  };

  const handleSubmit = async () => {
    if (!token) return;
    setError('');
    setSuccess('');

    try {
      if (isEdit && selectedClass) {
        await api.put(`/classes/${selectedClass.id}`, formData, token);
        setSuccess('تم تحديث الفصل بنجاح');
      } else {
        await api.post('/classes', { ...formData, teacher_id: parseInt(formData.teacher_id), capacity: parseInt(formData.capacity) }, token);
        setSuccess('تم إنشاء الفصل بنجاح');
      }
      setOpenDialog(false);
      fetchClasses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    setDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    if (!token || deleteConfirm === null) return;
    try {
      await api.delete(`/classes/${deleteConfirm}`, token);
      setSuccess('تم حذف الفصل');
      setDeleteConfirm(null);
      fetchClasses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
      setDeleteConfirm(null);
    }
  };

  const handleOpenEnroll = async (cls: any) => {
    setSelectedClass(cls);
    setEnrollData({ student_id: '' });
    try {
      const [classRes] = await Promise.all([
        api.get(`/classes/${cls.id}`, token),
        fetchStudents(),
      ]);
      setClassStudents(classRes.students || []);
    } catch {
      setClassStudents([]);
    }
    setEnrollDialog(true);
  };

  const handleEnroll = async () => {
    if (!token || !enrollData.student_id) return;
    setError('');
    setSuccess('');

    try {
      await api.post('/classes/enrollment', { student_id: parseInt(enrollData.student_id), class_id: selectedClass.id }, token);
      setSuccess('تم تسجيل الطالب بنجاح');
      setEnrollData({ student_id: '' });
      const res = await api.get(`/classes/${selectedClass.id}`, token);
      setClassStudents(res.students || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    }
  };

  const handleExport = async () => {
    if (!token) return;
    try {
      const res = await api.get(`/classes?page=1&limit=500&status=all${schoolParam}`, token);
      const rows = (res.classes || []).map((c: any) => [
        c.class_name,
        c.grade,
        c.section || '',
        c.teacher_name || '',
        c.room_number || '',
        c.capacity || '',
        c.student_count || 0,
        c.status === 'active' ? 'نشط' : 'غير نشط',
      ]);
      exportToExcel(['اسم الفصل','المرحلة','القسم','المعلم','القاعة','السعة','عدد الطلاب','الحالة'], rows, 'الفصول', 'classes_صفوة_الرواد.xlsx');
      setSuccess('تم تصدير البيانات بنجاح');
    } catch {
      setError('فشل في تصدير البيانات');
    }
  };

  const handleUnenroll = async (studentId: number) => {
    if (!token || !selectedClass) return;
    try {
      await api.delete(`/classes/enrollment?student_id=${studentId}&class_id=${selectedClass.id}`, token);
      setSuccess('تم إلغاء تسجيل الطالب');
      const res = await api.get(`/classes/${selectedClass.id}`, token);
      setClassStudents(res.students || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">إدارة الفصول</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<FileDownload />} onClick={handleExport}>تصدير Excel</Button>
          {hasPermission(user?.role, 'classes:create') && (
            <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()}>إنشاء فصل</Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}<IconButton size="small" onClick={() => setError('')}><Close fontSize="small" /></IconButton></Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}<IconButton size="small" onClick={() => setSuccess('')}><Close fontSize="small" /></IconButton></Alert>}

      <Paper sx={{ overflow: 'auto' }}>
        <TableContainer>
          <Table sx={{ minWidth: 700 }} dir="rtl">
            <TableHead>
              <TableRow>
                <TableCell>اسم الفصل</TableCell>
                <TableCell>المرحلة</TableCell>
                <TableCell>القسم</TableCell>
                <TableCell>المعلم</TableCell>
                <TableCell>القاعة</TableCell>
                <TableCell>السعة</TableCell>
                <TableCell>الطلاب</TableCell>
                <TableCell>الحالة</TableCell>
                <TableCell>الإجراءات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} align="center"><CircularProgress /></TableCell></TableRow>
              ) : classes.length === 0 ? (
                <TableRow><TableCell colSpan={9} align="center"><EmptyState message="لا يوجد فصول" /></TableCell></TableRow>
              ) : (
                classes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.class_name}</TableCell>
                    <TableCell>{c.grade}</TableCell>
                    <TableCell>{c.section || '-'}</TableCell>
                    <TableCell>{c.teacher_name || '-'}</TableCell>
                    <TableCell>{c.room_number || '-'}</TableCell>
                    <TableCell>{c.capacity}</TableCell>
                    <TableCell>{c.student_count || 0}</TableCell>
                    <TableCell>
                      <Chip label={c.status === 'active' ? 'نشط' : 'غير نشط'}
                        color={c.status === 'active' ? 'success' : 'default'} size="small" />
                    </TableCell>
                    <TableCell>
                      {hasPermission(user?.role, 'classes:edit') && (
                        <IconButton size="small" onClick={() => handleOpenEnroll(c)} title="إدارة الطلاب"><People /></IconButton>
                      )}
                      {hasPermission(user?.role, 'classes:edit') && (
                        <IconButton size="small" onClick={() => handleOpenDialog(c)}><Edit /></IconButton>
                      )}
                      {hasPermission(user?.role, 'classes:delete') && (
                        <IconButton size="small" color="error" onClick={() => handleDelete(c.id)}><Delete /></IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
          labelRowsPerPage="عدد الصفوف"
        />
      </Paper>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{isEdit ? 'تعديل الفصل' : 'إنشاء فصل جديد'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}><TextField fullWidth label="اسم الفصل" value={formData.class_name} onChange={(e) => setFormData({ ...formData, class_name: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><FormControl fullWidth><InputLabel>المرحلة</InputLabel><Select value={formData.grade} label="المرحلة" onChange={(e) => setFormData({ ...formData, grade: e.target.value })}><MenuItem value="المتوسطة">المدرسة المتوسطة</MenuItem><MenuItem value="الثانوية">المدرسة الثانوية</MenuItem></Select></FormControl></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="القسم" value={formData.section} onChange={(e) => setFormData({ ...formData, section: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="رقم القاعة" value={formData.room_number} onChange={(e) => setFormData({ ...formData, room_number: e.target.value })} /></Grid>
            <Grid item xs={12}><FormControl fullWidth><InputLabel>المعلم</InputLabel><Select value={formData.teacher_id} label="المعلم" onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}>{teachers.map((t) => (<MenuItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</MenuItem>))}</Select></FormControl></Grid>
            <Grid item xs={12}><TextField fullWidth label="السعة" type="number" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleSubmit}>{isEdit ? 'تحديث' : 'إنشاء'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={enrollDialog} onClose={() => setEnrollDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>إدارة طلاب الفصل: {selectedClass?.class_name}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, mb: 3, mt: 1, flexWrap: 'wrap' }}>
            <FormControl sx={{ flexGrow: 1, minWidth: 200 }}>
              <InputLabel>اختر طالب لتسجيله</InputLabel>
              <Select value={enrollData.student_id} label="اختر طالب لتسجيله" onChange={(e) => setEnrollData({ student_id: e.target.value })}>
                <MenuItem value="">-- اختر طالب --</MenuItem>
                {students.map((s: any) => (
                  <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.student_id})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={handleEnroll}>تسجيل</Button>
          </Box>
          <Typography variant="subtitle2" gutterBottom>الطلاب المسجلون ({classStudents.length})</Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small" dir="rtl">
              <TableHead>
                <TableRow>
                  <TableCell>الاسم</TableCell>
                  <TableCell>البريد</TableCell>
                  <TableCell>تاريخ التسجيل</TableCell>
                  <TableCell>إجراء</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {classStudents.length === 0 ? (
                  <TableRow><TableCell colSpan={4} align="center">لا يوجد طلاب مسجلون</TableCell></TableRow>
                ) : (
                  classStudents.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.first_name} {s.last_name}</TableCell>
                      <TableCell>{s.email || '-'}</TableCell>
                      <TableCell>{s.enrollment_date}</TableCell>
                      <TableCell>
                        <Button size="small" color="error" onClick={() => handleUnenroll(s.id)}>إلغاء</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEnrollDialog(false)}>إغلاق</Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Delete color="error" />
          حذف الفصل
        </DialogTitle>
        <DialogContent>
          <Typography>هل أنت متأكد من حذف هذا الفصل؟ هذا الإجراء لا يمكن التراجع عنه.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
          <Button variant="contained" color="error" onClick={confirmDelete} startIcon={<Delete />}>تأكيد الحذف</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
