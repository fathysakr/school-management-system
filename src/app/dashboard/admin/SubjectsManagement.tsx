'use client';
import { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Chip, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton
} from '@mui/material';
import { Add, Delete, Edit, Book } from '@mui/icons-material';
import { api } from '@/lib/api';

export default function SubjectsManagement() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const teachingTeachers = teachers.filter((t: any) => !t.user_role || t.user_role.includes('teacher'));
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', school: 'high', grade: '', sessions_per_week: 3, teacher_id: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('high');

  const loadData = () => {
    const token = localStorage.getItem('token');
    let cancelled = false;
    api.get(`/subjects?school=${schoolFilter}`, token).then((s: any) => {
      if (!cancelled) setSubjects(s.subjects || []);
    }).catch(() => {
      if (!cancelled) setMessage('فشل تحميل البيانات');
    });
    api.get('/teachers?limit=500', token).then((t: any) => {
      if (!cancelled) setTeachers(t.teachers || []);
    }).catch(() => {});
    setLoading(false);
  };

  useEffect(() => { loadData() }, [schoolFilter]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', school: schoolFilter, grade: '', sessions_per_week: 3, teacher_id: '' });
    setDialogOpen(true);
  };

  const openEdit = (sub: any) => {
    setEditing(sub);
    setForm({ name: sub.name, school: sub.school, grade: sub.grade || '', sessions_per_week: sub.sessions_per_week, teacher_id: sub.teacher_id ? String(sub.teacher_id) : '' });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name) { setMessage('اسم المادة مطلوب'); return; }
    setSaving(true);
    setMessage('');
    const token = localStorage.getItem('token');
    try {
      if (editing) {
        await api.put(`/subjects?id=${editing.id}`, form, token);
      } else {
        await api.post('/subjects', form, token);
      }
      setMessage(editing ? 'تم تحديث المادة' : 'تم إضافة المادة');
      setDialogOpen(false);
      loadData();
    } catch (e: any) {
      setMessage(e?.message || 'فشل الحفظ');
    }
    setSaving(false);
  };

  const del = async (id: number) => {
    if (!confirm('تأكيد حذف المادة؟')) return;
    const token = localStorage.getItem('token');
    try {
      await api.delete(`/subjects?id=${id}`, token);
      loadData();
    } catch (e: any) {
      setMessage(e?.message || 'فشل الحذف');
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Book /> إدارة المواد الدراسية
      </Typography>
      <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
        <Chip label="ثانوي" color={schoolFilter === 'high' ? 'primary' : 'default'} onClick={() => setSchoolFilter('high')} />
        <Chip label="متوسط" color={schoolFilter === 'middle' ? 'primary' : 'default'} onClick={() => setSchoolFilter('middle')} />
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" startIcon={<Add />} onClick={openAdd}>أضيف مادة</Button>
      </Box>
      {message && <Alert severity={message.includes('فشل') ? 'error' : 'success'} sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}
      <TableContainer component={Paper}>
        <Table dir="rtl">
          <TableHead>
            <TableRow>
              <TableCell>المادة</TableCell>
              <TableCell>الصف</TableCell>
              <TableCell>عدد الحصص</TableCell>
              <TableCell>المعلم المكلف</TableCell>
              <TableCell>إجراءات</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {subjects.map((s: any) => {
              const teacher = teachers.find((t: any) => t.id === s.teacher_id);
              return (
                <TableRow key={s.id}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.grade || (s.school === 'high' ? 'ثانوي' : 'متوسط')}</TableCell>
                  <TableCell>{s.sessions_per_week}</TableCell>
                  <TableCell>{teacher ? `${teacher.first_name} ${teacher.last_name}` : '—'}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => openEdit(s)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => del(s.id)}><Delete fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'تعديل المادة' : 'إضافة مادة جديدة'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="اسم المادة" fullWidth value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <FormControl fullWidth>
              <InputLabel>المرحلة</InputLabel>
              <Select value={form.school} label="المرحلة" onChange={(e) => setForm({ ...form, school: e.target.value })}>
                <MenuItem value="high">ثانوي</MenuItem>
                <MenuItem value="middle">متوسط</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>الصف</InputLabel>
              <Select value={form.grade} label="الصف" onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                <MenuItem value="">بدون (جميع الصفوف)</MenuItem>
                {form.school === 'high' ? (
                  <>
                    <MenuItem value="الصف الأول الثانوي">الصف الأول الثانوي</MenuItem>
                    <MenuItem value="الصف الثاني الثانوي">الصف الثاني الثانوي</MenuItem>
                    <MenuItem value="الصف الثالث الثانوي">الصف الثالث الثانوي</MenuItem>
                  </>
                ) : (
                  <>
                    <MenuItem value="الصف الأول المتوسط">الصف الأول المتوسط</MenuItem>
                    <MenuItem value="الصف الثاني المتوسط">الصف الثاني المتوسط</MenuItem>
                    <MenuItem value="الصف الثالث المتوسط">الصف الثالث المتوسط</MenuItem>
                  </>
                )}
              </Select>
            </FormControl>
            <TextField label="عدد الحصص الأسبوعية" type="number" fullWidth value={form.sessions_per_week}
              onChange={(e) => setForm({ ...form, sessions_per_week: parseInt(e.target.value) || 0 })}
              inputProps={{ min: 0, max: 10 }} />
            <FormControl fullWidth>
              <InputLabel>المعلم المكلف (اختياري)</InputLabel>
              <Select value={form.teacher_id} label="المعلم المكلف (اختياري)" onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}>
                <MenuItem value="">بدون</MenuItem>
                {teachingTeachers.filter((t: any) => t.school === form.school).length === 0 ? <MenuItem disabled>لا يوجد معلمون غير إداريين</MenuItem> : teachingTeachers.filter((t: any) => t.school === form.school).map((t: any) => (
                  <MenuItem key={t.id} value={String(t.id)}>{t.first_name} {t.last_name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>إلغاء</Button>
          <Button variant="contained" onClick={save} disabled={saving} startIcon={editing ? <Edit /> : <Add />}>
            {saving ? <CircularProgress size={20} /> : (editing ? 'تحديث' : 'إضافة')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
