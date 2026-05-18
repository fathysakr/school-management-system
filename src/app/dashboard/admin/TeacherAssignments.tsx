'use client';
import { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Select, MenuItem, FormControl, InputLabel,
  Chip, Button, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Checkbox, ListItemText, OutlinedInput,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import { Assignment, Save, Home } from '@mui/icons-material';
import { api } from '@/lib/api';

export default function TeacherAssignments() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [homeRoom, setHomeRoom] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [schoolFilter, setSchoolFilter] = useState('high');

  useEffect(() => {
    const token = localStorage.getItem('token');
    Promise.all([
      api.get('/teachers?limit=500', token),
      api.get('/classes?limit=500', token),
      api.get(`/subjects?school=${schoolFilter}`, token),
    ]).then(([t, c, s]: any[]) => {
      setTeachers(t.teachers || []);
      setClasses(c.classes || []);
      setSubjects(s.subjects || []);
    }).catch(() => {
      setMessage('فشل تحميل البيانات - تحقق من اتصالك');
    }).finally(() => setLoading(false));
  }, [schoolFilter]);

  const openAssignment = (teacher: any) => {
    setSelectedTeacher(teacher);
    const specNames = teacher.specialization ? teacher.specialization.split(',').map((s: string) => s.trim()) : [];
    const matchedIds = subjects.filter((s: any) => specNames.includes(s.name)).map((s: any) => s.id);
    setSelectedSubjectIds(matchedIds);
    const assigned = classes.filter((c: any) => c.teacher_id === teacher.id);
    setHomeRoom(assigned.length > 0 ? String(assigned[0].id) : '');
    setDialogOpen(true);
    setMessage('');
  };

  const saveAssignment = async () => {
    if (!selectedTeacher) return;
    setSaving(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const subjectNames = selectedSubjectIds.map(id => {
        const sub = subjects.find((s: any) => s.id === id);
        return sub ? sub.name : '';
      }).filter(Boolean).join(', ');
      await api.put(`/teachers/${selectedTeacher.id}`, { specialization: subjectNames }, token);
      const prevHomeRoom = classes.find((c: any) => c.teacher_id === selectedTeacher.id);
      if (homeRoom) {
        await api.put(`/classes/${homeRoom}`, { teacher_id: selectedTeacher.id }, token);
      }
      if (prevHomeRoom && String(prevHomeRoom.id) !== homeRoom) {
        const fallback = teachers.find((t: any) => t.school === selectedTeacher.school && t.id !== selectedTeacher.id) || teachers.find((t: any) => t.school === selectedTeacher.school);
        if (fallback) {
          await api.put(`/classes/${prevHomeRoom.id}`, { teacher_id: fallback.id }, token);
        }
      }
      setMessage('تم حفظ التعيينات بنجاح');
      const t = await api.get('/teachers?limit=500', token);
      const c = await api.get('/classes?limit=500', token);
      setTeachers(t.teachers || []);
      setClasses(c.classes || []);
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('unauthorized') || msg.includes('Unauthorized')) setMessage('صلاحية الوصول منتهية - سجل الدخول مرة أخرى');
      else if (msg.includes('fetch')) setMessage('فشل الاتصال بالخادم');
      else setMessage('فشل الحفظ');
    }
    setSaving(false);
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;

  const gradeColors: Record<string, string> = { 'أول ثانوي': '#1565c0', 'ثاني ثانوي': '#2e7d32', 'ثالث ثانوي': '#e65100' };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Assignment /> تعيين المواد والفصول للمعلمين
      </Typography>
      <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
        <Chip label="ثانوي" color={schoolFilter === 'high' ? 'primary' : 'default'} onClick={() => setSchoolFilter('high')} />
        <Chip label="متوسط" color={schoolFilter === 'middle' ? 'primary' : 'default'} onClick={() => setSchoolFilter('middle')} />
      </Box>
      {message && <Alert severity={message.includes('نجاح') ? 'success' : 'error'} sx={{ mb: 2 }}>{message}</Alert>}
      <TableContainer component={Paper}>
        <Table dir="rtl">
          <TableHead>
            <TableRow>
              <TableCell>المعلم</TableCell>
              <TableCell>المواد</TableCell>
              <TableCell>الفصول المسندة</TableCell>
              <TableCell>رائد فصل</TableCell>
              <TableCell>إجراءات</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {teachers.filter((t: any) => t.school === schoolFilter).map((t: any) => {
              const tClasses = classes.filter((c: any) => c.teacher_id === t.id);
              const subjects = t.specialization ? t.specialization.split(',').map((s: string) => s.trim()) : [];
              return (
                <TableRow key={t.id}>
                  <TableCell>{t.first_name} {t.last_name}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {subjects.map((s: string) => <Chip key={s} label={s} size="small" color="primary" variant="outlined" />)}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {tClasses.map((c: any) => (
                        <Chip key={c.id} label={`${c.class_name} (${c.grade})`} size="small"
                          sx={{ bgcolor: gradeColors[c.grade] || '#666', color: 'white' }} />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {tClasses.filter((c: any) => c.teacher_id === t.id).map((c: any) => (
                      <Chip key={c.id} icon={<Home />} label={c.class_name} size="small" color="secondary" />
                    ))}
                  </TableCell>
                  <TableCell>
                    <Button size="small" variant="outlined" startIcon={<Assignment />} onClick={() => openAssignment(t)}>
                      تعيين
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>تعيين المواد والفصول - {selectedTeacher?.first_name} {selectedTeacher?.last_name}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <FormControl fullWidth>
              <InputLabel>المواد الدراسية</InputLabel>
              <Select multiple value={selectedSubjectIds} onChange={(e) => setSelectedSubjectIds(e.target.value as number[])}
                input={<OutlinedInput label="المواد الدراسية" />} renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((id) => {
                      const sub = subjects.find((s: any) => s.id === id);
                      return sub ? <Chip key={id} label={`${sub.name} (${sub.grade})`} size="small" /> : null;
                    })}
                  </Box>
                )}>
                {subjects.map((s: any) => (
                  <MenuItem key={s.id} value={s.id}>
                    <Checkbox checked={selectedSubjectIds.includes(s.id)} />
                    <ListItemText primary={`${s.name} - ${s.grade || s.school}`} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>رائد الفصل</InputLabel>
              <Select value={homeRoom} onChange={(e) => setHomeRoom(e.target.value)} label="رائد الفصل">
                <MenuItem value="">بدون</MenuItem>
                {classes.filter((c: any) => c.grade?.includes(schoolFilter === 'high' ? 'ثانوي' : 'متوسط')).map((c: any) => (
                  <MenuItem key={c.id} value={String(c.id)}>{c.class_name} - {c.grade}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>إلغاء</Button>
          <Button variant="contained" onClick={saveAssignment} disabled={saving} startIcon={<Save />}>
            {saving ? <CircularProgress size={20} /> : 'حفظ التعيينات'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
