'use client';
import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Tabs, Tab, Grid
} from '@mui/material';
import { Add, CalendarToday, FileDownload, AutoAwesome, Person, School } from '@mui/icons-material';
import { exportToExcel } from '@/lib/excel';
import { api } from '@/lib/api';

const dayLabels: Record<string, string> = {
  sunday: 'الأحد', monday: 'الاثنين', tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء', thursday: 'الخميس',
};
const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];

const subjectColors: Record<string, string> = {
  'القرآن': '#E8F5E9', 'التوحيد': '#F3E5F5', 'الفقه': '#FFF3E0', 'الحديث': '#E0F2FE',
  'اللغة العربية': '#FFEBEE', 'الرياضيات': '#E3F2FD', 'العلوم': '#F1F8E9',
  'الاجتماعيات': '#FCE4EC', 'اللغة الإنجليزية': '#EDE7F6', 'الحاسب الآلي': '#E0F7FA',
  'التربية البدنية': '#FFF8E1', 'التربية الفنية': '#FBE9E7',
};

function getSubjectColor(subject: string): string {
  for (const [key, color] of Object.entries(subjectColors)) {
    if (subject.includes(key)) return color;
  }
  return `hsl(${subject.length * 40 % 360}, 30%, 92%)`;
}

export default function SchedulePanel() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const [schedules, setSchedules] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState(0);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState<any>({ class_id: '', teacher_id: '', subject: '', day_of_week: 'sunday', start_time: '08:00', end_time: '09:00', room_number: '' });

  const [genDialogOpen, setGenDialogOpen] = useState(false);
  const [genSchool, setGenSchool] = useState('all');
  const [genClear, setGenClear] = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState<any>(null);

  const loadData = () => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      api.get('/classes?page=1&limit=100', token),
      api.get('/teachers?page=1&limit=100', token),
      api.get('/schedules', token),
    ]).then(([c, t, s]: any[]) => {
      setClasses(c.classes || []);
      setTeachers(t.teachers || []);
      setSchedules(s.schedules || []);
    }).catch(() => setError('فشل تحميل البيانات'))
    .finally(() => setLoading(false));
  };

  useEffect(() => { loadData() }, []);

  const handleOpenDialog = (schedule?: any) => {
    if (schedule) {
      setEditing(schedule);
      setFormData({ class_id: schedule.class_id.toString(), teacher_id: schedule.teacher_id.toString(), subject: schedule.subject, day_of_week: schedule.day_of_week, start_time: schedule.start_time, end_time: schedule.end_time, room_number: schedule.room_number || '' });
    } else {
      setEditing(null);
      setFormData({ class_id: classes[0]?.id?.toString() || '', teacher_id: '', subject: '', day_of_week: 'sunday', start_time: '08:00', end_time: '09:00', room_number: '' });
    }
    setOpenDialog(true);
  };

  const handleSubmit = async () => {
    if (!token) return;
    try {
      if (editing) await api.put(`/schedules?id=${editing.id}`, formData, token);
      else await api.post('/schedules', formData, token);
      setSuccess(editing ? 'تم تحديث الحصة' : 'تم إضافة الحصة');
      setOpenDialog(false);
      const res = await api.get('/schedules', token);
      setSchedules(res.schedules || []);
    } catch { setError('فشل الحفظ') }
  };

  const handleGenerate = async () => {
    if (!token) return;
    setGenLoading(true);
    try {
      const res = await api.post('/schedules/generate', { school: genSchool, clear_existing: genClear }, token);
      setGenResult(res);
      setSuccess(`✅ تم توليد ${res.generated} حصة`);
      setGenDialogOpen(false);
      const reload = await api.get('/schedules', token);
      setSchedules(reload.schedules || []);
    } catch { setError('فشل التوليد') }
    finally { setGenLoading(false) }
  };

  const handleExport = () => {
    const rows = schedules.map((s: any) => [s.class_name || '', s.subject, `${s.teacher_first || ''} ${s.teacher_last || ''}`.trim(), dayLabels[s.day_of_week] || s.day_of_week, s.start_time, s.end_time, s.room_number || '']);
    exportToExcel(['الفصل', 'المادة', 'المعلم', 'اليوم', 'بداية', 'نهاية', 'القاعة'], rows, 'الجداول', 'schedules.xlsx');
    setSuccess('تم التصدير');
  };

  const renderCell = (slotSchedules: any[]) => {
    if (!slotSchedules.length) return <Typography sx={{ color: '#e0e0e0', fontSize: 18, textAlign: 'center' }}>—</Typography>;
    return slotSchedules.map(s => (
      <Box key={s.id} sx={{ borderRadius: 1.5, p: 1, mb: 0.5, bgcolor: getSubjectColor(s.subject), borderLeft: '3px solid #1976d2', cursor: 'pointer', '&:hover': { boxShadow: 1 } }}
        onClick={() => handleOpenDialog(s)}>
        <Typography sx={{ fontWeight: 700, fontSize: 12, color: '#1a1a2e' }}>{s.subject}</Typography>
        <Typography sx={{ fontSize: 10, color: '#555' }}>{s.teacher_first} {s.teacher_last}</Typography>
        {s.room_number && <Typography sx={{ fontSize: 9, color: '#888' }}>📍 {s.room_number}</Typography>}
      </Box>
    ));
  };

  const renderFullGrid = () => {
    const uniqueTimes = [...new Set(schedules.map(s => s.start_time))].sort();
    return (
      <Paper variant="outlined" sx={{ overflowX: 'auto', borderRadius: 2 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr style={{ background: 'linear-gradient(135deg, #1565c0, #1976d2)' }}>
              <th style={{ padding: '12px', color: 'white', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>الوقت</th>
              {days.map(d => <th key={d} style={{ padding: '12px', color: 'white', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>{dayLabels[d]}</th>)}
            </tr>
          </thead>
          <tbody>
            {uniqueTimes.map((st, i) => (
              <tr key={st} style={{ background: i % 2 === 0 ? '#fafbfc' : '#f5f6f8' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'center', borderBottom: '1px solid #e0e0e0', fontSize: 13, color: '#555', whiteSpace: 'nowrap' }}>{st}</td>
                {days.map(d => {
                  const daySlots = schedules.filter(s => s.day_of_week === d && s.start_time === st);
                  return <td key={d} style={{ padding: '6px', borderBottom: '1px solid #e0e0e0', verticalAlign: 'top', minWidth: 120 }}>{renderCell(daySlots)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Paper>
    );
  };

  const renderClassView = () => {
    const data = selectedClass ? classes.filter(c => c.id === parseInt(selectedClass)) : classes;
    if (!data.length) return <Typography sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>لا توجد فصول</Typography>;
    return data.map(cls => {
      const clsSchedules = schedules.filter(s => s.class_id === cls.id);
      const uniqueTimes = [...new Set(clsSchedules.map(s => s.start_time))].sort();
      return (
        <Paper key={cls.id} variant="outlined" sx={{ mb: 2, overflowX: 'auto', borderRadius: 2 }}>
          <Typography sx={{ p: 1.5, fontWeight: 'bold', bgcolor: '#f0f4ff' }}>📖 {cls.class_name} — {cls.grade || ''}</Typography>
          {clsSchedules.length === 0 ? <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>لا توجد حصص</Typography> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead><tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #e0e0e0' }}>الوقت</th>
                {days.map(d => <th key={d} style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #e0e0e0' }}>{dayLabels[d]}</th>)}
              </tr></thead>
              <tbody>
                {uniqueTimes.map((st, i) => (
                  <tr key={st} style={{ background: i % 2 === 0 ? '#fafbfc' : '#f5f6f8' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'center', borderBottom: '1px solid #e0e0e0', fontSize: 13, color: '#555' }}>{st}</td>
                    {days.map(d => {
                      const slot = clsSchedules.find(s => s.day_of_week === d && s.start_time === st);
                      return <td key={d} style={{ padding: '4px', borderBottom: '1px solid #e0e0e0', verticalAlign: 'top', minWidth: 100 }}>
                        {slot ? <Box sx={{ borderRadius: 1, p: 0.75, bgcolor: getSubjectColor(slot.subject), cursor: 'pointer', '&:hover': { boxShadow: 1 } }} onClick={() => handleOpenDialog(slot)}>
                          <Typography sx={{ fontWeight: 700, fontSize: 11 }}>{slot.subject}</Typography>
                          <Typography sx={{ fontSize: 10, color: '#555' }}>{slot.teacher_first} {slot.teacher_last}</Typography>
                        </Box> : <Typography sx={{ color: '#e0e0e0', textAlign: 'center', fontSize: 16 }}>—</Typography>}
                      </td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Paper>
      );
    });
  };

  const renderTeacherView = () => {
    const data = selectedTeacher ? teachers.filter(t => t.id === parseInt(selectedTeacher)) : teachers;
    if (!data.length) return <Typography sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>لا يوجد معلمون</Typography>;
    return data.map(tch => {
      const tSchedules = schedules.filter(s => s.teacher_id === tch.id);
      const uniqueTimes = [...new Set(tSchedules.map(s => s.start_time))].sort();
      return (
        <Paper key={tch.id} variant="outlined" sx={{ mb: 2, overflowX: 'auto', borderRadius: 2 }}>
          <Typography sx={{ p: 1.5, fontWeight: 'bold', bgcolor: '#f0f4ff' }}>👨‍🏫 {tch.first_name} {tch.last_name}</Typography>
          {tSchedules.length === 0 ? <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>لا توجد حصص</Typography> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead><tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #e0e0e0' }}>الوقت</th>
                {days.map(d => <th key={d} style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #e0e0e0' }}>{dayLabels[d]}</th>)}
              </tr></thead>
              <tbody>
                {uniqueTimes.map((st, i) => (
                  <tr key={st} style={{ background: i % 2 === 0 ? '#fafbfc' : '#f5f6f8' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'center', borderBottom: '1px solid #e0e0e0', fontSize: 13, color: '#555' }}>{st}</td>
                    {days.map(d => {
                      const slot = tSchedules.find(s => s.day_of_week === d && s.start_time === st);
                      return <td key={d} style={{ padding: '4px', borderBottom: '1px solid #e0e0e0', verticalAlign: 'top', minWidth: 100 }}>
                        {slot ? <Box sx={{ borderRadius: 1, p: 0.75, bgcolor: getSubjectColor(slot.subject), cursor: 'pointer', '&:hover': { boxShadow: 1 } }} onClick={() => handleOpenDialog(slot)}>
                          <Typography sx={{ fontWeight: 700, fontSize: 11 }}>{slot.subject}</Typography>
                          <Typography sx={{ fontSize: 10, color: '#555' }}>{slot.class_name} | {slot.room_number || ''}</Typography>
                        </Box> : <Typography sx={{ color: '#e0e0e0', textAlign: 'center', fontSize: 16 }}>—</Typography>}
                      </td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Paper>
      );
    });
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>الفصل</InputLabel>
            <Select value={selectedClass} label="الفصل" onChange={e => { setSelectedClass(e.target.value); setSelectedTeacher(''); }}>
              <MenuItem value="">جميع الفصول</MenuItem>
              {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.class_name}</MenuItem>)}
            </Select>
          </FormControl>
          {viewTab === 2 && (
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>المعلم</InputLabel>
              <Select value={selectedTeacher} label="المعلم" onChange={e => { setSelectedTeacher(e.target.value); setSelectedClass(''); }}>
                <MenuItem value="">جميع المعلمين</MenuItem>
                {teachers.map(t => <MenuItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</MenuItem>)}
              </Select>
            </FormControl>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" variant="contained" color="success" startIcon={<AutoAwesome />} onClick={() => setGenDialogOpen(true)}>توليد</Button>
          <Button size="small" variant="outlined" startIcon={<FileDownload />} onClick={handleExport}>تصدير</Button>
          <Button size="small" variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()}>إضافة</Button>
        </Box>
      </Box>

      <Tabs value={viewTab} onChange={(_, v) => setViewTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab icon={<CalendarToday />} label="شامل" iconPosition="start" />
        <Tab icon={<School />} label="حسب الفصل" iconPosition="start" />
        <Tab icon={<Person />} label="حسب المعلم" iconPosition="start" />
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {viewTab === 0 && (schedules.length === 0 ? <Typography sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>لا توجد جداول. استخدم "توليد" لإنشاء الجدول تلقائياً</Typography> : renderFullGrid())}
      {viewTab === 1 && renderClassView()}
      {viewTab === 2 && renderTeacherView()}

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'تعديل الحصة' : 'إضافة حصة'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12}><FormControl fullWidth><InputLabel>الفصل</InputLabel><Select value={formData.class_id} label="الفصل" onChange={e => setFormData({ ...formData, class_id: e.target.value })}>{classes.map(c => <MenuItem key={c.id} value={c.id}>{c.class_name}</MenuItem>)}</Select></FormControl></Grid>
            <Grid item xs={12}><FormControl fullWidth><InputLabel>المعلم</InputLabel><Select value={formData.teacher_id} label="المعلم" onChange={e => setFormData({ ...formData, teacher_id: e.target.value })}>{teachers.map(t => <MenuItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</MenuItem>)}</Select></FormControl></Grid>
            <Grid item xs={12}><TextField fullWidth label="المادة" value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} /></Grid>
            <Grid item xs={6}><FormControl fullWidth><InputLabel>اليوم</InputLabel><Select value={formData.day_of_week} label="اليوم" onChange={e => setFormData({ ...formData, day_of_week: e.target.value })}>{days.map(d => <MenuItem key={d} value={d}>{dayLabels[d]}</MenuItem>)}</Select></FormControl></Grid>
            <Grid item xs={6}><TextField fullWidth label="القاعة" value={formData.room_number} onChange={e => setFormData({ ...formData, room_number: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="البداية" type="time" value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="النهاية" type="time" value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDialog(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleSubmit}>{editing ? 'تحديث' : 'إضافة'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={genDialogOpen} onClose={() => !genLoading && setGenDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'success.main', color: 'white' }}><AutoAwesome sx={{ verticalAlign: 'middle', ml: 1 }} />توليد الجدول تلقائياً</DialogTitle>
        <DialogContent sx={{ pt: '24px !important' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>توليد جدول كامل لجميع الفصول بناءً على المواد المسجلة وتخصصات المعلمين.</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth><InputLabel>المرحلة</InputLabel><Select value={genSchool} label="المرحلة" onChange={e => setGenSchool(e.target.value)}><MenuItem value="all">الكل</MenuItem><MenuItem value="middle">متوسط</MenuItem><MenuItem value="high">ثانوي</MenuItem></Select></FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth><InputLabel>الطريقة</InputLabel><Select value={genClear ? 'clear' : 'keep'} label="الطريقة" onChange={e => setGenClear(e.target.value === 'clear')}><MenuItem value="clear">مسح الحالي والتوليد</MenuItem><MenuItem value="keep">إضافة للفصول الفارغة</MenuItem></Select></FormControl>
            </Grid>
          </Grid>
          {genResult && <Alert severity="success" sx={{ mt: 2 }}>تم توليد {genResult.generated} حصة</Alert>}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setGenDialogOpen(false)} disabled={genLoading}>إلغاء</Button>
          <Button variant="contained" color="success" onClick={handleGenerate} disabled={genLoading} startIcon={genLoading ? <CircularProgress size={18} /> : <AutoAwesome />}>{genLoading ? 'جاري...' : 'توليد'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
