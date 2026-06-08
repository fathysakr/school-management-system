'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Tabs, Tab, Grid, Chip
} from '@mui/material';
import { Add, CalendarToday, FileDownload, AutoAwesome, Person, School, MeetingRoom } from '@mui/icons-material';
import { exportToExcel } from '@/lib/excel';
import { api } from '@/lib/api';

const dayLabels: Record<string, string> = { sunday: 'الأحد', monday: 'الاثنين', tuesday: 'الثلاثاء', wednesday: 'الأربعاء', thursday: 'الخميس' };
const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];

const subjectPalette: Record<string, string> = {
  'القرآن': '#4CAF50', 'التوحيد': '#9C27B0', 'الفقه': '#FF9800', 'الحديث': '#03A9F4',
  'اللغة العربية': '#f44336', 'الرياضيات': '#2196F3', 'العلوم': '#8BC34A',
  'الاجتماعيات': '#E91E63', 'اللغة الإنجليزية': '#673AB7', 'الحاسب الآلي': '#00BCD4',
  'التربية البدنية': '#FFC107', 'التربية الفنية': '#FF5722', 'الفيزياء': '#009688',
  'الكيمياء': '#795548', 'الأحياء': '#4CAF50', 'انجليزي': '#673AB7',
  'بدنية': '#FFC107', 'تقنية رقمية': '#00BCD4', 'كفايات لغوية': '#f44336',
  'علم بيئة': '#4CAF50', 'نفسية': '#E91E63', 'جغرافيا': '#FF9800',
  'المهارات الحياتية': '#607D8B', 'الدراسات الادبية': '#9C27B0', 'الدراسات النفسية': '#E91E63',
  'علم الأرض': '#795548',
};

function getSubjColor(subject: string): string {
  for (const [key, c] of Object.entries(subjectPalette)) if (subject.includes(key)) return c;
  return `hsl(${subject.length * 47 % 360}, 45%, 55%)`;
}

export default function SchedulePanel() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const [schedules, setSchedules] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const teachingTeachers = teachers.filter((t: any) => !t.user_role || t.user_role.includes('teacher'));
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState(0);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [conflictWarn, setConflictWarn] = useState('');
  const [formData, setFormData] = useState<any>({ class_id: '', teacher_id: '', subject: '', day_of_week: 'sunday', start_time: '08:00', end_time: '09:00', room_number: '' });
  const [genDialogOpen, setGenDialogOpen] = useState(false);
  const [genSchool, setGenSchool] = useState('all');
  const [genClear, setGenClear] = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState<any>(null);

  const loadData = () => {
    if (!token) return;
    setLoading(true);
    let cancelled = false;
    api.get('/classes?page=1&limit=100', token).then((c: any) => {
      if (!cancelled) setClasses(c.classes || []);
    }).catch(() => {});
    api.get('/teachers?page=1&limit=100', token).then((t: any) => {
      if (!cancelled) setTeachers(t.teachers || []);
    }).catch(() => {});
    api.get('/schedules?limit=500', token).then((s: any) => {
      if (!cancelled) setSchedules(s.schedules || []);
    }).catch(() => setError('فشل تحميل البيانات'))
    .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  };
  useEffect(() => { loadData() }, []);

  const uniqueRooms = useMemo(() => [...new Set(schedules.filter(s => s.room_number).map(s => s.room_number))].sort(), [schedules]);
  const uniqueSubjects = useMemo(() => [...new Set(schedules.map(s => s.subject))].sort(), [schedules]);
  const scheduleCount = schedules.length;
  const teacherCount = [...new Set(schedules.map(s => s.teacher_id))].length;
  const classCount = [...new Set(schedules.map(s => s.class_id))].length;
  const roomCount = uniqueRooms.length;

  const filtered = useMemo(() => {
    let f = schedules;
    if (selectedClass) f = f.filter(s => s.class_id === parseInt(selectedClass));
    if (selectedTeacher) f = f.filter(s => s.teacher_id === parseInt(selectedTeacher));
    if (selectedRoom) f = f.filter(s => s.room_number === selectedRoom);
    if (subjectFilter) f = f.filter(s => s.subject === subjectFilter);
    return f;
  }, [schedules, selectedClass, selectedTeacher, selectedRoom, subjectFilter]);

  const checkConflict = (form: any, editId?: number) => {
    const sameTeacher = schedules.filter(s =>
      s.teacher_id === parseInt(form.teacher_id) && s.day_of_week === form.day_of_week &&
      s.start_time === form.start_time && (!editId || s.id !== editId)
    );
    const sameClass = schedules.filter(s =>
      s.class_id === parseInt(form.class_id) && s.day_of_week === form.day_of_week &&
      s.start_time === form.start_time && (!editId || s.id !== editId)
    );
    if (sameTeacher.length) return `⚠️ المعلم مشغول في ${sameTeacher.map(s => `${s.class_name} (${s.subject})`).join('، ')}`;
    if (sameClass.length) return `⚠️ الفصل لديه حصة ${sameClass[0].subject} في هذا الوقت`;
    return '';
  };

  const handleOpenDialog = (schedule?: any) => {
    setConflictWarn('');
    if (schedule) {
      setEditing(schedule);
      setFormData({ class_id: schedule.class_id.toString(), teacher_id: schedule.teacher_id.toString(), subject: schedule.subject, day_of_week: schedule.day_of_week, start_time: schedule.start_time, end_time: schedule.end_time, room_number: schedule.room_number || '' });
    } else {
      setEditing(null);
      setFormData({ class_id: classes[0]?.id?.toString() || '', teacher_id: '', subject: '', day_of_week: 'sunday', start_time: '08:00', end_time: '09:00', room_number: '' });
    }
    setOpenDialog(true);
  };

  const handleFormChange = (field: string, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    if (updated.teacher_id && updated.class_id && updated.day_of_week && updated.start_time) {
      setConflictWarn(checkConflict(updated, editing?.id));
    } else setConflictWarn('');
  };

  const handleSubmit = async () => {
    if (!token) return;
    const warn = checkConflict(formData, editing?.id);
    if (warn && !confirm(`${warn}\nهل تريد المتابعة رغم التعارض؟`)) return;
    try {
      if (editing) await api.put(`/schedules?id=${editing.id}`, formData, token);
      else await api.post('/schedules', formData, token);
      setSuccess(editing ? 'تم تحديث الحصة' : 'تم إضافة الحصة');
      setOpenDialog(false);
      const res = await api.get('/schedules?limit=500', token);
      setSchedules(res.schedules || []);
    } catch { setError('فشل الحفظ') }
  };

  const handleGenerate = async () => {
    if (!token) return;
    setGenLoading(true);
    try {
      const res = await api.post('/schedules/generate', { school: genSchool, clear_existing: genClear }, token);
      setGenResult(res);
      setSuccess(`✅ تم توليد ${res.generated} حصة دراسية`);
      setGenDialogOpen(false);
      const reload = await api.get('/schedules?limit=500', token);
      setSchedules(reload.schedules || []);
    } catch { setError('فشل التوليد') }
    finally { setGenLoading(false) }
  };

  const handleExport = () => {
    const rows = filtered.map((s: any) => [s.class_name || '', s.subject, `${s.teacher_first || ''} ${s.teacher_last || ''}`.trim(), dayLabels[s.day_of_week] || s.day_of_week, s.start_time, s.end_time, s.room_number || '']);
    exportToExcel(['الفصل', 'المادة', 'المعلم', 'اليوم', 'بداية', 'نهاية', 'القاعة'], rows, 'الجداول', 'schedules_صفوة_الرواد.xlsx');
    setSuccess('تم التصدير');
  };

  const renderCell = (slotSchedules: any[]) => {
    if (!slotSchedules.length) return <Typography sx={{ color: '#e0e0e0', fontSize: 18, textAlign: 'center' }}>—</Typography>;
    return slotSchedules.map(s => {
      const color = getSubjColor(s.subject);
      return (
        <Box key={s.id} sx={{ borderRadius: 1.5, p: 1, mb: 0.5, bgcolor: `${color}18`, borderLeft: `3px solid ${color}`, cursor: 'pointer', '&:hover': { boxShadow: 2, transform: 'scale(1.02)' }, transition: '0.15s' }}
          onClick={() => handleOpenDialog(s)}>
          <Typography sx={{ fontWeight: 700, fontSize: 12, color }}>{s.subject}</Typography>
          <Typography sx={{ fontSize: 10, color: '#555' }}>{s.teacher_first} {s.teacher_last}</Typography>
          {s.room_number && <Typography sx={{ fontSize: 9, color: '#888' }}>📍 {s.room_number}</Typography>}
        </Box>
      );
    });
  };

  const renderTable = (data: any[], getTimeSlots: () => string[]) => {
    const times = getTimeSlots();
    if (!times.length) return <Typography sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>لا توجد حصص</Typography>;
    return (
      <Paper variant="outlined" sx={{ overflowX: 'auto', borderRadius: 2 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead><tr style={{ background: 'linear-gradient(135deg, #1565c0, #1976d2)' }}>
            <th style={{ padding: '10px', color: 'white', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>الوقت</th>
            {days.map(d => <th key={d} style={{ padding: '10px', color: 'white', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>{dayLabels[d]}</th>)}
          </tr></thead>
          <tbody>
            {times.map((st, i) => (
              <tr key={st} style={{ background: i % 2 === 0 ? '#fafbfc' : '#f5f6f8' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'center', borderBottom: '1px solid #e0e0e0', fontSize: 13, color: '#555', whiteSpace: 'nowrap' }}>{st}</td>
                {days.map(d => <td key={d} style={{ padding: '6px', borderBottom: '1px solid #e0e0e0', verticalAlign: 'top', minWidth: 100 }}>{renderCell(data.filter(s => s.day_of_week === d && s.start_time === st))}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </Paper>
    );
  };

  const renderOverview = () => renderTable(schedules, () => [...new Set(schedules.map(s => s.start_time))].sort());
  const renderClassView = () => {
    const list = selectedClass ? classes.filter(c => c.id === parseInt(selectedClass)) : classes;
    if (!list.length) return <Typography sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>لا توجد فصول</Typography>;
    return list.map(cls => {
      const clsSchedules = schedules.filter(s => s.class_id === cls.id);
      return (
        <Paper key={cls.id} variant="outlined" sx={{ mb: 2, borderRadius: 2, overflow: 'hidden' }}>
          <Typography sx={{ p: 1.5, fontWeight: 'bold', bgcolor: '#f0f4ff', borderBottom: '1px solid #e0e0e0' }}>📖 {cls.class_name} {cls.grade ? `— ${cls.grade}` : ''}</Typography>
          {clsSchedules.length === 0 ? <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>لا توجد حصص</Typography> : renderTable(clsSchedules, () => [...new Set(clsSchedules.map(s => s.start_time))].sort())}
        </Paper>
      );
    });
  };
  const renderTeacherView = () => {
    const list = selectedTeacher ? teachers.filter(t => t.id === parseInt(selectedTeacher)) : teachers;
    if (!list.length) return <Typography sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>لا يوجد معلمون</Typography>;
    return list.map(tch => {
      const tSchedules = schedules.filter(s => s.teacher_id === tch.id);
      return (
        <Paper key={tch.id} variant="outlined" sx={{ mb: 2, borderRadius: 2, overflow: 'hidden' }}>
          <Typography sx={{ p: 1.5, fontWeight: 'bold', bgcolor: '#f0f4ff', borderBottom: '1px solid #e0e0e0' }}>👨‍🏫 {tch.first_name} {tch.last_name} <Chip label={`${tSchedules.length} حصة`} size="small" sx={{ mr: 1 }} /></Typography>
          {tSchedules.length === 0 ? <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>لا توجد حصص</Typography> : renderTable(tSchedules, () => [...new Set(tSchedules.map(s => s.start_time))].sort())}
        </Paper>
      );
    });
  };
  const renderRoomView = () => {
    const rooms = selectedRoom ? [selectedRoom] : uniqueRooms;
    if (!rooms.length) return <Typography sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>لا توجد قاعات مسجلة</Typography>;
    return rooms.map(room => {
      const rSchedules = schedules.filter(s => s.room_number === room);
      return (
        <Paper key={room} variant="outlined" sx={{ mb: 2, borderRadius: 2, overflow: 'hidden' }}>
          <Typography sx={{ p: 1.5, fontWeight: 'bold', bgcolor: '#f0f4ff', borderBottom: '1px solid #e0e0e0' }}>📍 {room} <Chip label={`${rSchedules.length} حصة`} size="small" sx={{ mr: 1 }} /></Typography>
          {rSchedules.length === 0 ? <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>لا توجد حصص</Typography> : renderTable(rSchedules, () => [...new Set(rSchedules.map(s => s.start_time))].sort())}
        </Paper>
      );
    });
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Paper sx={{ flex: 1, minWidth: 120, p: 1.5, textAlign: 'center', borderRadius: 2, bgcolor: '#E3F2FD' }}>
          <Typography variant="h5" fontWeight="bold" color="#1565c0">{scheduleCount}</Typography>
          <Typography variant="caption" color="text.secondary">إجمالي الحصص</Typography>
        </Paper>
        <Paper sx={{ flex: 1, minWidth: 120, p: 1.5, textAlign: 'center', borderRadius: 2, bgcolor: '#E8F5E9' }}>
          <Typography variant="h5" fontWeight="bold" color="#2e7d32">{classCount}</Typography>
          <Typography variant="caption" color="text.secondary">فصول</Typography>
        </Paper>
        <Paper sx={{ flex: 1, minWidth: 120, p: 1.5, textAlign: 'center', borderRadius: 2, bgcolor: '#FFF3E0' }}>
          <Typography variant="h5" fontWeight="bold" color="#e65100">{teacherCount}</Typography>
          <Typography variant="caption" color="text.secondary">معلمون</Typography>
        </Paper>
        <Paper sx={{ flex: 1, minWidth: 120, p: 1.5, textAlign: 'center', borderRadius: 2, bgcolor: '#F3E5F5' }}>
          <Typography variant="h5" fontWeight="bold" color="#7b1fa2">{roomCount}</Typography>
          <Typography variant="caption" color="text.secondary">قاعات</Typography>
        </Paper>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {viewTab === 1 && <FormControl size="small" sx={{ minWidth: 140 }}><InputLabel>الفصل</InputLabel><Select value={selectedClass} label="الفصل" onChange={e => { setSelectedClass(e.target.value); setSelectedTeacher(''); setSelectedRoom(''); }}><MenuItem value="">الكل</MenuItem>{classes.map(c => <MenuItem key={c.id} value={c.id}>{c.class_name}</MenuItem>)}</Select></FormControl>}
          {viewTab === 2 && <FormControl size="small" sx={{ minWidth: 140 }}><InputLabel>المعلم</InputLabel><Select value={selectedTeacher} label="المعلم" onChange={e => { setSelectedTeacher(e.target.value); setSelectedClass(''); setSelectedRoom(''); }}><MenuItem value="">الكل</MenuItem>{teachers.map(t => <MenuItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</MenuItem>)}</Select></FormControl>}
          {viewTab === 3 && <FormControl size="small" sx={{ minWidth: 140 }}><InputLabel>القاعة</InputLabel><Select value={selectedRoom} label="القاعة" onChange={e => { setSelectedRoom(e.target.value); setSelectedClass(''); setSelectedTeacher(''); }}><MenuItem value="">الكل</MenuItem>{uniqueRooms.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}</Select></FormControl>}
          {(viewTab === 0) && <FormControl size="small" sx={{ minWidth: 140 }}><InputLabel>المادة</InputLabel><Select value={subjectFilter} label="المادة" onChange={e => setSubjectFilter(e.target.value)}><MenuItem value="">جميع المواد</MenuItem>{uniqueSubjects.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}</Select></FormControl>}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" variant="contained" color="success" startIcon={<AutoAwesome />} onClick={() => setGenDialogOpen(true)}>توليد</Button>
          <Button size="small" variant="outlined" startIcon={<FileDownload />} onClick={handleExport}>تصدير</Button>
          <Button size="small" variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()}>إضافة</Button>
        </Box>
      </Box>

      <Tabs value={viewTab} onChange={(_, v) => setViewTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab icon={<CalendarToday />} label="شامل" iconPosition="start" />
        <Tab icon={<School />} label="فصل" iconPosition="start" />
        <Tab icon={<Person />} label="معلم" iconPosition="start" />
        <Tab icon={<MeetingRoom />} label="قاعة" iconPosition="start" />
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {scheduleCount === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
          <CalendarToday sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary" gutterBottom>لا توجد جداول دراسية</Typography>
          <Button variant="contained" color="success" startIcon={<AutoAwesome />} onClick={() => setGenDialogOpen(true)}>توليد الجدول تلقائياً</Button>
        </Paper>
      ) : (
        <>
          {viewTab === 0 && renderOverview()}
          {viewTab === 1 && renderClassView()}
          {viewTab === 2 && renderTeacherView()}
          {viewTab === 3 && renderRoomView()}
        </>
      )}

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'تعديل الحصة' : 'إضافة حصة'}</DialogTitle>
        <DialogContent>
          {conflictWarn && <Alert severity="warning" sx={{ mb: 2 }}>{conflictWarn}</Alert>}
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12}><FormControl fullWidth><InputLabel>الفصل</InputLabel><Select value={formData.class_id} label="الفصل" onChange={e => handleFormChange('class_id', e.target.value)}>{classes.map(c => <MenuItem key={c.id} value={c.id}>{c.class_name}</MenuItem>)}</Select></FormControl></Grid>
            <Grid item xs={12}><FormControl fullWidth><InputLabel>المعلم</InputLabel><Select value={formData.teacher_id} label="المعلم" onChange={e => handleFormChange('teacher_id', e.target.value)}>{teachingTeachers.length === 0 ? <MenuItem disabled>لا يوجد معلمون غير إداريين</MenuItem> : teachingTeachers.map(t => <MenuItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</MenuItem>)}</Select></FormControl></Grid>
            <Grid item xs={12}><TextField fullWidth label="المادة" value={formData.subject} onChange={e => handleFormChange('subject', e.target.value)} /></Grid>
            <Grid item xs={6}><FormControl fullWidth><InputLabel>اليوم</InputLabel><Select value={formData.day_of_week} label="اليوم" onChange={e => handleFormChange('day_of_week', e.target.value)}>{days.map(d => <MenuItem key={d} value={d}>{dayLabels[d]}</MenuItem>)}</Select></FormControl></Grid>
            <Grid item xs={6}><TextField fullWidth label="القاعة" value={formData.room_number} onChange={e => handleFormChange('room_number', e.target.value)} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="البداية" type="time" value={formData.start_time} onChange={e => handleFormChange('start_time', e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="النهاية" type="time" value={formData.end_time} onChange={e => handleFormChange('end_time', e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
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
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            يقوم النظام بتوزيع الحصص على أيام الأسبوع بناءً على المواد المسجلة وتخصصات المعلمين، مع مراعاة عدم تعارض المعلمين وتوزيع متوازن للحصص.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}><FormControl fullWidth><InputLabel>المرحلة</InputLabel><Select value={genSchool} label="المرحلة" onChange={e => setGenSchool(e.target.value)}><MenuItem value="all">جميع المراحل</MenuItem><MenuItem value="high">ثانوي</MenuItem><MenuItem value="middle">متوسط</MenuItem></Select></FormControl></Grid>
            <Grid item xs={12}><FormControl fullWidth><InputLabel>طريقة التوليد</InputLabel><Select value={genClear ? 'clear' : 'keep'} label="طريقة التوليد" onChange={e => setGenClear(e.target.value === 'clear')}><MenuItem value="clear">مسح الجدول الحالي وتوليد جديد</MenuItem><MenuItem value="keep">إضافة للفصول الفارغة فقط</MenuItem></Select></FormControl></Grid>
          </Grid>
          {genResult && <Alert severity="success" sx={{ mt: 2 }} icon={<AutoAwesome />}>تم توليد {genResult.generated} حصة دراسية لـ {genResult.classes_count} فصول</Alert>}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setGenDialogOpen(false)} disabled={genLoading}>إلغاء</Button>
          <Button variant="contained" color="success" onClick={handleGenerate} disabled={genLoading} startIcon={genLoading ? <CircularProgress size={18} /> : <AutoAwesome />}>{genLoading ? 'جاري التوليد...' : 'بدء التوليد'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
