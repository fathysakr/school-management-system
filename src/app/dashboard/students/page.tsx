'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton, Chip, Alert, CircularProgress,
  TablePagination, Grid, Tabs, Tab} from '@mui/material';
import { Add, Edit, Delete, Visibility, Close, FileUpload, FileDownload, CloudUpload, Phone, RemoveCircleOutline, DeleteSweep, AutoAwesome } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { exportToExcel } from '@/lib/excel';
import { hasPermission } from '@/lib/permissions';
import EmptyState from '@/components/empty-state';

export default function StudentsPage() {
  const { user, token, selectedSchool } = useAuth();
  const schoolParam = selectedSchool && selectedSchool !== 'all' ? `&school=${selectedSchool}` : '';
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    student_id: '', first_name: '', last_name: '', email: '',
    phone: '', date_of_birth: '', address: '',
    parent_email: '', parent_phone: '', parent_phones: [''] as string[],
    enrollment_date: new Date().toISOString().split('T')[0],
  });
  const [isEdit, setIsEdit] = useState(false);
  const [importTab, setImportTab] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStudents = async () => {
    if (!token) return;
    try {
      const res = await api.get(`/students?page=${page + 1}&limit=${rowsPerPage}${schoolParam}`, token);
      setStudents(res.students || []);
      setTotal(res.pagination?.total || 0);
    } catch {
      setError('فشل في جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStudents(); }, [token, page, rowsPerPage]);

  const parsePhones = (student: any): string[] => {
    if (student.parent_phones) {
      try {
        const parsed = JSON.parse(student.parent_phones);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.filter(Boolean);
      } catch { /* ignore */ }
    }
    return student.parent_phone ? [student.parent_phone] : [''];
  };

  const handleOpenDialog = (student?: any) => {
    if (student) {
      setIsEdit(true);
      setSelectedStudent(student);
      setFormData({
        student_id: student.student_id, first_name: student.first_name, last_name: student.last_name,
        email: student.email || '', phone: student.phone || '',
        date_of_birth: student.date_of_birth || '',
        address: student.address || '', parent_email: student.parent_email || '',
        parent_phone: student.parent_phone || '',
        parent_phones: parsePhones(student),
        enrollment_date: student.enrollment_date || '',
      });
    } else {
      setIsEdit(false);
      setFormData({
        student_id: '', first_name: '', last_name: '', email: '',
        phone: '', date_of_birth: '', address: '',
        parent_email: '', parent_phone: '', parent_phones: [''],
        enrollment_date: new Date().toISOString().split('T')[0],
      });
    }
    setOpenDialog(true);
    setError('');
  };

  const handleSubmit = async () => {
    if (!token) return;
    setError('');
    setSuccess('');
    const phones = formData.parent_phones.filter(p => p.trim());
    const payload = {
      ...formData,
      parent_phones: phones,
      parent_phone: phones[0] || '',
    };
    try {
      if (isEdit && selectedStudent) {
        await api.put(`/students/${selectedStudent.id}`, payload, token);
        setSuccess('تم تحديث الطالب بنجاح');
      } else {
        await api.post('/students', payload, token);
        setSuccess('تم إضافة الطالب بنجاح');
      }
      setOpenDialog(false);
      fetchStudents();
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
      await api.delete(`/students/${deleteConfirm}`, token);
      setSuccess('تم حذف الطالب');
      setDeleteConfirm(null);
      fetchStudents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
      setDeleteConfirm(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!token) return;
    setDeletingAll(true);
    try {
      await api.post('/admin/bulk-delete', { action: 'delete_all_students' }, token);
      setSuccess('تم حذف جميع الطلاب وبياناتهم');
      setDeleteAllConfirm(false);
      fetchStudents();
    } catch {
      setError('فشل حذف جميع الطلاب');
    } finally {
      setDeletingAll(false);
    }
  };

  const handleView = async (id: number) => {
    if (!token) return;
    try {
      const res = await api.get(`/students/${id}`, token);
      setSelectedStudent(res.student);
      setViewDialog(true);
    } catch {
      setError('فشل في جلب بيانات الطالب');
    }
  };

  const handleGenerate = async () => {
    if (!token) return;
    setGenerating(true);
    try {
      const res = await api.post('/students/generate', { count: 50, school: selectedSchool === 'all' ? undefined : selectedSchool }, token);
      setSuccess(`تم إنشاء ${res.created || 0} طالب تجريبي`);
      fetchStudents();
    } catch {
      setError('فشل إنشاء الطلاب');
    }
    setGenerating(false);
  };

  const handleExport = async () => {
    if (!token) return;
    try {
      const res = await api.get(`/students?page=1&limit=1000&status=all${schoolParam}`, token);
      const rows = (res.students || []).map((s: any) => {
        const phones: string[] = (() => {
          if (s.parent_phones) {
            try { const p = JSON.parse(s.parent_phones); if (Array.isArray(p)) return p; } catch { /* */ }
          }
          return s.parent_phone ? [s.parent_phone] : [];
        })();
        return [
          s.student_id,
          s.first_name,
          s.last_name,
          s.email || '',
          s.phone || '',
          s.date_of_birth || '',
          phones.join(' / '),
          s.parent_email || '',
          s.address || '',
          s.enrollment_date || '',
          s.school === 'middle' ? 'متوسطة' : 'ثانوية',
          s.status === 'active' ? 'نشط' : s.status === 'graduated' ? 'متخرج' : 'غير نشط',
        ];
      });
      exportToExcel(['رقم الطالب','الاسم الأول','الاسم الأخير','البريد الإلكتروني','الهاتف','تاريخ الميلاد','هواتف ولي الأمر','بريد ولي الأمر','العنوان','تاريخ القيد','المرحلة','الحالة'], rows, 'الطلاب', 'students_صفوة_الرواد.xlsx');
      setSuccess('تم تصدير البيانات بنجاح');
    } catch {
      setError('فشل في تصدير البيانات');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      // Strategy 1: read with headers as keys (first row = Arabic column names)
      let rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, string>[];

      const ts = Date.now();
      let mapped = rows.map((row, i) => {
        const rawSchool = String(row['المرحلة'] || row['school'] || '');
        const school = rawSchool === 'ثانوية' || rawSchool === 'high' ? 'high' : rawSchool === 'متوسطة' || rawSchool === 'middle' ? 'middle' : '';
        return {
          student_id: String(row['رقم الطالب'] || row['student_id'] || `STU${ts}${i}`),
          first_name: String(row['الاسم الأول'] || row['first_name'] || ''),
          last_name: String(row['الاسم الأخير'] || row['last_name'] || ''),
          email: String(row['البريد الإلكتروني'] || row['email'] || ''),
          phone: String(row['الهاتف'] || row['phone'] || ''),
          date_of_birth: String(row['تاريخ الميلاد'] || row['date_of_birth'] || ''),
          parent_phones: String(row['هواتف ولي الأمر'] || row['parent_phones'] || '').split('/').map((s: string) => s.trim()).filter(Boolean),
          parent_phone: String(row['هاتف ولي الأمر'] || row['parent_phone'] || ''),
          parent_email: String(row['بريد ولي الأمر'] || row['parent_email'] || ''),
          address: String(row['العنوان'] || row['address'] || ''),
          enrollment_date: String(row['تاريخ القيد'] || row['enrollment_date'] || new Date().toISOString().split('T')[0]),
          school,
        };
      }).filter(r => r.first_name && r.last_name);

      // Strategy 2: fallback to column-position reading
      if (mapped.length === 0) {
        const arrRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as string[][];
        if (arrRows.length > 1) {
          mapped = arrRows.slice(1).map((row, i) => {
            const rawSchool = String(row[11] || '');
            const school = rawSchool === 'ثانوية' || rawSchool === 'high' ? 'high' : rawSchool === 'متوسطة' || rawSchool === 'middle' ? 'middle' : '';
            return {
              student_id: String(row[0] || `STU${ts}${i}`),
              first_name: String(row[1] || ''),
              last_name: String(row[2] || ''),
              email: String(row[3] || ''),
              phone: String(row[4] || ''),
              date_of_birth: String(row[5] || ''),
              parent_phones: (row[6] || '').split('/').map((s: string) => s.trim()).filter(Boolean),
              parent_phone: String(row[7] || ''),
              parent_email: String(row[8] || ''),
              address: String(row[9] || ''),
              enrollment_date: String(row[10] || new Date().toISOString().split('T')[0]),
              school,
            };
          }).filter(r => r.first_name && r.last_name);
        }
      }

      if (mapped.length === 0) {
        setError('لا توجد بيانات صالحة في الملف. تأكد من أن الأعمدة تحتوي على: رقم الطالب، الاسم الأول، الاسم الأخير');
        return;
      }

      setError('');
      setSuccess(`تم قراءة ${mapped.length} طالب. جاري الاستيراد...`);
      setImportTab(1);

      let successCount = 0;
      let failCount = 0;
      let lastError = '';
      for (const student of mapped) {
        try {
          await api.post('/students', student, token);
          successCount++;
        } catch (err: any) {
          lastError = err?.message || lastError;
          failCount++;
        }
      }

      setSuccess(`تم استيراد ${successCount} طالب بنجاح${failCount > 0 ? `، فشل ${failCount} (آخر خطأ: ${lastError})` : ''}`);
      fetchStudents();
    } catch {
      setError('فشل في قراءة الملف');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">إدارة الطلاب</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<FileDownload />} onClick={handleExport}>تصدير Excel</Button>
          {hasPermission(user?.role, 'students:create') && (
            <Button variant="outlined" startIcon={<FileUpload />} onClick={() => setImportDialog(true)}>استيراد Excel</Button>
          )}
          {hasPermission(user?.role, 'students:create') && (
            <Button variant="outlined" startIcon={<AutoAwesome />} onClick={handleGenerate} disabled={generating}>
              {generating ? <CircularProgress size={18} /> : 'إنشاء عينة'}
            </Button>
          )}
          {user?.role === 'admin' && (
            <Button variant="outlined" color="error" startIcon={<DeleteSweep />} onClick={() => setDeleteAllConfirm(true)}>حذف الجميع</Button>
          )}
          {hasPermission(user?.role, 'students:create') && (
            <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()}>إضافة طالب</Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}<IconButton size="small" onClick={() => setError('')}><Close fontSize="small" /></IconButton></Alert>}
      {success && <Alert severity="success" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>{success}<IconButton size="small" onClick={() => setSuccess('')}><Close fontSize="small" /></IconButton></Alert>}

      <Paper sx={{ overflow: 'auto' }}>
        <TableContainer>
          <Table sx={{ minWidth: 650 }} dir="rtl">
            <TableHead>
              <TableRow>
                <TableCell>الرقم</TableCell>
                <TableCell>الاسم</TableCell>
                <TableCell>البريد</TableCell>
                <TableCell>هواتف ولي الأمر</TableCell>
                <TableCell>المرحلة</TableCell>
                <TableCell>الحالة</TableCell>
                <TableCell>الإجراءات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} align="center"><CircularProgress /></TableCell></TableRow>
              ) : students.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center"><EmptyState message={loading ? '' : 'لا يوجد طلاب'} /></TableCell></TableRow>
              ) : (
                students.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.student_id}</TableCell>
                    <TableCell>{s.first_name} {s.last_name}</TableCell>
                    <TableCell>{s.email || '-'}</TableCell>
                    <TableCell>
                      {(() => {
                        const phones: string[] = (() => {
                          if (s.parent_phones) {
                            try { const p = JSON.parse(s.parent_phones); if (Array.isArray(p)) return p; } catch { /* */ }
                          }
                          return s.parent_phone ? [s.parent_phone] : [];
                        })();
                        return phones.length > 0
                          ? phones.map((p, i) => <Chip key={i} label={p} size="small" sx={{ ml: 0.5, mb: 0.3 }} />)
                          : '-';
                      })()}
                    </TableCell>
                    <TableCell>
                      <Chip label={s.school === 'high' ? 'ثانوية' : 'متوسطة'} size="small"
                        color={s.school === 'high' ? 'warning' : 'info'} />
                    </TableCell>
                    <TableCell>
                      <Chip label={s.status === 'active' ? 'نشط' : s.status === 'graduated' ? 'متخرج' : 'غير نشط'}
                        color={s.status === 'active' ? 'success' : s.status === 'graduated' ? 'info' : 'default'} size="small" />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleView(s.id)}><Visibility /></IconButton>
                      {hasPermission(user?.role, 'students:edit') && (
                        <IconButton size="small" onClick={() => handleOpenDialog(s)}><Edit /></IconButton>
                      )}
                      {hasPermission(user?.role, 'students:delete') && (
                        <Button size="small" color="error" startIcon={<Delete />} onClick={() => handleDelete(s.id)} sx={{ minWidth: 50 }}>حذف</Button>
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
        <DialogTitle>{isEdit ? 'تعديل الطالب' : 'إضافة طالب جديد'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><TextField fullWidth label="رقم الطالب" value={formData.student_id} onChange={(e) => setFormData({ ...formData, student_id: e.target.value })} disabled={isEdit} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="الاسم الأول" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="الاسم الأخير" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="البريد الإلكتروني" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="الهاتف" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="تاريخ الميلاد" type="date" value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12}><Typography variant="subtitle2" sx={{ mt: 1, fontWeight: 'bold' }}>بيانات ولي الأمر</Typography></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="بريد ولي الأمر" value={formData.parent_email} onChange={(e) => setFormData({ ...formData, parent_email: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600, color: 'text.secondary' }}>
                أرقام هواتف ولي الأمر
              </Typography>
              {formData.parent_phones.map((phone, idx) => (
                <Box key={idx} sx={{ display: 'flex', gap: 0.5, mb: 1, alignItems: 'center' }}>
                  <TextField
                    fullWidth size="small" placeholder={`رقم الهاتف ${idx + 1}`}
                    value={phone}
                    onChange={(e) => {
                      const updated = [...formData.parent_phones];
                      updated[idx] = e.target.value;
                      setFormData({ ...formData, parent_phones: updated });
                    }}
                  />
                  {formData.parent_phones.length > 1 && (
                    <IconButton
                      size="small" color="error"
                      onClick={() => {
                        const updated = formData.parent_phones.filter((_, i) => i !== idx);
                        setFormData({ ...formData, parent_phones: updated.length ? updated : [''] });
                      }}
                    >
                      <RemoveCircleOutline />
                    </IconButton>
                  )}
                </Box>
              ))}
              <Button
                size="small" startIcon={<Phone />}
                onClick={() => setFormData({ ...formData, parent_phones: [...formData.parent_phones, ''] })}
              >
                إضافة هاتف
              </Button>
            </Grid>
            <Grid item xs={12}><TextField fullWidth label="العنوان" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleSubmit}>{isEdit ? 'تحديث' : 'إضافة'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewDialog} onClose={() => setViewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>بيانات الطالب</DialogTitle>
        <DialogContent>
          {selectedStudent && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
              {[['الرقم', selectedStudent.student_id], ['الاسم', `${selectedStudent.first_name} ${selectedStudent.last_name}`], ['البريد', selectedStudent.email || '-'], ['بريد ولي الأمر', selectedStudent.parent_email || '-'], ['الحالة', selectedStudent.status === 'active' ? 'نشط' : selectedStudent.status === 'graduated' ? 'متخرج' : 'غير نشط']].map(([label, value]) => (
                <Box key={label} sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider', pb: 1 }}>
                  <Typography fontWeight="bold" sx={{ minWidth: 130 }}>{label}:</Typography>
                  <Typography>{value}</Typography>
                </Box>
              ))}
              <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider', pb: 1 }}>
                <Typography fontWeight="bold" sx={{ minWidth: 130 }}>هواتف ولي الأمر:</Typography>
                <Box>
                  {(() => {
                    const phones: string[] = (() => {
                      if (selectedStudent.parent_phones) {
                        try { const p = JSON.parse(selectedStudent.parent_phones); if (Array.isArray(p)) return p; } catch { /* */ }
                      }
                      return selectedStudent.parent_phone ? [selectedStudent.parent_phone] : [];
                    })();
                    return phones.length > 0
                      ? phones.map((p, i) => <Typography key={i}><Chip label={p} size="small" sx={{ ml: 0.5 }} /></Typography>)
                      : <Typography>-</Typography>;
                  })()}
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialog(false)}>إغلاق</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={importDialog} onClose={() => { setImportDialog(false); setImportTab(0); }} maxWidth="sm" fullWidth>
        <DialogTitle>استيراد الطلاب من Excel</DialogTitle>
        <DialogContent>
          <Tabs value={importTab} onChange={(_, v) => setImportTab(v)} sx={{ mb: 2 }}>
            <Tab label="تحميل ملف" />
            <Tab label="النتيجة" />
          </Tabs>
          {importTab === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} style={{ display: 'none' }} />
              <CloudUpload sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>اختر ملف Excel</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                الأعمدة المطلوبة: رقم الطالب، الاسم الأول، الاسم الأخير
              </Typography>
              <Button variant="contained" onClick={() => fileInputRef.current?.click()}>اختيار ملف</Button>
              <Box sx={{ mt: 3 }}>
                <Button size="small" onClick={() => {
                  exportToExcel(['رقم الطالب','الاسم الأول','الاسم الأخير','البريد الإلكتروني','الهاتف','تاريخ الميلاد','هواتف ولي الأمر','بريد ولي الأمر','العنوان','تاريخ القيد','المرحلة'],
                    [['STU001','أحمد','محمد','ahmed@example.com','0555555555','2010-01-15','0555555551','parent@example.com','الرياض','2024-09-01','ثانوية'],
                    ['STU002','خالد','عمر','khaled@example.com','0555555556','2011-03-20','0555555552','parent2@example.com','جدة','2024-09-01','متوسطة']],
                    'نموذج_استيراد', 'import_template.xlsx');
                }}>تحميل نموذج ملف</Button>
              </Box>
            </Box>
          )}
          {importTab === 1 && (
            <Box sx={{ py: 2, textAlign: 'center' }}>
              <Typography>{success}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setImportDialog(false); setImportTab(0); }}>إغلاق</Button>
        </DialogActions>
      </Dialog>

      {/* Delete all students confirm dialog */}
      <Dialog open={deleteAllConfirm} onClose={() => !deletingAll && setDeleteAllConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteSweep color="error" />
          حذف جميع الطلاب
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="bold">سيتم حذف جميع الطلاب وبياناتهم بالكامل (الدرجات، الحضور، التقارير، التسجيلات)</Typography>
            <Typography variant="caption">هذا الإجراء لا يمكن التراجع عنه.</Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDeleteAllConfirm(false)} disabled={deletingAll}>إلغاء</Button>
          <Button variant="contained" color="error" onClick={handleDeleteAll} disabled={deletingAll} startIcon={<DeleteSweep />}>
            {deletingAll ? 'جاري الحذف...' : 'تأكيد حذف الكل'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Delete color="error" />
          حذف الطالب
        </DialogTitle>
        <DialogContent>
          <Typography>هل أنت متأكد من حذف هذا الطالب؟ هذا الإجراء لا يمكن التراجع عنه.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
          <Button variant="contained" color="error" onClick={confirmDelete} startIcon={<Delete />}>تأكيد الحذف</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
