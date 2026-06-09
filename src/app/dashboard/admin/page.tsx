'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, Alert, Chip, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, FormControl, InputLabel, Select, MenuItem,
  IconButton, Tabs, Tab, CircularProgress, TablePagination
} from '@mui/material';
import {
  DeleteSweep, Warning, School, Grade, Assessment, People,
  Schedule, Campaign, AutoStories, RestartAlt, ManageAccounts,
  Add, Edit, Delete, Refresh, Search, FileDownload, Security,
  LockReset, Visibility, VisibilityOff, ContentCopy, CloudDownload, CloudUpload, CalendarToday, GroupAdd
} from '@mui/icons-material';
import { exportToExcel } from '@/lib/excel';
import { permissionGroups, permissionLabels, allPermissions } from '@/lib/permissions';
import AcademicManagement from './AcademicManagement';
import ParentsManagement from './ParentsManagement';

const actions = [
  { key: 'delete_all_grades', label: 'حذف جميع الدرجات', icon: <Grade />, color: '#e65100', desc: 'مسح جميع سجلات الدرجات والتقييمات' },
  { key: 'delete_all_classes', label: 'حذف جميع الفصول', icon: <School />, color: '#d32f2f', desc: 'مسح الفصول والجداول والحضور والتقارير والتسجيلات' },
  { key: 'delete_all_reports', label: 'حذف جميع التقارير', icon: <Assessment />, color: '#ed6c02', desc: 'مسح جميع تقارير المعلمين' },
  { key: 'delete_all_students', label: 'حذف جميع الطلاب', icon: <People />, color: '#1565c0', desc: 'مسح جميع الطلاب ودرجاتهم وحضورهم وتقاريرهم' },
  { key: 'delete_all_teachers', label: 'حذف جميع المعلمين', icon: <School />, color: '#c62828', desc: 'مسح جميع المعلمين والجداول والتقارير المرتبطة بهم' },
  { key: 'delete_all_schedules', label: 'حذف الجداول', icon: <Schedule />, color: '#6a1b9a', desc: 'مسح جميع جداول الحصص' },
  { key: 'delete_all_announcements', label: 'حذف جميع الإعلانات', icon: <Campaign />, color: '#283593', desc: 'مسح جميع الإعلانات' },
  { key: 'new_semester', label: 'بداية فصل دراسي جديد', icon: <RestartAlt />, color: '#00897b', desc: 'مسح الدرجات والحضور والجداول والتقارير والتسجيلات' },
];

const roleLabels: Record<string, string> = {
  admin: 'مدير النظام',
  middle_supervisor: 'مشرف متوسط',
  high_supervisor: 'مشرف ثانوي',
  middle_teacher: 'معلم متوسط',
  high_teacher: 'معلم ثانوي',
  middle_counselor: 'مرشد طلابي - متوسط',
  high_counselor: 'مرشد طلابي - ثانوي',
  middle_principal: 'مدير مدرسة - متوسط',
  high_principal: 'مدير مدرسة - ثانوي',
};

const roleColors: Record<string, string> = {
  admin: 'error',
  middle_supervisor: 'primary',
  high_supervisor: 'secondary',
  middle_teacher: 'info',
  high_teacher: 'success',
  middle_counselor: 'warning',
  high_counselor: 'warning',
  middle_principal: 'secondary',
  high_principal: 'error',
};

export default function AdminPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState(0);

  // Bulk actions state
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // User management state
  const [users, setUsers] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');
  const [userDialog, setUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userForm, setUserForm] = useState({ email: '', password: '', role: 'middle_teacher', status: 'active', teacher_id: '' });
  const [userSaving, setUserSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [passwordDialog, setPasswordDialog] = useState<{ user: any } | null>(null);
  const [passwordForm, setPasswordForm] = useState({ password: '', show: false });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Permissions management state
  const [permUser, setPermUser] = useState('');
  const [permData, setPermData] = useState<{ role_defaults: string[]; custom_permissions: string[] | null; has_custom: boolean } | null>(null);
  const [permToggles, setPermToggles] = useState<Record<string, boolean>>({});
  const [permLoading, setPermLoading] = useState(false);
  const [permError, setPermError] = useState('');
  const [permSuccess, setPermSuccess] = useState('');

  // Backup state
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [backupSuccess, setBackupSuccess] = useState('');
  const [backupStats, setBackupStats] = useState<Record<string, number> | null>(null);

  if (!user) return null;
  if (user.role !== 'admin') {
    router.push('/dashboard');
    return null;
  }

  const fetchUsers = async () => {
    if (!token) return;
    setUserLoading(true);
    try {
      const res = await api.get('/admin/users', token);
      setUsers(res.users || []);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'فشل في جلب الحسابات');
    } finally {
      setUserLoading(false);
    }
  };

  const fetchTeachers = async () => {
    if (!token) return;
    try {
      const res = await api.get('/teachers?limit=500', token);
      setTeachers(res.teachers || []);
    } catch { /* ignore teacher fetch errors */ }
  };

  useEffect(() => {
    if (token && tab === 1) {
      fetchUsers();
      fetchTeachers();
    }
    if (token && tab === 2) {
      fetchUsers();
    }
  }, [token, tab]);

  const loadPermissions = async (userId: string) => {
    if (!token || !userId) return;
    setPermLoading(true);
    setPermError('');
    setPermSuccess('');
    try {
      const res = await api.get(`/admin/permissions?user_id=${userId}`, token);
      setPermData(res);
      const toggles: Record<string, boolean> = {};
      const enabled = res.custom_permissions || res.role_defaults || [];
      for (const p of allPermissions) {
        toggles[p] = enabled.includes(p);
      }
      setPermToggles(toggles);
    } catch {
      setPermError('فشل في تحميل الصلاحيات');
    } finally {
      setPermLoading(false);
    }
  };

  const handlePermUserChange = async (userId: string) => {
    setPermUser(userId);
    setPermData(null);
    setPermToggles({});
    if (userId) {
      await loadPermissions(userId);
    }
  };

  const handleTogglePermission = (perm: string) => {
    setPermToggles((prev) => ({ ...prev, [perm]: !prev[perm] }));
  };

  const handleSavePermissions = async () => {
    if (!token || !permUser) return;
    setPermLoading(true);
    setPermError('');
    setPermSuccess('');
    try {
      const enabled = Object.entries(permToggles).filter(([, v]) => v).map(([k]) => k);
      await api.put('/admin/permissions', { user_id: parseInt(permUser), permissions: enabled }, token);
      await loadPermissions(permUser);
      setPermSuccess('تم حفظ الصلاحيات بنجاح');
    } catch {
      setPermError('فشل في حفظ الصلاحيات');
    } finally {
      setPermLoading(false);
    }
  };

  const handleResetPermissions = async () => {
    if (!token || !permUser) return;
    setPermLoading(true);
    setPermError('');
    setPermSuccess('');
    try {
      await api.put('/admin/permissions', { user_id: parseInt(permUser), permissions: [] }, token);
      await loadPermissions(permUser);
      setPermSuccess('تم إعادة تعيين الصلاحيات إلى الإعدادات الافتراضية');
    } catch {
      setPermError('فشل في إعادة تعيين الصلاحيات');
    } finally {
      setPermLoading(false);
    }
  };

  const handleBulkConfirm = async () => {
    if (!token || !confirmAction) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post('/admin/bulk-delete', { action: confirmAction }, token);
      setResult({ type: 'success', message: res.message || 'تمت العملية بنجاح' });
      setConfirmAction(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشلت العملية';
      setResult({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const currentAction = actions.find(a => a.key === confirmAction);

  const handleOpenUserDialog = (u: any = null) => {
    setEditingUser(u);
    setUserForm({
      email: u?.email || '',
      password: '',
      role: u?.role || 'middle_teacher',
      status: u?.status || 'active',
      teacher_id: u?.teacher_id ? String(u.teacher_id) : '',
    });
    setUserDialog(true);
    setUserError('');
    setUserSuccess('');
  };

  const handleSaveUser = async () => {
    if (!token) return;
    setUserSaving(true);
    setUserError('');
    setUserSuccess('');
    try {
      if (editingUser) {
        const body: any = {};
        if (userForm.email !== editingUser.email) body.email = userForm.email;
        if (userForm.password) body.password = userForm.password;
        if (userForm.role !== editingUser.role) body.role = userForm.role;
        if (userForm.status !== editingUser.status) body.status = userForm.status;
        const teacherIdInt = userForm.teacher_id ? parseInt(userForm.teacher_id) : null;
        const oldTeacherId = editingUser.teacher_id || null;
        if (teacherIdInt !== oldTeacherId) body.teacher_id = teacherIdInt;
        await api.put(`/admin/users?id=${editingUser.id}`, body, token);
      } else {
        await api.post('/admin/users', {
          email: userForm.email,
          password: userForm.password,
          role: userForm.role,
          teacher_id: userForm.teacher_id ? parseInt(userForm.teacher_id) : null,
        }, token);
        setCreatedCredentials({ email: userForm.email, password: userForm.password });
      }
      setUserSuccess(editingUser ? 'تم تحديث الحساب بنجاح' : 'تم إنشاء الحساب بنجاح');
      setUserDialog(false);
      fetchUsers();
    } catch (err: unknown) {
      setUserError(err instanceof Error ? err.message : 'فشلت العملية');
    } finally {
      setUserSaving(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!token) return;
    try {
      await api.delete(`/admin/users?id=${id}`, token);
      setUserSuccess('تم حذف الحساب');
      setDeleteConfirm(null);
      fetchUsers();
    } catch (err: unknown) {
      setUserError(err instanceof Error ? err.message : 'فشل الحذف');
    }
  };

  const unlinkedTeachers = teachers.filter((t: any) => {
    if (editingUser?.teacher_id === t.id) return true;
    return !users.some((u: any) => u.teacher_id === t.id);
  });

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const nameMatch = u.first_name ? `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) : false;
      if (!u.email.toLowerCase().includes(q) && !nameMatch) return false;
    }
    return true;
  });

  const paginatedUsers = filteredUsers.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  const handlePasswordReset = async () => {
    if (!token || !passwordDialog || !passwordForm.password) return;
    if (passwordForm.password.length < 6) { setUserError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    try {
      await api.put(`/admin/users?id=${passwordDialog.user.id}`, { password: passwordForm.password }, token);
      setUserSuccess(`تم تغيير كلمة المرور للحساب: ${passwordDialog.user.email}\nكلمة المرور الجديدة: ${passwordForm.password}`);
      setPasswordDialog(null);
      setPasswordForm({ password: '', show: false });
    } catch { setUserError('فشل تغيير كلمة المرور'); }
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let pwd = '';
    for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setPasswordForm({ ...passwordForm, password: pwd, show: true });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setUserSuccess('تم النسخ إلى الحافظة');
    } catch { setUserError('فشل النسخ'); }
  };

  const handleExportUsers = () => {
    const rows = filteredUsers.map((u) => [
      u.email,
      u.first_name ? `${u.first_name} ${u.last_name}` : '—',
      roleLabels[u.role] || u.role,
      u.role.startsWith('middle') ? 'متوسطة' : u.role.startsWith('high') ? 'ثانوية' : '—',
      u.status === 'active' ? 'نشط' : 'غير نشط',
      u.created_at ? new Date(u.created_at).toLocaleDateString('ar-EG') : '—',
    ]);
    exportToExcel(
      ['اسم المستخدم', 'المعلم', 'الدور', 'المرحلة', 'الحالة', 'تاريخ الإنشاء'],
      rows, 'الحسابات', 'users_صفوة_الرواد.xlsx'
    );
    setUserSuccess('تم تصدير الحسابات بنجاح');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <AutoStories sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" fontWeight="bold">إدارة النظام</Typography>
        <Chip label="مدير فقط" size="small" color="error" />
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab icon={<DeleteSweep />} label="إجراءات جماعية" iconPosition="start" />
        <Tab icon={<ManageAccounts />} label="إدارة الحسابات" iconPosition="start" />
        <Tab icon={<Security />} label="الصلاحيات" iconPosition="start" />
        <Tab icon={<CloudDownload />} label="النسخ الاحتياطي" iconPosition="start" />
        <Tab icon={<CalendarToday />} label="الجدول الدراسي" iconPosition="start" />
        <Tab icon={<GroupAdd />} label="أولياء الأمور" iconPosition="start" />
      </Tabs>

      {tab === 0 && (
        <>
          {result && (
            <Alert severity={result.type} sx={{ mb: 2 }} onClose={() => setResult(null)}>
              {result.message}
            </Alert>
          )}

          <Paper sx={{ p: 3, mb: 3, bgcolor: '#fff3e0', border: '1px solid #ffe0b2', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Warning color="warning" />
              <Typography variant="h6" fontWeight="bold" color="warning.dark">منطقة الخطر</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              هذه الإجراءات لا يمكن التراجع عنها. يرجى التأكد قبل تنفيذ أي عملية.
            </Typography>
          </Paper>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {actions.map((a) => (
              <Paper key={a.key} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderRadius: 2, borderRight: `4px solid ${a.color}`, '&:hover': { boxShadow: 3 }, transition: '0.2s' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ color: a.color, display: 'flex' }}>{a.icon}</Box>
                  <Box>
                    <Typography fontWeight="bold">{a.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{a.desc}</Typography>
                  </Box>
                </Box>
                <Button variant="outlined" color="error" size="small" onClick={() => setConfirmAction(a.key)} startIcon={<DeleteSweep />}>تنفيذ</Button>
              </Paper>
            ))}
          </Box>

          <Dialog open={!!confirmAction} onClose={() => !loading && setConfirmAction(null)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Warning color="warning" />{currentAction?.label}
            </DialogTitle>
            <DialogContent>
              <Typography sx={{ mb: 2 }}>هل أنت متأكد من تنفيذ هذه العملية؟</Typography>
              <Alert severity="warning" icon={<Warning />}>
                <Typography variant="body2" fontWeight="bold">{currentAction?.desc}</Typography>
                <Typography variant="caption">هذا الإجراء لا يمكن التراجع عنه.</Typography>
              </Alert>
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1 }}>
              <Button onClick={() => setConfirmAction(null)} disabled={loading}>إلغاء</Button>
              <Button variant="contained" color="error" onClick={handleBulkConfirm} disabled={loading} startIcon={<DeleteSweep />}>
                {loading ? 'جاري التنفيذ...' : 'تأكيد الحذف'}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}

      {tab === 1 && (
        <>
          {userError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUserError('')}>{userError}</Alert>}
          {userSuccess && <Alert severity="success" sx={{ mb: 2, whiteSpace: 'pre-wrap' }} onClose={() => setUserSuccess('')}>{userSuccess}</Alert>}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                size="small" placeholder="بحث عن مستخدم..."
                value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                InputProps={{ startAdornment: <Search fontSize="small" sx={{ ml: 0.5, opacity: 0.5 }} /> }}
                sx={{ minWidth: 220 }}
              />
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>المرحلة</InputLabel>
                <Select value={roleFilter} label="المرحلة" onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}>
                  <MenuItem value="all">الكل</MenuItem>
                  <MenuItem value="middle_supervisor">مشرف متوسط</MenuItem>
                  <MenuItem value="high_supervisor">مشرف ثانوي</MenuItem>
                  <MenuItem value="middle_teacher">معلم متوسط</MenuItem>
                  <MenuItem value="high_teacher">معلم ثانوي</MenuItem>
                  <MenuItem value="middle_counselor">مرشد متوسط</MenuItem>
                  <MenuItem value="high_counselor">مرشد ثانوي</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" startIcon={<FileDownload />} onClick={handleExportUsers} disabled={filteredUsers.length === 0}>تصدير Excel</Button>
              <Button variant="outlined" startIcon={<Refresh />} onClick={fetchUsers}>تحديث</Button>
              <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenUserDialog()}>إضافة حساب</Button>
            </Box>
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small" dir="rtl">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>اسم المستخدم</TableCell>
                  <TableCell>المعلم المرتبط</TableCell>
                  <TableCell>الدور / المرحلة</TableCell>
                  <TableCell>الحالة</TableCell>
                  <TableCell>تاريخ الإنشاء</TableCell>
                  <TableCell align="center">إجراءات</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {userLoading ? (
                  <TableRow><TableCell colSpan={7} align="center"><CircularProgress size={24} sx={{ my: 2 }} /></TableCell></TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center">لا يوجد حسابات مطابقة</TableCell></TableRow>
                ) : (
                  paginatedUsers.map((u, idx) => (
                    <TableRow key={u.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                      <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                      <TableCell dir="ltr" sx={{ textAlign: 'right' }}>{u.email}</TableCell>
                      <TableCell>{u.first_name ? `${u.first_name} ${u.last_name}` : '—'}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          <Chip label={roleLabels[u.role] || u.role} size="small" color={(roleColors[u.role] as any) || 'default'} />
                          <Chip
                            label={u.role.startsWith('middle') ? 'متوسطة' : u.role.startsWith('high') ? 'ثانوية' : '—'}
                            size="small" variant="outlined"
                            color={u.role.startsWith('middle') ? 'info' : u.role.startsWith('high') ? 'warning' : 'default'}
                            sx={{ height: 20, '& .MuiChip-label': { fontSize: 11 } }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={u.status === 'active' ? 'نشط' : 'غير نشط'} size="small"
                          color={u.status === 'active' ? 'success' : 'default'}
                          onClick={() => {
                            if (u.role === 'admin') return;
                            setEditingUser(u);
                            setUserForm({ email: u.email, password: '', role: u.role, status: u.status === 'active' ? 'inactive' : 'active', teacher_id: u.teacher_id ? String(u.teacher_id) : '' });
                            (async () => {
                              if (!token) return;
                              try {
                                await api.put(`/admin/users?id=${u.id}`, { status: u.status === 'active' ? 'inactive' : 'active' }, token);
                                setUserSuccess(u.status === 'active' ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب');
                                fetchUsers();
                              } catch { setUserError('فشل تغيير الحالة'); }
                            })();
                          }}
                          sx={{ cursor: u.role !== 'admin' ? 'pointer' : 'default' }}
                        />
                      </TableCell>
                      <TableCell>{u.created_at ? new Date(u.created_at).toLocaleDateString('ar-EG') : '—'}</TableCell>
                      <TableCell align="center">
                        <IconButton size="small" color="primary" onClick={() => handleOpenUserDialog(u)}><Edit fontSize="small" /></IconButton>
                        <IconButton size="small" sx={{ color: '#ed6c02' }} onClick={() => { setPasswordDialog({ user: u }); setPasswordForm({ password: '', show: false }); }}><LockReset fontSize="small" /></IconButton>
                        {u.role !== 'admin' && (
                          <IconButton size="small" color="error" onClick={() => setDeleteConfirm(u.id)}><Delete fontSize="small" /></IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {filteredUsers.length > rowsPerPage && (
            <TablePagination
              component="div"
              count={filteredUsers.length}
              page={page} onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              labelRowsPerPage="عدد الصفوف"
            />
          )}

          <Dialog open={userDialog} onClose={() => !userSaving && setUserDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle>{editingUser ? 'تعديل الحساب' : 'إضافة حساب جديد'}</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                <TextField fullWidth label="اسم المستخدم" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
                <TextField fullWidth label={editingUser ? 'كلمة المرور الجديدة (اترك فارغًا بدون تغيير)' : 'كلمة المرور'} type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
                <FormControl fullWidth>
                  <InputLabel>الدور</InputLabel>
                  <Select value={userForm.role} label="الدور" onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                    {Object.entries(roleLabels).filter(([k]) => k !== 'admin').map(([val, label]) => (
                      <MenuItem key={val} value={val}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {editingUser && (
                  <FormControl fullWidth>
                    <InputLabel>الحالة</InputLabel>
                    <Select value={userForm.status} label="الحالة" onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}>
                      <MenuItem value="active">نشط</MenuItem>
                      <MenuItem value="inactive">غير نشط</MenuItem>
                    </Select>
                  </FormControl>
                )}
                <FormControl fullWidth>
                  <InputLabel>ربط مع معلم</InputLabel>
                  <Select value={userForm.teacher_id} label="ربط مع معلم" onChange={(e) => setUserForm({ ...userForm, teacher_id: e.target.value })}>
                    <MenuItem value="">بدون ربط</MenuItem>
                    {unlinkedTeachers.map((t: any) => (
                      <MenuItem key={t.id} value={String(t.id)}>{t.first_name} {t.last_name} ({t.teacher_id})</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1 }}>
              <Button onClick={() => setUserDialog(false)} disabled={userSaving}>إلغاء</Button>
              <Button variant="contained" onClick={handleSaveUser} disabled={userSaving || !userForm.email || (!editingUser && !userForm.password)}>
                {userSaving ? 'جاري الحفظ...' : editingUser ? 'تحديث' : 'إنشاء'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Credentials display dialog */}
          <Dialog open={!!createdCredentials} onClose={() => setCreatedCredentials(null)} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ManageAccounts color="success" />
              تم إنشاء الحساب بنجاح
            </DialogTitle>
            <DialogContent>
              <Typography variant="body2" gutterBottom>بيانات تسجيل الدخول للمستخدم الجديد:</Typography>
              <Paper variant="outlined" sx={{ p: 2, mt: 1, mb: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
                <Typography variant="body2" dir="ltr" sx={{ textAlign: 'right', mb: 1 }}>
                  <strong>البريد الإلكتروني:</strong> {createdCredentials?.email}
                </Typography>
                <Typography variant="body2" dir="ltr" sx={{ textAlign: 'right' }}>
                  <strong>كلمة المرور:</strong> {createdCredentials?.password}
                </Typography>
              </Paper>
              <Button
                variant="outlined" size="small" startIcon={<ContentCopy />}
                onClick={() => copyToClipboard(`البريد: ${createdCredentials?.email}\nكلمة المرور: ${createdCredentials?.password}`)}
              >
                نسخ بيانات الدخول
              </Button>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button variant="contained" onClick={() => setCreatedCredentials(null)}>حسناً</Button>
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
                الحساب: <strong>{passwordDialog?.user?.email}</strong>
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
                  {passwordForm.show ? <VisibilityOff /> : <Visibility />}
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

          <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Warning color="error" />تأكيد حذف الحساب
            </DialogTitle>
            <DialogContent>
              <Typography>هل أنت متأكد من حذف هذا الحساب؟ لا يمكن التراجع عن هذا الإجراء.</Typography>
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1 }}>
              <Button onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
              <Button variant="contained" color="error" onClick={() => handleDeleteUser(deleteConfirm!)}>حذف</Button>
            </DialogActions>
          </Dialog>
        </>
      )}
      {tab === 2 && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <FormControl sx={{ minWidth: 250 }}>
              <InputLabel>اختر مستخدم</InputLabel>
              <Select value={permUser} label="اختر مستخدم" onChange={(e) => handlePermUserChange(e.target.value)}>
                {users.map((u: any) => (
                  <MenuItem key={u.id} value={String(u.id)}>
                    {u.email} — {roleLabels[u.role] || u.role}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {permUser && permData && (
              <>
                <Chip
                  label={permData.has_custom ? 'صلاحيات مخصصة' : 'صلاحيات افتراضية'}
                  color={permData.has_custom ? 'warning' : 'success'}
                />
                <Button variant="outlined" color="warning" onClick={handleResetPermissions} disabled={permLoading}>
                  إعادة تعيين
                </Button>
              </>
            )}
          </Box>

          {permError && <Alert severity="error" sx={{ mb: 2 }}>{permError}</Alert>}
          {permSuccess && <Alert severity="success" sx={{ mb: 2 }}>{permSuccess}</Alert>}

          {permLoading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}

          {permUser && permData && !permLoading && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="contained" onClick={handleSavePermissions} disabled={permLoading}>
                  {permLoading ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
                </Button>
              </Box>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                {permissionGroups.map((group) => (
                  <Box key={group.label} sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ p: 2, pb: 1 }}>
                      {group.label}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, px: 2 }}>
                      {group.keys.map((perm) => (
                        <Chip
                          key={perm}
                          label={permissionLabels[perm] || perm}
                          variant={permToggles[perm] ? 'filled' : 'outlined'}
                          color={permToggles[perm] ? 'primary' : 'default'}
                          onClick={() => handleTogglePermission(perm)}
                          sx={{ cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
                        />
                      ))}
                    </Box>
                  </Box>
                ))}
              </TableContainer>
            </>
          )}

          {!permUser && !permLoading && (
            <Paper sx={{ p: 6, textAlign: 'center' }}>
              <Security sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">اختر مستخدمًا من القائمة أعلاه لإدارة صلاحياته</Typography>
            </Paper>
          )}
        </>
      )}
      {tab === 3 && (
        <>
          {backupError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setBackupError('')}>{backupError}</Alert>}
          {backupSuccess && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setBackupSuccess('')}>{backupSuccess}</Alert>}

          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {/* Export card */}
            <Paper sx={{ flex: 1, minWidth: 280, p: 3, borderRadius: 3, borderTop: '4px solid #2e7d32' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <CloudDownload sx={{ fontSize: 40, color: '#2e7d32' }} />
                <Box>
                  <Typography variant="h6" fontWeight="bold">تصدير نسخة احتياطية</Typography>
                  <Typography variant="body2" color="text.secondary">تحميل جميع بيانات النظام كملف JSON</Typography>
                </Box>
              </Box>
              <Button
                variant="contained" color="success" size="large" fullWidth
                disabled={backupLoading}
                onClick={async () => {
                  if (!token) return;
                  setBackupLoading(true);
                  setBackupError('');
                  setBackupSuccess('');
                  try {
                    const res = await fetch('/api/backup/export', { headers: { Authorization: `Bearer ${token}` } });
                    if (!res.ok) { setBackupError('فشل التصدير'); return; }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `safwa-backup-${new Date().toISOString().split('T')[0]}.json`;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                    setBackupSuccess('تم تصدير النسخة الاحتياطية بنجاح');
                  } catch { setBackupError('فشل الاتصال بالخادم'); }
                  finally { setBackupLoading(false); }
                }}
                startIcon={<CloudDownload />}
              >
                {backupLoading ? 'جاري التصدير...' : 'تصدير الآن'}
              </Button>
            </Paper>

            {/* Import card */}
            <Paper sx={{ flex: 1, minWidth: 280, p: 3, borderRadius: 3, borderTop: '4px solid #e65100' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <CloudUpload sx={{ fontSize: 40, color: '#e65100' }} />
                <Box>
                  <Typography variant="h6" fontWeight="bold">استيراد نسخة احتياطية</Typography>
                  <Typography variant="body2" color="text.secondary">استعادة البيانات من ملف JSON</Typography>
                </Box>
              </Box>
              <input
                type="file" accept=".json"
                id="backup-file-input"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !token) return;
                  setBackupLoading(true);
                  setBackupError('');
                  setBackupSuccess('');
                  setBackupStats(null);
                  try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    const res = await api.post('/backup/import', data, token);
                    setBackupSuccess(res.message || 'تم الاستيراد بنجاح');
                    setBackupStats(res.stats || null);
                  } catch (err: unknown) {
                    setBackupError(err instanceof Error ? err.message : 'فشل الاستيراد');
                  }
                  finally { setBackupLoading(false); }
                }}
              />
              <Button
                variant="contained" color="warning" size="large" fullWidth
                disabled={backupLoading}
                onClick={() => document.getElementById('backup-file-input')?.click()}
                startIcon={<CloudUpload />}
              >
                {backupLoading ? 'جاري الاستيراد...' : 'اختيار ملف واستيراد'}
              </Button>
              <Alert severity="warning" sx={{ mt: 2 }} icon={<Warning />}>
                <Typography variant="caption">
                  الاستيراد سيحل محل جميع البيانات الموجودة. يُنصح بعمل نسخة احتياطية أولاً.
                </Typography>
              </Alert>
            </Paper>
          </Box>

          {backupStats && (
            <Paper sx={{ mt: 3, p: 3, borderRadius: 3 }}>
              <Typography variant="h6" fontWeight="bold" mb={2}>إحصائيات الاستيراد</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1 }}>
                {Object.entries(backupStats).map(([table, count]) => (
                  <Box key={table} sx={{ display: 'flex', justifyContent: 'space-between', p: 1, bgcolor: (count || 0) > 0 ? 'success.50' : 'grey.50', borderRadius: 1 }}>
                    <Typography variant="body2" fontWeight={500}>{table}</Typography>
                    <Typography variant="body2" color={count > 0 ? 'success.main' : 'text.secondary'}>{count} سجل</Typography>
                  </Box>
                ))}
              </Box>
            </Paper>
          )}
        </>
      )}
      {tab === 4 && <AcademicManagement />}
      {tab === 5 && <ParentsManagement />}
    </Box>
  );
}
