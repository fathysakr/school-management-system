'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Alert, CircularProgress,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { AdminPanelSettings, LockReset, Visibility as VisIcon, VisibilityOff, FileDownload } from '@mui/icons-material';
import { exportToExcel } from '@/lib/excel';
import EmptyState from '@/components/empty-state';

const roleLabels: Record<string, string> = {
  admin: 'مدير النظام',
  middle_principal: 'مدير مدرسة - متوسط',
  high_principal: 'مدير مدرسة - ثانوي',
  middle_supervisor: 'مشرف متوسط',
  high_supervisor: 'مشرف ثانوي',
  middle_counselor: 'مرشد طلابي متوسط',
  high_counselor: 'مرشد طلابي ثانوي',
};

const roleColors: Record<string, string> = {
  admin: '#7c4dff',
  middle_principal: '#4a148c',
  high_principal: '#880e4f',
  middle_supervisor: '#1565c0',
  high_supervisor: '#e65100',
  middle_counselor: '#00897b',
  high_counselor: '#6a1b9a',
};

const getRoleLabel = (role: string): string => roleLabels[role] || role;
const getRoleColor = (role: string): string => roleColors[role] || '#757575';

export default function ManagementPage() {
  const { user, token, selectedSchool } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordDialog, setPasswordDialog] = useState<{ member: any } | null>(null);
  const [passwordForm, setPasswordForm] = useState({ password: '', show: false });
  const [roleFilter, setRoleFilter] = useState('all');
  const [schoolFilter, setSchoolFilter] = useState('all');

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

  useEffect(() => { fetchStaff(); }, [token, selectedSchool, schoolFilter]);

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

  const handleExport = () => {
    const rows = filteredStaff.map((s: any) => [
      s.employee_id || '-',
      s.first_name ? `${s.first_name} ${s.last_name}` : s.email,
      s.email,
      getRoleLabel(s.user_role),
      s.school === 'middle' ? 'متوسطة' : s.school === 'high' ? 'ثانوية' : '-',
    ]);
    exportToExcel(['الموظف', 'الاسم', 'البريد الإلكتروني', 'الدور', 'المرحلة'], rows, 'الإدارة', 'management_صفوة_الرواد.xlsx');
    setSuccess('تم تصدير البيانات بنجاح');
  };

  const filteredStaff = staff.filter(s => {
    if (roleFilter !== 'all' && !s.user_role.includes(roleFilter)) return false;
    return true;
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">الإدارة</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<FileDownload />} onClick={handleExport}>تصدير Excel</Button>
        </Box>
      </Box>

      {/* Stats cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {[['مدير النظام', staff.filter(s => s.user_role === 'admin').length, '#7c4dff'],
          ['مدير المدرسة', staff.filter(s => s.user_role.includes('principal')).length, '#6a1b9a'],
          ['مشرف', staff.filter(s => s.user_role.includes('supervisor')).length, '#1565c0'],
          ['مرشد طلابي', staff.filter(s => s.user_role.includes('counselor')).length, '#00897b'],
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

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>{success}</Alert>}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>الدور</InputLabel>
          <Select value={roleFilter} label="الدور" onChange={(e) => setRoleFilter(e.target.value)}>
            <MenuItem value="all">الكل</MenuItem>
            <MenuItem value="principal">مدير مدرسة</MenuItem>
            <MenuItem value="supervisor">مشرف</MenuItem>
            <MenuItem value="counselor">مرشد طلابي</MenuItem>
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
          <Table sx={{ minWidth: 800 }} dir="rtl">
            <TableHead>
              <TableRow>
                <TableCell>الاسم</TableCell>
                <TableCell>البريد الإلكتروني</TableCell>
                <TableCell>الدور</TableCell>
                <TableCell>المرحلة</TableCell>
                <TableCell>رقم الموظف</TableCell>
                <TableCell>الإجراءات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} align="center"><CircularProgress /></TableCell></TableRow>
              ) : filteredStaff.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center"><EmptyState message="لا يوجد أعضاء إدارة" icon={<AdminPanelSettings />} /></TableCell></TableRow>
              ) : (
                filteredStaff.map((s) => (
                  <TableRow key={s.user_id}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {s.first_name ? `${s.first_name} ${s.last_name}` : s.email}
                      {!s.first_name && <Typography variant="caption" color="text.secondary" display="block">(بدون حساب معلم)</Typography>}
                    </TableCell>
                    <TableCell>{s.email}</TableCell>
                    <TableCell>
                      <Chip label={getRoleLabel(s.user_role)} size="small"
                        sx={{ bgcolor: getRoleColor(s.user_role), color: '#fff', fontWeight: 600 }} />
                    </TableCell>
                    <TableCell>
                      {s.school ? (
                        <Chip label={s.school === 'high' ? 'ثانوية' : 'متوسطة'} size="small"
                          color={s.school === 'high' ? 'warning' : 'info'} />
                      ) : s.user_role !== 'admin' ? (
                        <Chip label="غير محدد" size="small" variant="outlined" />
                      ) : '-'}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{s.employee_id || '-'}</TableCell>
                    <TableCell>
                      <IconButton size="small" color="primary" onClick={() => { setPasswordDialog({ member: s }); setPasswordForm({ password: '', show: false }); }} title="تغيير كلمة المرور">
                        <LockReset fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

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
    </Box>
  );
}
