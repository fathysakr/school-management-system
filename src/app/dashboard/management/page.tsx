'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Alert, CircularProgress,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem,
  Autocomplete, Grid
} from '@mui/material';
import { AdminPanelSettings, LockReset, Visibility as VisIcon, VisibilityOff, FileDownload, Add, Edit, Delete } from '@mui/icons-material';
import { exportToExcel } from '@/lib/excel';
import EmptyState from '@/components/empty-state';

const ROLES = [
  { value: 'admin', label: 'مدير النظام', school: 'none' },
  { value: 'middle_principal', label: 'مدير مدرسة - متوسط', school: 'middle' },
  { value: 'high_principal', label: 'مدير مدرسة - ثانوي', school: 'high' },
  { value: 'middle_supervisor', label: 'مشرف متوسط', school: 'middle' },
  { value: 'high_supervisor', label: 'مشرف ثانوي', school: 'high' },
  { value: 'middle_counselor', label: 'مرشد طلابي متوسط', school: 'middle' },
  { value: 'high_counselor', label: 'مرشد طلابي ثانوي', school: 'high' },
  { value: 'middle_monitor', label: 'مراقب متوسط', school: 'middle' },
  { value: 'high_monitor', label: 'مراقب ثانوي', school: 'high' },
  { value: 'middle_admin_staff', label: 'إداري متوسط', school: 'middle' },
  { value: 'high_admin_staff', label: 'إداري ثانوي', school: 'high' },
];

const roleLabels: Record<string, string> = Object.fromEntries(ROLES.map(r => [r.value, r.label]));
const roleColors: Record<string, string> = {
  admin: '#7c4dff',
  middle_principal: '#4a148c',
  high_principal: '#880e4f',
  middle_supervisor: '#1565c0',
  high_supervisor: '#e65100',
  middle_counselor: '#00897b',
  high_counselor: '#6a1b9a',
  middle_monitor: '#f9a825',
  high_monitor: '#e65100',
  middle_admin_staff: '#546e7a',
  high_admin_staff: '#37474f',
};

const getRoleLabel = (role: string): string => roleLabels[role] || role;
const getRoleColor = (role: string): string => roleColors[role] || '#757575';
const getSchoolLabel = (role: string): string => {
  if (role === 'admin') return '-';
  if (role.includes('middle')) return 'متوسطة';
  if (role.includes('high')) return 'ثانوية';
  return '-';
};

export default function ManagementPage() {
  const { user, token, selectedSchool } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordDialog, setPasswordDialog] = useState<{ member: any } | null>(null);
  const [passwordForm, setPasswordForm] = useState({ password: '', show: false });
  const [formDialog, setFormDialog] = useState<{ open: boolean; edit: any | null }>({ open: false, edit: null });
  const [formData, setFormData] = useState({ email: '', password: '', role: 'middle_supervisor', teacher_id: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const isAdmin = user?.role === 'admin';

  const fetchStaff = async () => {
    if (!token) return;
    try {
      const filterSchool = schoolFilter !== 'all' ? schoolFilter : (selectedSchool && selectedSchool !== 'all' ? selectedSchool : '');
      const params = filterSchool ? `?school=${filterSchool}` : '';
      const res = await api.get(`/management${params}`, token);
      setStaff(res.staff || []);
    } catch {
      setError('فشل في جلب بيانات الإدارة');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    if (!token) return;
    try {
      const res = await api.get('/teachers?limit=500', token);
      setTeachers(res.teachers || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchStaff(); fetchTeachers(); }, [token, selectedSchool, schoolFilter]);

  const handlePasswordReset = async () => {
    if (!token || !passwordDialog || !passwordForm.password) return;
    if (passwordForm.password.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    try {
      await api.put(`/admin/users?id=${passwordDialog.member.user_id}`, { password: passwordForm.password }, token);
      setSuccess(`تم تغيير كلمة المرور لـ ${passwordDialog.member.first_name || passwordDialog.member.email}\nكلمة المرور الجديدة: ${passwordForm.password}`);
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

  const openAddDialog = () => {
    setFormData({ email: '', password: '', role: 'middle_supervisor', teacher_id: '' });
    setFormDialog({ open: true, edit: null });
    setError('');
  };

  const openEditDialog = (member: any) => {
    setFormData({
      email: member.email,
      password: '',
      role: member.user_role,
      teacher_id: member.teacher_id ? String(member.teacher_id) : '',
    });
    setFormDialog({ open: true, edit: member });
    setError('');
  };

  const handleFormSubmit = async () => {
    if (!token) return;
    setError('');
    try {
      if (formDialog.edit) {
        const body: any = { email: formData.email };
        if (formData.role) body.role = formData.role;
        if (formData.password) body.password = formData.password;
        body.teacher_id = formData.teacher_id ? parseInt(formData.teacher_id) : null;
        await api.put(`/management/${formDialog.edit.user_id}`, body, token);
        setSuccess('تم التحديث بنجاح');
      } else {
        if (!formData.password || formData.password.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
        await api.post('/management', {
          email: formData.email,
          password: formData.password,
          role: formData.role,
          teacher_id: formData.teacher_id ? parseInt(formData.teacher_id) : null,
        }, token);
        setSuccess('تمت الإضافة بنجاح');
      }
      setFormDialog({ open: false, edit: null });
      fetchStaff();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    }
  };

  const handleDelete = async () => {
    if (!token || deleteConfirm === null) return;
    try {
      await api.delete(`/management/${deleteConfirm}`, token);
      setSuccess('تم الحذف بنجاح');
      setDeleteConfirm(null);
      fetchStaff();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
      setDeleteConfirm(null);
    }
  };

  const handleExport = () => {
    const rows = filteredStaff.map((s: any) => [
      s.first_name ? `${s.first_name} ${s.last_name}` : s.email,
      s.email,
      getRoleLabel(s.user_role),
      getSchoolLabel(s.user_role),
      s.employee_id || '-',
    ]);
    exportToExcel(['الاسم', 'البريد الإلكتروني', 'الدور', 'المرحلة', 'رقم الموظف'], rows, 'الإدارة', 'management_صفوة_الرواد.xlsx');
    setSuccess('تم تصدير البيانات بنجاح');
  };

  const filteredStaff = staff.filter(s => {
    if (roleFilter !== 'all' && !s.user_role.includes(roleFilter)) return false;
    return true;
  });

  const selectedTeacher = teachers.find(t => t.id === parseInt(formData.teacher_id));

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold">الإدارة</Typography>
          <Typography variant="body2" color="text.secondary">
            إدارة صلاحيات مدير النظام، مدير المدرسة، المشرفين، والمرشدين الطلابيين
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<FileDownload />} onClick={handleExport}>تصدير Excel</Button>
          {isAdmin && (
            <Button variant="contained" startIcon={<Add />} onClick={openAddDialog}>إضافة عضو إدارة</Button>
          )}
        </Box>
      </Box>

      {/* Stats cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {[['مدير النظام', staff.filter(s => s.user_role === 'admin').length, '#7c4dff'],
          ['مدير المدرسة', staff.filter(s => s.user_role.includes('principal')).length, '#6a1b9a'],
          ['مشرف', staff.filter(s => s.user_role.includes('supervisor')).length, '#1565c0'],
          ['مرشد طلابي', staff.filter(s => s.user_role.includes('counselor')).length, '#00897b'],
          ['مراقب', staff.filter(s => s.user_role.includes('monitor')).length, '#f9a825'],
          ['إداري', staff.filter(s => s.user_role.includes('admin_staff')).length, '#546e7a'],
        ].map(([label, count, color]) => (
          <Paper key={label as string} sx={{ p: 2, minWidth: 160, display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: color as string, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AdminPanelSettings sx={{ color: '#fff', fontSize: 20 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight="bold">{count as number}</Typography>
              <Typography variant="body2" color="text.secondary">{label as string}</Typography>
            </Box>
          </Paper>
        ))}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2, whiteSpace: 'pre-wrap' }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>الدور</InputLabel>
          <Select value={roleFilter} label="الدور" onChange={(e) => setRoleFilter(e.target.value)}>
            <MenuItem value="all">الكل</MenuItem>
            <MenuItem value="principal">مدير مدرسة</MenuItem>
            <MenuItem value="supervisor">مشرف</MenuItem>
            <MenuItem value="counselor">مرشد طلابي</MenuItem>
            <MenuItem value="monitor">مراقب</MenuItem>
            <MenuItem value="admin_staff">إداري</MenuItem>
            <MenuItem value="admin">مدير النظام</MenuItem>
          </Select>
        </FormControl>
        {user?.role === 'admin' && (
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>المرحلة</InputLabel>
            <Select value={schoolFilter} label="المرحلة" onChange={(e) => setSchoolFilter(e.target.value)}>
              <MenuItem value="all">الكل</MenuItem>
              <MenuItem value="middle">متوسطة</MenuItem>
              <MenuItem value="high">ثانوية</MenuItem>
            </Select>
          </FormControl>
        )}
      </Box>

      <Paper sx={{ overflow: 'auto' }}>
        <TableContainer>
          <Table sx={{ minWidth: 900 }} dir="rtl">
            <TableHead>
              <TableRow>
                <TableCell>الاسم</TableCell>
                <TableCell>البريد الإلكتروني</TableCell>
                <TableCell>الدور</TableCell>
                <TableCell>المرحلة</TableCell>
                <TableCell>رقم الموظف</TableCell>
                {isAdmin && <TableCell>الإجراءات</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={isAdmin ? 6 : 5} align="center"><CircularProgress /></TableCell></TableRow>
              ) : filteredStaff.length === 0 ? (
                <TableRow><TableCell colSpan={isAdmin ? 6 : 5} align="center"><EmptyState message="لا يوجد أعضاء إدارة" icon={<AdminPanelSettings />} action={isAdmin ? 'إضافة عضو إدارة' : undefined} onAction={openAddDialog} /></TableCell></TableRow>
              ) : (
                filteredStaff.map((s) => (
                  <TableRow key={s.user_id}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {s.first_name ? `${s.first_name} ${s.last_name}` : s.email}
                      {!s.first_name && <Typography variant="caption" color="text.secondary" display="block">(بدون حساب معلم)</Typography>}
                    </TableCell>
                    <TableCell dir="ltr">{s.email}</TableCell>
                    <TableCell>
                      <Chip label={getRoleLabel(s.user_role)} size="small"
                        sx={{ bgcolor: getRoleColor(s.user_role), color: '#fff', fontWeight: 600 }} />
                    </TableCell>
                    <TableCell>
                      {s.user_role === 'admin' ? '-' : (
                        <Chip label={getSchoolLabel(s.user_role)} size="small"
                          color={s.user_role.includes('high') ? 'warning' : 'info'} />
                      )}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{s.employee_id || '-'}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton size="small" color="primary" onClick={() => openEditDialog(s)} title="تعديل">
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton size="small" sx={{ color: '#ed6c02' }} onClick={() => { setPasswordDialog({ member: s }); setPasswordForm({ password: '', show: false }); }} title="تغيير كلمة المرور">
                            <LockReset fontSize="small" />
                          </IconButton>
                          {s.user_role !== 'admin' && (
                            <IconButton size="small" color="error" onClick={() => setDeleteConfirm(s.user_id)} title="حذف">
                              <Delete fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={formDialog.open} onClose={() => setFormDialog({ open: false, edit: null })} maxWidth="sm" fullWidth>
        <DialogTitle>{formDialog.edit ? 'تعديل عضو إدارة' : 'إضافة عضو إدارة جديد'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="البريد الإلكتروني" type="email" value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label={formDialog.edit ? 'كلمة المرور (اتركها فارغة لعدم التغيير)' : 'كلمة المرور'}
                type="password" value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>الدور</InputLabel>
                <Select value={formData.role} label="الدور" onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                  {ROLES.map(r => (
                    <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                options={teachers}
                getOptionLabel={(t) => `${t.first_name} ${t.last_name} (${t.teacher_id})`}
                value={selectedTeacher || null}
                onChange={(_, v) => setFormData({ ...formData, teacher_id: v ? String(v.id) : '' })}
                renderInput={(params) => <TextField {...params} label="ربط بمعلم (اختياري)" />}
                noOptionsText="لا يوجد معلمون"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setFormDialog({ open: false, edit: null })}>إلغاء</Button>
          <Button variant="contained" onClick={handleFormSubmit} disabled={!formData.email || (!formDialog.edit && !formData.password)}>
            {formDialog.edit ? 'تحديث' : 'إضافة'}
          </Button>
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
            المستخدم: <strong>{passwordDialog?.member?.first_name ? `${passwordDialog.member.first_name} ${passwordDialog.member.last_name}` : passwordDialog?.member?.email}</strong>
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
          حذف عضو إدارة
        </DialogTitle>
        <DialogContent>
          <Typography>هل أنت متأكد من حذف هذا العضو؟ هذا الإجراء لا يمكن التراجع عنه.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
          <Button variant="contained" color="error" onClick={handleDelete} startIcon={<Delete />}>تأكيد الحذف</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
