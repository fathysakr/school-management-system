'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, Alert, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, IconButton, CircularProgress,
  TablePagination, Chip, Tooltip
} from '@mui/material';
import { Add, Edit, Delete, Refresh, Search, Link as LinkIcon, PersonAdd } from '@mui/icons-material';

export default function ParentsManagement() {
  const { token } = useAuth();
  const [parents, setParents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialog, setDialog] = useState(false);
  const [editingParent, setEditingParent] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [linkDialog, setLinkDialog] = useState(false);
  const [linkParent, setLinkParent] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  const fetchParents = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/parents', token);
      setParents(res.parents || []);
    } catch {
      setError('فشل في جلب أولياء الأمور');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchParents(); }, [fetchParents]);

  const openCreateDialog = () => {
    setEditingParent(null);
    setForm({ name: '', email: '', phone: '', password: '' });
    setDialog(true);
  };

  const openEditDialog = (parent: any) => {
    setEditingParent(parent);
    setForm({ name: parent.name, email: parent.email, phone: parent.phone || '', password: '' });
    setDialog(true);
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (editingParent) {
        const body: any = { name: form.name, email: form.email, phone: form.phone || null };
        if (form.password) body.password = form.password;
        await api.put(`/admin/parents/${editingParent.id}`, body, token);
        setSuccess('تم تحديث بيانات ولي الأمر بنجاح');
      } else {
        await api.post('/admin/parents', form, token);
        setSuccess('تم إنشاء حساب ولي الأمر بنجاح');
      }
      setDialog(false);
      await fetchParents();
    } catch (e: any) {
      setError(e?.message || 'فشل في حفظ بيانات ولي الأمر');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.delete(`/admin/parents/${id}`, token);
      setSuccess('تم حذف حساب ولي الأمر بنجاح');
      setDeleteConfirm(null);
      await fetchParents();
    } catch (e: any) {
      setError(e?.message || 'فشل في حذف ولي الأمر');
    } finally {
      setSaving(false);
    }
  };

  const openLinkDialog = async (parent: any) => {
    setLinkParent(parent);
    setStudentSearch('');
    setLinkDialog(true);
    setStudentsLoading(true);
    try {
      const res = await api.get('/students?limit=200', token!);
      setStudents(res.students || []);
    } catch {
      setError('فشل في جلب الطلاب');
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleLinkStudent = async (student: any) => {
    if (!token || !linkParent) return;
    try {
      await api.put(`/students/${student.id}`, { parent_email: linkParent.email, parent_phone: linkParent.phone || null }, token);
      setSuccess(`تم ربط الطالب ${student.first_name} ${student.last_name} بـ ${linkParent.name}`);
      setLinkDialog(false);
      await fetchParents();
    } catch (e: any) {
      setError(e?.message || 'فشل في ربط الطالب');
    }
  };

  const filtered = parents.filter(p =>
    !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone?.includes(searchQuery)
  );

  const paginated = filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" fontWeight="bold">أولياء الأمور</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField size="small" placeholder="بحث..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(0); }} sx={{ width: 220 }} InputProps={{ startAdornment: <Search sx={{ ml: 1, color: 'text.secondary' }} /> }} />
          <Button variant="contained" startIcon={<Refresh />} onClick={fetchParents}>تحديث</Button>
          <Button variant="contained" startIcon={<Add />} onClick={openCreateDialog}>إضافة ولي أمر</Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {filtered.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <PersonAdd sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography color="text.secondary">لا يوجد أولياء أمور. أضف ولي أمر جديد</Typography>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <TableContainer>
            <Table dir="rtl">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>الاسم</TableCell>
                  <TableCell>البريد الإلكتروني</TableCell>
                  <TableCell>الجوال</TableCell>
                  <TableCell>الطلاب المرتبطون</TableCell>
                  <TableCell>تاريخ التسجيل</TableCell>
                  <TableCell>إجراءات</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginated.map((p, i) => (
                  <TableRow key={p.id} hover>
                    <TableCell>{page * rowsPerPage + i + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{p.name}</TableCell>
                    <TableCell dir="ltr">{p.email}</TableCell>
                    <TableCell dir="ltr">{p.phone || '-'}</TableCell>
                    <TableCell>
                      <Chip label={p.linked_students || 0} size="small" color={p.linked_students > 0 ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell>{p.created_at ? new Date(p.created_at).toLocaleDateString('ar-SA') : '-'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="ربط طالب"><IconButton size="small" color="primary" onClick={() => openLinkDialog(p)}><LinkIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="تعديل"><IconButton size="small" color="primary" onClick={() => openEditDialog(p)}><Edit fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="حذف"><IconButton size="small" color="error" onClick={() => setDeleteConfirm(p.id)}><Delete fontSize="small" /></IconButton></Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={filtered.length} page={page} onPageChange={(_, v) => setPage(v)} rowsPerPage={rowsPerPage} onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }} labelRowsPerPage="عدد الصفوف" />
        </Paper>
      )}

      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingParent ? 'تعديل ولي أمر' : 'إضافة ولي أمر جديد'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="الاسم" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <TextField label="البريد الإلكتروني" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <TextField label="رقم الجوال" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="05xxxxxxxx" />
            <TextField label={editingParent ? 'كلمة المرور (اتركها فارغة إذا لا تريد التغيير)' : 'كلمة المرور'} type="password" required={!editingParent} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name || !form.email || (!editingParent && !form.password)}>
            {saving ? 'جاري الحفظ...' : editingParent ? 'حفظ التغييرات' : 'إنشاء الحساب'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>تأكيد الحذف</DialogTitle>
        <DialogContent>
          <Typography>هل أنت متأكد من حذف حساب ولي الأمر هذا؟</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
          <Button variant="contained" color="error" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} disabled={saving}>
            {saving ? 'جاري الحذف...' : 'حذف'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={linkDialog} onClose={() => setLinkDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>ربط طالب بـ {linkParent?.name}</DialogTitle>
        <DialogContent>
          <TextField fullWidth size="small" placeholder="ابحث عن طالب..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} sx={{ mb: 2, mt: 1 }} InputProps={{ startAdornment: <Search sx={{ ml: 1, color: 'text.secondary' }} /> }} />
          {studentsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
          ) : (
            <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
              {students
                .filter((s: any) => !studentSearch || `${s.first_name} ${s.last_name} ${s.student_id}`.includes(studentSearch))
                .map((s: any) => (
                  <Paper key={s.id} variant="outlined" sx={{ p: 1.5, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }} onClick={() => handleLinkStudent(s)}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{s.first_name} {s.last_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.student_id}</Typography>
                      {s.parent_email && <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>| ولي أمر: {s.parent_email}</Typography>}
                    </Box>
                    <Button size="small" variant="outlined">ربط</Button>
                  </Paper>
                ))}
              {students.filter((s: any) => !studentSearch || `${s.first_name} ${s.last_name} ${s.student_id}`.includes(studentSearch)).length === 0 && (
                <Typography color="text.secondary" sx={{ textAlign: 'center', p: 2 }}>لا يوجد طلاب</Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialog(false)}>إغلاق</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
