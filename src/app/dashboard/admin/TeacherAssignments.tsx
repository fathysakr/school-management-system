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
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
  const [homeRoom, setHomeRoom] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/teachers?limit=500'),
      api.get('/classes?limit=500'),
      api.get('/subjects?school=high'),
    ]).then(([t, c, s]: any[]) => {
      setTeachers(t.teachers || []);
      setClasses(c.classes || []);
      setSubjects(s.subjects || []);
    }).finally(() => setLoading(false));
  }, []);

  const openAssignment = (teacher: any) => {
    setSelectedTeacher(teacher);
    setSelectedSubjects(teacher.specialization ? teacher.specialization.split(',').map((s: string) => s.trim()) : []);
    const assigned = classes.filter((c: any) => c.teacher_id === teacher.id);
    setSelectedClasses(assigned.map((c: any) => c.id));
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
      await api.put(`/teachers/${selectedTeacher.id}`, { specialization: selectedSubjects.join(', ') }, token);
      for (const cls of classes) {
        if (selectedClasses.includes(cls.id)) {
          await api.put(`/classes/${cls.id}`, { teacher_id: cls.id === parseInt(homeRoom) ? selectedTeacher.id : 0 }, token);
        }
      }
      setMessage('تم حفظ التعيينات بنجاح');
      const t = await api.get('/teachers?limit=500');
      setTeachers(t.teachers || []);
    } catch (e: any) {
      setMessage(e?.message || 'فشل الحفظ');
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
            {teachers.filter((t: any) => t.school === 'high').map((t: any) => {
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
              <Select multiple value={selectedSubjects} onChange={(e) => setSelectedSubjects(e.target.value as string[])}
                input={<OutlinedInput label="المواد الدراسية" />} renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((v) => <Chip key={v} label={v} size="small" />)}
                  </Box>
                )}>
                {subjects.map((s: any) => (
                  <MenuItem key={s.id} value={s.name}>
                    <Checkbox checked={selectedSubjects.includes(s.name)} />
                    <ListItemText primary={`${s.name} (${s.grade || s.school})`} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>الفصول الدراسية</InputLabel>
              <Select multiple value={selectedClasses.map((id: number) => String(id))} onChange={(e) => setSelectedClasses((e.target.value as string[]).map(Number))}
                input={<OutlinedInput label="الفصول الدراسية" />} renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((v) => {
                      const cls = classes.find((c: any) => c.id === parseInt(v));
                      return cls ? <Chip key={v} label={`${cls.class_name} (${cls.grade})`} size="small"
                        sx={{ bgcolor: gradeColors[cls.grade] || '#666', color: 'white' }} /> : null;
                    })}
                  </Box>
                )}>
                {classes.filter((c: any) => c.grade !== 'المتوسطة').map((c: any) => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    <Checkbox checked={selectedClasses.includes(c.id)} />
                    <ListItemText primary={`${c.class_name} - ${c.grade}`} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>رائد الفصل</InputLabel>
              <Select value={homeRoom} onChange={(e) => setHomeRoom(e.target.value)} label="رائد الفصل">
                <MenuItem value="">بدون</MenuItem>
                {classes.filter((c: any) => selectedClasses.includes(c.id)).map((c: any) => (
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
