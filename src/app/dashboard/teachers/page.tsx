'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton, Chip, Alert, CircularProgress,
  TablePagination, Grid, Tabs, Tab, Link, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { Add, Edit, Delete, Visibility, Close, FileUpload, FileDownload, CloudUpload, LockReset, Visibility as VisIcon, VisibilityOff } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { exportToExcel } from '@/lib/excel';
import { hasPermission } from '@/lib/permissions';
import EmptyState from '@/components/empty-state';

const formatSpecialization = (spec: string): string => {
  if (!spec) return '-';
  try {
    const parsed = JSON.parse(spec);
    if (Array.isArray(parsed)) return parsed.map((s: any) => s.n || s).join('، ');
    return spec;
  } catch {
    return spec;
  }
};

export default function TeachersPage() {
  const { user, token, selectedSchool } = useAuth();
  const schoolParam = selectedSchool && selectedSchool !== 'all' ? `&school=${selectedSchool}` : '';
  const canCreate = hasPermission(user?.role, 'teachers:create');
  const canEdit = hasPermission(user?.role, 'teachers:edit');
  const canDelete = hasPermission(user?.role, 'teachers:delete');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    teacher_id: '', first_name: '', last_name: '', email: '',
    phone: '', specialization: '', date_of_birth: '', address: '',
    school: 'middle',
  });
  const isAdmin = user?.role === 'admin';
  const [isEdit, setIsEdit] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState<{ teacher: any } | null>(null);
  const [passwordForm, setPasswordForm] = useState({ password: '', show: false });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [importTab, setImportTab] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTeachers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get(`/teachers?page=${page + 1}&limit=${rowsPerPage}${schoolParam}`, token);
      setTeachers(res.teachers || []);
      setTotal(res.pagination?.total || 0);
    } catch {
      setError('فشل في جلب البيانات');
    } finally {
      setLoading(false);
    }
  }, [token, page, rowsPerPage, schoolParam]);

  useEffect(() => { fetchTeachers(); }, [token, page, rowsPerPage, fetchTeachers]);

  const handleOpenDialog = (teacher?: any) => {
    if (teacher) {
      setIsEdit(true);
      setSelectedTeacher(teacher);
      setFormData({
        teacher_id: teacher.teacher_id,
        first_name: teacher.first_name,
        last_name: teacher.last_name,
        email: teacher.email || '',
        phone: teacher.phone || '',
        specialization: formatSpecialization(teacher.specialization),
        date_of_birth: teacher.date_of_birth || '',
        address: teacher.address || '',
        school: teacher.school || 'middle',
      });
    } else {
      setIsEdit(false);
      setFormData({
        teacher_id: '', first_name: '', last_name: '', email: '',
        phone: '', specialization: '', date_of_birth: '', address: '',
        school: 'middle',
      });
    }
    setOpenDialog(true);
    setError('');
  };

  const handleSubmit = async () => {
    if (!token) return;
    setError('');
    setSuccess('');
    try {
      if (isEdit && selectedTeacher) {
        await api.put(`/teachers/${selectedTeacher.id}`, formData, token);
        setSuccess('تم تحديث المعلم بنجاح');
      } else {
        await api.post('/teachers', formData, token);
        setSuccess('تم إضافة المعلم بنجاح');
      }
      setOpenDialog(false);
      fetchTeachers();
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
      await api.delete(`/teachers/${deleteConfirm}`, token);
      setSuccess('تم حذف المعلم');
      setDeleteConfirm(null);
      fetchTeachers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
      setDeleteConfirm(null);
    }
  };

  const handleView = async (id: number) => {
    if (!token) return;
    try {
      const res = await api.get(`/teachers/${id}`, token);
      setSelectedTeacher(res.teacher);
      setViewDialog(true);
    } catch {
      setError('فشل في جلب بيانات المعلم');
    }
  };

  const handlePasswordReset = async () => {
    if (!token || !passwordDialog || !passwordForm.password) return;
    if (passwordForm.password.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    try {
      await api.put(`/admin/users?id=${passwordDialog.teacher.user_id}`, { password: passwordForm.password }, token);
      setSuccess(`تم تغيير كلمة المرور للمعلم ${passwordDialog.teacher.first_name} ${passwordDialog.teacher.last_name}`);
      setPasswordDialog(null);
      setPasswordForm({ password: '', show: false });
    } catch { setError('فشل تغيير كلمة المرور'); }
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let pwd = '';
    for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setPasswordForm({ ...passwordForm, password: pwd, show: true });
  };

  const handleExport = async () => {
    if (!token) return;
    try {
      const res = await api.get(`/teachers?page=1&limit=1000${schoolParam}`, token);
      const rows = (res.teachers || []).map((t: any) => [
        t.teacher_id,
        t.first_name,
        t.last_name,
        t.email || '',
        t.phone || '',
        t.specialization || '',
        t.date_of_birth || '',
        t.address || '',
        t.school === 'middle' ? 'متوسطة' : 'ثانوية',
        t.status === 'active' ? 'نشط' : 'غير نشط',
      ]);
      exportToExcel(['رقم المعلم','الاسم الأول','الاسم الأخير','البريد الإلكتروني','الهاتف','التخصص','تاريخ الميلاد','العنوان','المرحلة','الحالة'], rows, 'المعلمون', 'teachers_صفوة_الرواد.xlsx');
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
          teacher_id: String(row['رقم المعلم'] || row['teacher_id'] || `TCH${ts}${i}`),
          first_name: String(row['الاسم الأول'] || row['first_name'] || ''),
          last_name: String(row['الاسم الأخير'] || row['last_name'] || ''),
          email: String(row['البريد الإلكتروني'] || row['email'] || ''),
          phone: String(row['الهاتف'] || row['phone'] || ''),
          specialization: String(row['التخصص'] || row['specialization'] || ''),
          date_of_birth: String(row['تاريخ الميلاد'] || row['date_of_birth'] || ''),
          address: String(row['العنوان'] || row['address'] || ''),
          school,
        };
      }).filter(r => r.first_name && r.last_name);

      // Strategy 2: fallback to column-position reading
      if (mapped.length === 0) {
        const arrRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as string[][];
        if (arrRows.length > 1) {
          mapped = arrRows.slice(1).map((row, i) => {
            const rawSchool = String(row[8] || '');
            const school = rawSchool === 'ثانوية' || rawSchool === 'high' ? 'high' : rawSchool === 'متوسطة' || rawSchool === 'middle' ? 'middle' : '';
            return {
              teacher_id: String(row[0] || `TCH${ts}${i}`),
              first_name: String(row[1] || ''),
              last_name: String(row[2] || ''),
              email: String(row[3] || ''),
              phone: String(row[4] || ''),
              specialization: String(row[5] || ''),
              date_of_birth: String(row[6] || ''),
              address: String(row[7] || ''),
              school,
            };
          }).filter(r => r.first_name && r.last_name);
        }
      }

      if (mapped.length === 0) {
        setError('لا توجد بيانات صالحة في الملف. تأكد من أن الأعمدة تحتوي على: رقم المعلم، الاسم الأول، الاسم الأخير');
        return;
      }

      setError('');
      setSuccess(`تم قراءة ${mapped.length} معلم. جاري الاستيراد...`);
      setImportTab(1);

      let successCount = 0;
      let skipCount = 0;
      let failCount = 0;
      const errors = new Set<string>();
      for (const teacher of mapped) {
        try {
          await api.post('/teachers', teacher, token);
          successCount++;
        } catch (err: any) {
          if (err?.message?.includes('موجود مسبقاً')) {
            skipCount++;
          } else {
            if (err?.message) errors.add(err.message);
            failCount++;
          }
        }
      }

      let msg = `تم استيراد ${successCount} معلم بنجاح`;
      if (skipCount > 0) msg += `، ${skipCount} موجود مسبقاً (تم التخطي)`;
      if (failCount > 0) msg += `، فشل ${failCount}`;
      if (errors.size > 0) msg += `. ${[...errors].join(' | ')}`;
      setSuccess(msg);
      fetchTeachers();
    } catch {
      setError('فشل في قراءة الملف');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">إدارة المعلمين</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<FileDownload />} onClick={handleExport}>تصدير Excel</Button>
          {canCreate && (
            <Button variant="outlined" startIcon={<FileUpload />} onClick={() => setImportDialog(true)}>استيراد Excel</Button>
          )}
          {canCreate && (
            <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()}>إضافة معلم</Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}<IconButton size="small" onClick={() => setError('')}><Close fontSize="small" /></IconButton></Alert>}
      {success && <Alert severity="success" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>{success}<IconButton size="small" onClick={() => setSuccess('')}><Close fontSize="small" /></IconButton></Alert>}

      <Paper sx={{ overflow: 'auto' }}>
        <TableContainer>
          <Table sx={{ minWidth: 1000 }} dir="rtl">
            <TableHead>
              <TableRow>
                <TableCell>الرقم</TableCell>
                <TableCell>الاسم</TableCell>
                <TableCell>البريد</TableCell>
                <TableCell>التخصص</TableCell>
                <TableCell>الهاتف</TableCell>
                <TableCell>المرحلة</TableCell>
                <TableCell>الحالة</TableCell>
                <TableCell>الإجراءات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} align="center"><CircularProgress /></TableCell></TableRow>
              ) : teachers.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center"><EmptyState message="لا يوجد معلمون" /></TableCell></TableRow>
              ) : (
                teachers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{t.teacher_id}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{t.first_name} {t.last_name}</TableCell>
                    <TableCell>{t.email || '-'}</TableCell>
                    <TableCell>{formatSpecialization(t.specialization)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{t.phone || '-'}</TableCell>
                    <TableCell>
                      <Chip label={t.school === 'high' ? 'ثانوية' : 'متوسطة'} size="small"
                        color={t.school === 'high' ? 'warning' : 'info'} />
                    </TableCell>
                    <TableCell>
                      <Chip label={t.status === 'active' ? 'نشط' : 'غير نشط'}
                        color={t.status === 'active' ? 'success' : 'default'} size="small" />
                    </TableCell>
                    <TableCell>
                      <Button size="small" startIcon={<Visibility />} onClick={() => handleView(t.id)} sx={{ minWidth: 50 }}>عرض</Button>
                      {t.user_email && (
                        <IconButton size="small" sx={{ color: '#ed6c02' }} onClick={() => { setPasswordDialog({ teacher: t }); setPasswordForm({ password: '', show: false }); }} title="تغيير كلمة المرور"><LockReset fontSize="small" /></IconButton>
                      )}
                      {canEdit && (
                        <Button size="small" startIcon={<Edit />} onClick={() => handleOpenDialog(t)} sx={{ minWidth: 50, color: 'primary.main' }}>تعديل</Button>
                      )}
                      {canDelete && (
                        <Button size="small" startIcon={<Delete />} color="error" onClick={() => handleDelete(t.id)} sx={{ minWidth: 50 }}>حذف</Button>
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
        <DialogTitle>{isEdit ? 'تعديل المعلم' : 'إضافة معلم جديد'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><TextField fullWidth label="رقم المعلم" value={formData.teacher_id} onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })} disabled={isEdit} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="الاسم الأول" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="الاسم الأخير" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="البريد الإلكتروني" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="الهاتف" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="التخصص" value={formData.specialization} onChange={(e) => setFormData({ ...formData, specialization: e.target.value })} /></Grid>
            {isAdmin && (
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>المرحلة</InputLabel>
                  <Select value={formData.school} label="المرحلة" onChange={(e) => setFormData({ ...formData, school: e.target.value })}>
                    <MenuItem value="middle">متوسطة</MenuItem>
                    <MenuItem value="high">ثانوية</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid item xs={12}><TextField fullWidth label="العنوان" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleSubmit}>{isEdit ? 'تحديث' : 'إضافة'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewDialog} onClose={() => setViewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>بيانات المعلم</DialogTitle>
        <DialogContent>
          {selectedTeacher && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
              {[['الرقم', selectedTeacher.teacher_id], ['الاسم', `${selectedTeacher.first_name} ${selectedTeacher.last_name}`], ['البريد', selectedTeacher.email || '-'], ['الهاتف', selectedTeacher.phone || '-'], ['التخصص', formatSpecialization(selectedTeacher.specialization)], ['الحالة', selectedTeacher.status === 'active' ? 'نشط' : 'غير نشط']].map(([label, value]) => (
                <Box key={label} sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider', pb: 1 }}>
                  <Typography fontWeight="bold" sx={{ minWidth: 120 }}>{label}:</Typography>
                  <Typography>{value}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialog(false)}>إغلاق</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={importDialog} onClose={() => { setImportDialog(false); setImportTab(0); }} maxWidth="sm" fullWidth>
        <DialogTitle>استيراد المعلمين من Excel</DialogTitle>
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
                الأعمدة المطلوبة: رقم المعلم، الاسم الأول، الاسم الأخير
              </Typography>
              <Button variant="contained" onClick={() => fileInputRef.current?.click()}>اختيار ملف</Button>
              <Box sx={{ mt: 3 }}>
                <Link href="#" onClick={(e) => { e.preventDefault(); handleExport(); }} variant="body2">
                  تحميل نموذج ملف فارغ
                </Link>
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

      {/* Password reset dialog */}
      <Dialog open={!!passwordDialog} onClose={() => setPasswordDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockReset sx={{ color: '#ed6c02' }} />
          تغيير كلمة المرور
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            المعلم: <strong>{passwordDialog?.teacher?.first_name} {passwordDialog?.teacher?.last_name}</strong>
          </Typography>
          {passwordForm.show && passwordForm.password && (
            <Alert severity="info" sx={{ mt: 1, mb: 1 }}>
              <Typography variant="body2" fontWeight="bold">كلمة المرور الجديدة: {passwordForm.password}</Typography>
            </Alert>
          )}
          <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'center' }}>
            <TextField
              fullWidth size="small" label="كلمة المرور الجديدة"
              type={passwordForm.show ? 'text' : 'password'}
              value={passwordForm.password}
              onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
            />
            <IconButton onClick={() => setPasswordForm({ ...passwordForm, show: !passwordForm.show })}>
              {passwordForm.show ? <VisibilityOff /> : <VisIcon />}
            </IconButton>
          </Box>
          <Button size="small" onClick={generatePassword} sx={{ mt: 1 }}>
            توليد كلمة مرور عشوائية
          </Button>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setPasswordDialog(null)}>إلغاء</Button>
          <Button variant="contained" onClick={handlePasswordReset} disabled={!passwordForm.password || passwordForm.password.length < 6}>
            حفظ كلمة المرور
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Delete color="error" />
          حذف المعلم
        </DialogTitle>
        <DialogContent>
          <Typography>هل أنت متأكد من حذف هذا المعلم؟ هذا الإجراء لا يمكن التراجع عنه.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
          <Button variant="contained" color="error" onClick={confirmDelete} startIcon={<Delete />}>تأكيد الحذف</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
