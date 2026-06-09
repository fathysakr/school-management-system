'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton, Chip, Alert, CircularProgress,
  TablePagination, Select, MenuItem, InputLabel, FormControl, Grid,
  Tabs, Tab
} from '@mui/material';
import { Add, Edit, Delete, People, Close, FileDownload, FileUpload, Download, CloudUpload } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { exportToExcel } from '@/lib/excel';
import { hasPermission } from '@/lib/permissions';
import EmptyState from '@/components/empty-state';

export default function ClassesPage() {
  const { user, token, selectedSchool } = useAuth();
  const schoolParam = selectedSchool && selectedSchool !== 'all' ? `&school=${selectedSchool}` : '';
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const teachingTeachers = teachers.filter(t => !t.user_role || t.user_role.includes('teacher'));
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [gradeTab, setGradeTab] = useState(0);
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
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [selectedImportIds, setSelectedImportIds] = useState<number[]>([]);
  const [importing, setImporting] = useState(false);
  const [uploadingClass, setUploadingClass] = useState<number | null>(null);
  const [uploadPreview, setUploadPreview] = useState<{ student_id: string; first_name: string; last_name: string }[]>([]);
  const [uploadPreviewOpen, setUploadPreviewOpen] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const fetchClasses = async () => {
    if (!token) return;
    try {
      const res = await api.get(`/classes?page=1&limit=500${schoolParam}`, token);
      setClasses(res.classes || []);
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

  useEffect(() => { fetchClasses(); fetchTeachers(); }, [token]);

  const gradeGroups = useMemo(() => {
    const map: Record<string, any[]> = {};
    classes.forEach((c: any) => {
      const gr = c.grade || 'بدون مرحلة';
      if (!map[gr]) map[gr] = [];
      map[gr].push(c);
    });
    const gradeOrder = [
      'الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي',
      'الصف الأول المتوسط', 'الصف الثاني المتوسط', 'الصف الثالث المتوسط',
    ];
    const keys = Object.keys(map).sort((a, b) => {
      const ai = gradeOrder.indexOf(a);
      const bi = gradeOrder.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.localeCompare(b);
    });
    return { map, keys };
  }, [classes]);

  const filteredClasses = useMemo(() => {
    const key = gradeGroups.keys[gradeTab];
    return key ? (gradeGroups.map[key] || []) : [];
  }, [gradeGroups, gradeTab]);

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
      setFormData({ class_name: cls.class_name, grade: cls.grade, section: cls.section || '', teacher_id: cls.teacher_id?.toString() || '', room_number: cls.room_number || '', capacity: cls.capacity?.toString() || '30' });
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
        await api.put(`/classes/${selectedClass.id}`, { ...formData, teacher_id: formData.teacher_id ? parseInt(formData.teacher_id) : null, capacity: parseInt(formData.capacity) }, token);
        setSuccess('تم تحديث الفصل بنجاح');
      } else {
        await api.post('/classes', { ...formData, teacher_id: formData.teacher_id ? parseInt(formData.teacher_id) : null, capacity: parseInt(formData.capacity) }, token);
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
    if (!token || !selectedClass || !enrollData.student_id) return;
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
        c.subjects || '',
        c.room_number || '',
        c.capacity || '',
        c.student_count || 0,
        c.status === 'active' ? 'نشط' : 'غير نشط',
      ]);
      exportToExcel(['اسم الفصل','المرحلة','القسم','المعلم','المواد','القاعة','السعة','عدد الطلاب','الحالة'], rows, 'الفصول', 'classes_صفوة_الرواد.xlsx');
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

  const handleOpenBulkImport = () => {
    setSelectedImportIds([]);
    fetchStudents();
    setBulkImportOpen(true);
  };

  const handleBulkImport = async () => {
    if (!token || !selectedClass || selectedImportIds.length === 0) return;
    setImporting(true);
    setError('');
    try {
      const res = await api.post('/classes/enroll/bulk', { class_id: selectedClass.id, student_ids: selectedImportIds }, token);
      setSuccess(res.message || `تم تسجيل ${selectedImportIds.length} طالب`);
      setBulkImportOpen(false);
      setSelectedImportIds([]);
      const classRes = await api.get(`/classes/${selectedClass.id}`, token);
      setClassStudents(classRes.students || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setImporting(false);
    }
  };

  const handleClassUploadClick = (classId: number) => {
    setUploadingClass(classId);
    setTimeout(() => uploadInputRef.current?.click(), 0);
  };

  const handleClassUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploadingClass === null) return;
    setError(''); setSuccess('');
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const parsed: { student_id: string; first_name: string; last_name: string }[] = [];
      let debugInfo = '';
      for (const sheetName of workbook.SheetNames) {
        const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        if (rows.length < 2) continue;
        const firstRows = rows.slice(0, Math.min(5, rows.length)).map((r: any) => JSON.stringify(r)).join(' | ');
        debugInfo += `ورقة "${sheetName}": ${rows.length} صف، أولها: ${firstRows}. `;
        const couldBeId = (v: any) => /\d/.test(String(v));
        const couldBeName = (v: any) => typeof v === 'string' && /[a-zA-Z\u0600-\u06FF\s]/.test(v) && !/^\d+$/.test(v.trim());
        for (const row of rows) {
          if (!row) continue;
          const vals = (Array.isArray(row) ? row : Object.values(row)).filter((v: any) => v !== undefined && v !== null && v !== '');
          if (vals.length < 2) continue;
          let sid = '', fn = '', ln = '';
          if (vals.length >= 3 && couldBeId(vals[0]) && couldBeName(vals[1]) && couldBeName(vals[2])) {
            sid = String(vals[0]).trim(); fn = String(vals[1]).trim(); ln = String(vals[2]).trim();
          } else if (vals.length >= 2 && couldBeId(vals[0]) && couldBeName(vals[1])) {
            sid = String(vals[0]).trim();
            const name = String(vals[1]).trim();
            const parts = name.split(' ');
            fn = parts[0] || name;
            ln = parts.slice(1).join(' ') || parts[0] || name;
          } else if (vals.length >= 2 && couldBeName(vals[0]) && couldBeId(vals[1])) {
            sid = String(vals[1]).trim();
            const name = String(vals[0]).trim();
            const parts = name.split(' ');
            fn = parts[0] || name;
            ln = parts.slice(1).join(' ') || parts[0] || name;
          }
          if (sid && sid.length >= 2 && fn && ln) {
            parsed.push({ student_id: sid, first_name: fn, last_name: ln });
          }
        }
      }
      if (parsed.length === 0) {
        setError(`لم يتم العثور على طلاب في الملف. تفاصيل: ${debugInfo}`);
        return;
      }
      setUploadPreview(parsed);
      setUploadPreviewOpen(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل قراءة الملف');
    }
    if (e.target) e.target.value = '';
  };

  const handleUploadConfirm = async () => {
    if (!token || uploadingClass === null) return;
    setUploadPreviewOpen(false);
    setError('');
    try {
      const res = await api.post(`/classes/${uploadingClass}/upload`, { students: uploadPreview }, token);
      setSuccess(`تم استخراج ${uploadPreview.length} طالب من الملف، إنشاء ${res.created||0} جديد، تسجيل ${res.enrolled||0} في الفصل، ${res.skipped||0} موجود مسبقاً، ${res.errors||0} خطأ`);
      fetchClasses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل رفع الملف');
    }
    setUploadingClass(null);
    setUploadPreview([]);
  };

  const handleExportClassStudents = () => {
    if (!selectedClass || classStudents.length === 0) return;
    const rows = classStudents.map((s: any) => [
      s.student_id,
      s.first_name,
      s.last_name,
      s.email || '-',
      s.parent_phone || '-',
      s.enrollment_date,
    ]);
    exportToExcel(['رقم الطالب', 'الاسم الأول', 'اسم العائلة', 'البريد', 'رقم ولي الأمر', 'تاريخ التسجيل'],
      rows, `${selectedClass.class_name}`, `students_${selectedClass.class_name}.xlsx`);
    setSuccess('تم تصدير الطلاب بنجاح');
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

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <>
          <Tabs value={gradeTab} onChange={(_, v) => setGradeTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
            {gradeGroups.keys.map((key: string) => (
              <Tab key={key} label={`${key} (${gradeGroups.map[key].length})`} />
            ))}
          </Tabs>
          <Paper sx={{ overflow: 'auto' }}>
            <TableContainer>
              <Table sx={{ minWidth: 700 }} dir="rtl">
                <TableHead>
                  <TableRow>
                    <TableCell>اسم الفصل</TableCell>
                    <TableCell>القسم</TableCell>
                    <TableCell>المعلم</TableCell>
                    <TableCell>المواد</TableCell>
                    <TableCell>القاعة</TableCell>
                    <TableCell>السعة</TableCell>
                    <TableCell>الطلاب</TableCell>
                    <TableCell>الحالة</TableCell>
                    <TableCell>الإجراءات</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredClasses.length === 0 ? (
                    <TableRow><TableCell colSpan={9} align="center"><EmptyState message="لا يوجد فصول في هذه المرحلة" /></TableCell></TableRow>
                  ) : (
                    filteredClasses.slice(page * rowsPerPage, (page + 1) * rowsPerPage).map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.class_name}</TableCell>
                        <TableCell>{c.section || '-'}</TableCell>
                        <TableCell>{c.teacher_name || '-'}</TableCell>
                        <TableCell>{c.subjects || '-'}</TableCell>
                        <TableCell>{c.room_number || '-'}</TableCell>
                        <TableCell>{c.capacity}</TableCell>
                        <TableCell>{c.student_count || 0}</TableCell>
                        <TableCell>
                          <Chip label={c.status === 'active' ? 'نشط' : 'غير نشط'}
                            color={c.status === 'active' ? 'success' : 'default'} size="small" />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {hasPermission(user?.role, 'classes:edit') && (
                              <IconButton size="small" color="info" onClick={() => handleOpenEnroll(c)} title="إدارة الطلاب"><People /></IconButton>
                            )}
                            {hasPermission(user?.role, 'classes:edit') && (
                              <IconButton size="small" color="success" onClick={() => handleClassUploadClick(c.id)} title="رفع ملف طلاب"><CloudUpload /></IconButton>
                            )}
                            {hasPermission(user?.role, 'classes:edit') && (
                              <IconButton size="small" onClick={() => handleOpenDialog(c)} title="تعديل"><Edit /></IconButton>
                            )}
                            {hasPermission(user?.role, 'classes:delete') && (
                              <IconButton size="small" color="error" onClick={() => handleDelete(c.id)} title="حذف"><Delete /></IconButton>
                            )}
                          </Box>
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
              count={filteredClasses.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
              labelRowsPerPage="عدد الصفوف"
            />
          </Paper>
        </>
      )}

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{isEdit ? 'تعديل الفصل' : 'إنشاء فصل جديد'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}><TextField fullWidth label="اسم الفصل" value={formData.class_name} onChange={(e) => setFormData({ ...formData, class_name: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><FormControl fullWidth><InputLabel>المرحلة</InputLabel><Select value={formData.grade} label="المرحلة" onChange={(e) => setFormData({ ...formData, grade: e.target.value })}><MenuItem value="المتوسطة">المدرسة المتوسطة</MenuItem><MenuItem value="الثانوية">المدرسة الثانوية</MenuItem></Select></FormControl></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="القسم" value={formData.section} onChange={(e) => setFormData({ ...formData, section: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="رقم القاعة" value={formData.room_number} onChange={(e) => setFormData({ ...formData, room_number: e.target.value })} /></Grid>
            <Grid item xs={12}><FormControl fullWidth><InputLabel>المعلم (اختياري)</InputLabel><Select value={formData.teacher_id} label="المعلم (اختياري)" onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}><MenuItem value="">بدون معلم</MenuItem>{teachingTeachers.length === 0 ? <MenuItem disabled>لا يوجد معلمون غير إداريين</MenuItem> : teachingTeachers.map((t) => (<MenuItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</MenuItem>))}</Select></FormControl></Grid>
            <Grid item xs={12}><TextField fullWidth label="السعة" type="number" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleSubmit}>{isEdit ? 'تحديث' : 'إنشاء'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={enrollDialog} onClose={() => setEnrollDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>إدارة طلاب الفصل: {selectedClass?.class_name}</span>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" variant="outlined" startIcon={<FileUpload />} onClick={handleOpenBulkImport}>
              استيراد
            </Button>
            <Button size="small" variant="outlined" startIcon={<Download />}
              onClick={handleExportClassStudents} disabled={classStudents.length === 0}>
              تصدير
            </Button>
          </Box>
        </DialogTitle>
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

      {/* Bulk import dialog */}
      <Dialog open={bulkImportOpen} onClose={() => setBulkImportOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>استيراد طلاب - {selectedClass?.class_name}</DialogTitle>
        <DialogContent>
          {students.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={2}>لا يوجد طلاب</Typography>
          ) : (
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
              {students
                .filter(s => !classStudents.some(cs => cs.id === s.id))
                .map(s => {
                  const isSelected = selectedImportIds.includes(s.id);
                  return (
                    <Box key={s.id} sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5, p: 1,
                      cursor: 'pointer', borderRadius: 1,
                      '&:hover': { bgcolor: 'action.hover' },
                      bgcolor: isSelected ? 'action.selected' : 'transparent',
                    }} onClick={() => {
                      setSelectedImportIds(prev =>
                        isSelected ? prev.filter(id => id !== s.id) : [...prev, s.id]
                      );
                    }}>
                      <Box sx={{ width: 20, height: 20, borderRadius: 0.5, border: '2px solid',
                        borderColor: isSelected ? 'primary.main' : 'grey.400',
                        bgcolor: isSelected ? 'primary.main' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isSelected && <Typography sx={{ color: '#fff', fontSize: 14, lineHeight: 1 }}>✓</Typography>}
                      </Box>
                      <Typography>{s.first_name} {s.last_name} ({s.student_id})</Typography>
                    </Box>
                  );
                })}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
            تم اختيار {selectedImportIds.length} طالب
          </Typography>
          <Button onClick={() => setBulkImportOpen(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleBulkImport}
            disabled={selectedImportIds.length === 0 || importing} startIcon={<FileUpload />}>
            {importing ? 'جاري الاستيراد...' : 'استيراد'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={uploadPreviewOpen} onClose={() => { setUploadPreviewOpen(false); setUploadingClass(null); }} maxWidth="md" fullWidth>
        <DialogTitle>معاينة الطلاب قبل الرفع</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            تم استخراج {uploadPreview.length} طالب من الملف. تأكد من البيانات قبل الرفع:
          </Typography>
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'right', padding: '8px', borderBottom: '2px solid #ddd' }}>رقم الطالب</th>
                  <th style={{ textAlign: 'right', padding: '8px', borderBottom: '2px solid #ddd' }}>الاسم الأول</th>
                  <th style={{ textAlign: 'right', padding: '8px', borderBottom: '2px solid #ddd' }}>اسم العائلة</th>
                </tr>
              </thead>
              <tbody>
                {uploadPreview.slice(0, 200).map((s, i) => (
                  <tr key={i}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee' }}>{s.student_id}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee' }}>{s.first_name}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee' }}>{s.last_name}</td>
                  </tr>
                ))}
                {uploadPreview.length > 200 && (
                  <tr><td colSpan={3} style={{ padding: '8px', textAlign: 'center' }}>...و {uploadPreview.length - 200} طالب آخر</td></tr>
                )}
              </tbody>
            </table>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
            إجمالي: {uploadPreview.length} طالب
          </Typography>
          <Button onClick={() => { setUploadPreviewOpen(false); setUploadingClass(null); setUploadPreview([]); }}>إلغاء</Button>
          <Button variant="contained" onClick={handleUploadConfirm} startIcon={<CloudUpload />}>تأكيد الرفع</Button>
        </DialogActions>
      </Dialog>
      <input ref={uploadInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleClassUploadFile} style={{ display: 'none' }} />
    </Box>
  );
}
