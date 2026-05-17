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
  Add, Edit, Delete, Refresh, Search, FileDownload, Security
} from '@mui/icons-material';
import { exportToExcel } from '@/lib/excel';
import { permissionGroups, permissionLabels, allPermissions } from '@/lib/permissions';

const actions = [
  { key: 'delete_all_grades', label: 'حذف جميع الدرجات', icon: <Grade />, color: '#e65100', desc: 'مسح جميع سجلات الدرجات والتقييمات' },
  { key: 'delete_all_classes', label: 'حذف جميع الفصول', icon: <School />, color: '#d32f2f', desc: 'مسح الفصول والجداول والحضور والتقارير والتسجيلات' },
  { key: 'delete_all_reports', label: 'حذف جميع التقارير', icon: <Assessment />, color: '#ed6c02', desc: 'مسح جميع تقارير المعلمين' },
  { key: 'delete_all_teachers', label: 'حذف جميع المعلمين', icon: <People />, color: '#c62828', desc: 'مسح جميع المعلمين والجداول والتقارير المرتبطة بهم' },
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
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Permissions management state
  const [permUser, setPermUser] = useState('');
  const [permData, setPermData] = useState<{ role_defaults: string[]; custom_permissions: string[] | null; has_custom: boolean } | null>(null);
  const [permToggles, setPermToggles] = useState<Record<string, boolean>>({});
  const [permLoading, setPermLoading] = useState(false);
  const [permError, setPermError] = useState('');
  const [permSuccess, setPermSuccess] = useState('');

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
    } catch {
      setUserError('فشل في جلب الحسابات');
    } finally {
      setUserLoading(false);
    }
  };

  const fetchTeachers = async () => {
    if (!token) return;
    try {
      const res = await api.get('/teachers?limit=500', token);
      setTeachers(res.teachers || []);
    } catch { /* */ }
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
          {userSuccess && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setUserSuccess('')}>{userSuccess}</Alert>}

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
            <Table size="small">
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
    </Box>
  );
}
