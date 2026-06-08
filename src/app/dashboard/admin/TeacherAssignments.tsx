'use client';
import { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Select, MenuItem, FormControl, InputLabel,
  Chip, Button, CircularProgress, Alert, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Checkbox, ListItemText, OutlinedInput,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import { Assignment, Save, Home } from '@mui/icons-material';
import { api } from '@/lib/api';

export default function TeacherAssignments() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const teachingTeachers = teachers.filter((t: any) => !t.user_role || t.user_role.includes('teacher'));
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [subjectSessions, setSubjectSessions] = useState<Record<number, number>>({});
  const [subjectClasses, setSubjectClasses] = useState<Record<number, number[]>>({});
  const [homeRoom, setHomeRoom] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [schoolFilter, setSchoolFilter] = useState('high');

  useEffect(() => {
    const token = localStorage.getItem('token');
    let cancelled = false;
    api.get('/teachers?limit=500', token).then((t: any) => {
      if (!cancelled) setTeachers(t.teachers || []);
    }).catch(() => {});
    api.get('/classes?limit=500', token).then((c: any) => {
      if (!cancelled) setClasses(c.classes || []);
    }).catch(() => {});
    api.get(`/subjects?school=${schoolFilter}`, token).then((s: any) => {
      if (!cancelled) setSubjects(s.subjects || []);
    }).catch(() => setMessage('فشل تحميل البيانات'));
    setLoading(false);
    return () => { cancelled = true; };
  }, [schoolFilter]);

  const parseSpec = (spec: string): { ids: number[]; sessions: Record<number, number>; classes: Record<number, number[]> } => {
    if (!spec) return { ids: [], sessions: {}, classes: {} };
    if (spec.startsWith('[')) {
      try {
        const arr = JSON.parse(spec);
        const ids: number[] = [];
        const sessions: Record<number, number> = {};
        const classes: Record<number, number[]> = {};
        for (const item of arr) {
          const sub = subjects.find((s: any) => s.name === item.n);
          if (sub) {
            ids.push(sub.id);
            if (item.s) sessions[sub.id] = item.s;
            if (item.classes) classes[sub.id] = item.classes;
          }
        }
        return { ids, sessions, classes };
      } catch { return { ids: [], sessions: {}, classes: {} }; }
    }
    const names = spec.split(',').map((s: string) => s.trim());
    const ids = subjects.filter((s: any) => names.includes(s.name)).map((s: any) => s.id);
    return { ids, sessions: {}, classes: {} };
  };

  const buildSpec = (): string => {
    return JSON.stringify(
      selectedSubjectIds.map(id => {
        const sub = subjects.find((s: any) => s.id === id);
        const entry: any = { n: sub?.name || '' };
        const s = subjectSessions[id];
        if (s && sub && s !== sub.sessions_per_week) entry.s = s;
        const c = subjectClasses[id];
        if (c && c.length > 0) entry.classes = c;
        return entry;
      })
    );
  };

  const openAssignment = (teacher: any) => {
    setSelectedTeacher(teacher);
    const { ids, sessions, classes: subjClasses } = parseSpec(teacher.specialization || '');
    setSelectedSubjectIds(ids);
    setSubjectSessions(sessions);
    setSubjectClasses(subjClasses);
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
      await api.put(`/teachers/${selectedTeacher.id}`, { specialization: buildSpec() }, token);
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
      if (msg.includes('401') || msg.includes('غير مصرح')) setMessage('صلاحية الوصول منتهية - سجل الدخول مرة أخرى');
      else if (msg.includes('fetch') || msg.includes('NetworkError')) setMessage('فشل الاتصال بالخادم');
      else setMessage('فشل الحفظ: ' + msg);
    }
    setSaving(false);
  };

  const formatSpec = (spec: string): { name: string; sessions: number; classes: number[] }[] => {
    if (!spec) return [];
    if (spec.startsWith('[')) {
      try {
        return JSON.parse(spec).map((item: any) => ({ name: item.n, sessions: item.s || 0, classes: item.classes || [] }));
      } catch { return []; }
    }
    return spec.split(',').map((s: string) => ({ name: s.trim(), sessions: 0, classes: [] }));
  };

  const getTeacherClassIds = (teacher: any): number[] => {
    const ids = new Set<number>();
    classes.filter((c: any) => c.teacher_id === teacher.id).forEach((c: any) => ids.add(c.id));
    formatSpec(teacher.specialization || '').forEach((item: any) => {
      (item.classes || []).forEach((cid: number) => ids.add(cid));
    });
    (teacher.schedule_class_ids || []).forEach((cid: number) => ids.add(cid));
    return [...ids];
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;

  const gradeColors: Record<string, string> = { 'الصف الأول الثانوي': '#1565c0', 'الصف الثاني الثانوي': '#2e7d32', 'الصف الثالث الثانوي': '#e65100', 'أول ثانوي': '#1565c0', 'ثاني ثانوي': '#2e7d32', 'ثالث ثانوي': '#e65100' };

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
                  <TableCell>المواد (عدد الحصص)</TableCell>
              <TableCell>الفصول المسندة</TableCell>
              <TableCell>رائد فصل</TableCell>
              <TableCell>إجراءات</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {teachingTeachers.filter((t: any) => t.school === schoolFilter).map((t: any) => {
              const assignedClassIds = getTeacherClassIds(t);
              const assignedClasses = classes.filter((c: any) => assignedClassIds.includes(c.id));
              const homeroomClasses = classes.filter((c: any) => c.teacher_id === t.id);
              const specItems = formatSpec(t.specialization || '');
              return (
                <TableRow key={t.id}>
                  <TableCell>{t.first_name} {t.last_name}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {specItems.map((item) => (
                        <Chip key={item.name} label={item.sessions ? `${item.name} (${item.sessions})` : item.name} size="small" color="primary" variant="outlined" />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {assignedClasses.map((c: any) => (
                        <Chip key={c.id} label={`${c.class_name} (${c.grade})`} size="small"
                          sx={{ bgcolor: gradeColors[c.grade] || '#666', color: 'white' }} />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {homeroomClasses.map((c: any) => (
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
                      return sub ? <Chip key={id} label={`${sub.name}${sub.grade ? ` (${sub.grade})` : ''}`} size="small" /> : null;
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
            {selectedSubjectIds.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>عدد الحصص الأسبوعية لكل مادة:</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {selectedSubjectIds.map((id) => {
                    const sub = subjects.find((s: any) => s.id === id);
                    if (!sub) return null;
                    const filteredClasses = classes.filter((c: any) => c.grade?.includes(schoolFilter === 'high' ? 'ثانوي' : 'متوسط'));
                    return (
                      <Box key={id} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Chip label={`${sub.name}${sub.grade ? ` (${sub.grade})` : ''}`} size="small" color="primary" variant="outlined" sx={{ minWidth: 140 }} />
                          <TextField
                            type="number" size="small" sx={{ width: 80 }}
                            value={subjectSessions[id] ?? sub.sessions_per_week ?? 3}
                            onChange={(e) => setSubjectSessions(prev => ({ ...prev, [id]: parseInt(e.target.value) || 0 }))}
                            inputProps={{ min: 0, max: 10 }}
                          />
                          <Typography variant="caption" color="text.secondary">حصص/أسبوع</Typography>
                        </Box>
                        <FormControl fullWidth size="small">
                          <Select
                            multiple
                            displayEmpty
                            value={subjectClasses[id] || []}
                            onChange={(e) => setSubjectClasses(prev => ({ ...prev, [id]: e.target.value as number[] }))}
                            renderValue={(selected) => {
                              if (selected.length === 0) return <Typography variant="body2" color="text.secondary">جميع الفصول</Typography>;
                              return (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.3 }}>
                                  {selected.map((cid) => {
                                    const cl = classes.find((c: any) => c.id === cid);
                                    return cl ? <Chip key={cid} label={`${cl.class_name} - ${cl.grade}`} size="small" sx={{ bgcolor: gradeColors[cl.grade] || '#666', color: 'white', height: 22, '& .MuiChip-label': { fontSize: 11 } }} /> : null;
                                  })}
                                </Box>
                              );
                            }}
                          >
                            {filteredClasses.map((c: any) => (
                              <MenuItem key={c.id} value={c.id}>
                                <Checkbox checked={(subjectClasses[id] || []).includes(c.id)} size="small" />
                                <ListItemText primary={`${c.class_name} - ${c.grade}`} />
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Box>
                    );
                  })}
                </Box>
              </Paper>
            )}
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
