'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, CircularProgress, IconButton,
  FormControl, InputLabel, Select, MenuItem, Tabs, Tab, Grid, Chip,
  InputAdornment
} from '@mui/material';
import { Add, CalendarToday, FileDownload, AutoAwesome, Person, School, MeetingRoom, CloudUpload, Close as CloseIcon, Search } from '@mui/icons-material';
import { exportToExcel } from '@/lib/excel';
import { api } from '@/lib/api';
import { useAuth, stageOptions, FORCED_SCHOOL_STAGE } from '@/lib/auth-context';

const dayLabels: Record<string, string> = { sunday: 'الأحد', monday: 'الاثنين', tuesday: 'الثلاثاء', wednesday: 'الأربعاء', thursday: 'الخميس' };
const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];

// Loose time compare: "08:00", "8:0" and "9" all normalize for substring match
const looseTime = (t: string): string =>
  (t || '').split(':').map(p => String(parseInt(p, 10) || 0)).join(':');

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
  const { token } = useAuth();
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
  const [timeQuery, setTimeQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [conflictWarn, setConflictWarn] = useState('');
  const [formData, setFormData] = useState<any>({ class_id: '', teacher_id: '', subject: '', day_of_week: 'sunday', start_time: '08:00', end_time: '09:00', room_number: '' });
  const [genDialogOpen, setGenDialogOpen] = useState(false);
  const [genSchool, setGenSchool] = useState<string>(FORCED_SCHOOL_STAGE ?? 'all');
  const [genClear, setGenClear] = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState<any>(null);

  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfSchool, setPdfSchool] = useState<string>(FORCED_SCHOOL_STAGE ?? 'middle');
  const [pdfClear, setPdfClear] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfResult, setPdfResult] = useState<any>(null);
  const [pdfDragOver, setPdfDragOver] = useState(false);

  // Two-step PDF upload: preview → map pages → save
  const [pdfPreview, setPdfPreview] = useState<any>(null);
  const [pdfAllClasses, setPdfAllClasses] = useState<any[]>([]);
  const [pdfPageMapping, setPdfPageMapping] = useState<Record<string, string>>({});
  const [pdfError, setPdfError] = useState('');
  const isTeacherPdf = pdfPreview?.preview?.mode === 'teacher';

  const loadData = useCallback(() => {
    if (!token) return;
    setLoading(true);
    let cancelled = false;
    api.get('/classes?page=1&limit=100', token).then((c: any) => {
      if (!cancelled) setClasses(c.classes || []);
    }).catch(() => { if (!cancelled) setError('فشل تحميل الفصول'); });
    api.get('/teachers?page=1&limit=100', token).then((t: any) => {
      if (!cancelled) setTeachers(t.teachers || []);
    }).catch(() => { if (!cancelled) setError('فشل تحميل المعلمين'); });
    api.get('/schedules?limit=500', token).then((s: any) => {
      if (!cancelled) setSchedules(s.schedules || []);
    }).catch(() => { if (!cancelled) setError('فشل تحميل الجداول'); })
    .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);
  useEffect(() => { loadData() }, [loadData]);

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
    } catch (e: any) {
      setError(e?.message || 'فشل الحفظ');
    }
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
    } catch (e: any) {
      setError(e?.message || 'فشل التوليد');
    }
    finally { setGenLoading(false) }
  };

  const handleExport = () => {
    const rows = filtered.map((s: any) => [s.class_name || '', s.subject, `${s.teacher_first || ''} ${s.teacher_last || ''}`.trim(), dayLabels[s.day_of_week] || s.day_of_week, s.start_time, s.end_time, s.room_number || '']);
    exportToExcel(['الفصل', 'المادة', 'المعلم', 'اليوم', 'بداية', 'نهاية', 'القاعة'], rows, 'الجداول', 'schedules_صفوة_الرواد.xlsx');
    setSuccess('تم التصدير');
  };

  // Global period numbering across all schedules (order of unique start times)
  const globalTimes = [...new Set(schedules.map((s: any) => s.start_time))].sort();
  const periodOf: Record<string, number> = {};
  globalTimes.forEach((st, i) => { periodOf[st] = i + 1; });
  const timeSearchNorm = timeQuery.replace(/[^\d:.]/g, '').replace('.', ':');
  const timeSearching = timeSearchNorm.trim().length > 0;

  const renderCell = (slotSchedules: any[]) => {
    if (!slotSchedules.length) return <Typography sx={{ color: '#e0e0e0', fontSize: 18, textAlign: 'center' }}>—</Typography>;
    return slotSchedules.map(s => {
      const color = getSubjColor(s.subject);
      return (
        <Box key={s.id} sx={{ borderRadius: 1.5, p: 1, mb: 0.5, bgcolor: `${color}18`, borderLeft: `3px solid ${color}`, cursor: 'pointer', '&:hover': { boxShadow: 2, transform: 'scale(1.02)' }, transition: '0.15s' }}
          onClick={() => handleOpenDialog(s)}>
          <Typography sx={{ fontWeight: 700, fontSize: 12, color }}>{s.subject}</Typography>
          <Typography sx={{ fontSize: 9, color: '#888' }}>{s.class_name}</Typography>
          <Typography sx={{ fontSize: 10, color: '#555' }}>{s.teacher_first} {s.teacher_last}</Typography>
          {s.room_number && <Typography sx={{ fontSize: 9, color: '#888' }}>📍 {s.room_number}</Typography>}
        </Box>
      );
    });
  };

  const renderTable = (data: any[], getTimeSlots: () => string[]) => {
    const times = getTimeSlots();
    if (!times.length) return <Typography sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>لا توجد حصص</Typography>;
    const endOf: Record<string, string> = {};
    data.forEach(s => { if (s.end_time && !endOf[s.start_time]) endOf[s.start_time] = s.end_time; });
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
                <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #e0e0e0', whiteSpace: 'nowrap' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#1565c0' }}>الحصة {periodOf[st] || i + 1}</Typography>
                  <Typography sx={{ fontSize: 11, color: '#777' }}>{st} - {endOf[st] || ''}</Typography>
                </td>
                {days.map(d => <td key={d} style={{ padding: '6px', borderBottom: '1px solid #e0e0e0', verticalAlign: 'top', minWidth: 100 }}>{renderCell(data.filter(s => s.day_of_week === d && s.start_time === st))}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </Paper>
    );
  };

  const renderTimeSearch = () => {
    const nq = timeQuery.replace(/[^\d:.]/g, '').replace('.', ':');
    const results = schedules
      .filter(s => looseTime(s.start_time).includes(looseTime(nq)) || looseTime(s.end_time).includes(looseTime(nq)))
      .sort((a: any, b: any) =>
        days.indexOf(a.day_of_week) - days.indexOf(b.day_of_week) ||
        String(a.start_time).localeCompare(String(b.start_time)) ||
        String(a.class_name).localeCompare(String(b.class_name), 'ar'));
    return (
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        <Alert severity={results.length ? 'info' : 'warning'} sx={{ borderRadius: 0 }}>
          {results.length ? `تم العثور على ${results.length} حصة عند الوقت «${timeQuery}»` : 'لا توجد حصص في هذا الوقت'}
        </Alert>
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }} dir="rtl">
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #1565c0, #1976d2)' }}>
                {['اليوم', 'الحصة', 'الوقت', 'الفصل', 'المادة', 'المعلم'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', color: 'white', fontWeight: 600, textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((s: any, i: number) => (
                <tr key={s.id} style={{ background: i % 2 === 0 ? '#fafbfc' : '#f5f6f8' }}>
                  <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #e0e0e0', fontWeight: 600, fontSize: 13 }}>{dayLabels[s.day_of_week] || s.day_of_week}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #e0e0e0', fontWeight: 700, color: '#1565c0', whiteSpace: 'nowrap' }}>الحصة {periodOf[s.start_time] || '-'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #e0e0e0', fontSize: 13, color: '#555', whiteSpace: 'nowrap' }}>{s.start_time} - {s.end_time}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #e0e0e0', fontSize: 13 }}>{s.class_name}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #e0e0e0', fontWeight: 700, fontSize: 13 }}>{s.subject}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #e0e0e0', fontSize: 13 }}>{s.teacher_first} {s.teacher_last}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </Box>
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
          <TextField
            size="small"
            placeholder="ابحث بالوقت مثل: 08:00 أو 9"
            value={timeQuery}
            onChange={e => setTimeQuery(e.target.value)}
            sx={{ width: { xs: '100%', sm: 240 } }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
              endAdornment: timeQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setTimeQuery('')}><CloseIcon fontSize="small" /></IconButton>
                </InputAdornment>
              ) : undefined,
            }}
          />
          {viewTab === 1 && <FormControl size="small" sx={{ minWidth: 140 }}><InputLabel>الفصل</InputLabel><Select value={selectedClass} label="الفصل" onChange={e => { setSelectedClass(e.target.value); setSelectedTeacher(''); setSelectedRoom(''); }}><MenuItem value="">الكل</MenuItem>{classes.map(c => <MenuItem key={c.id} value={c.id}>{c.class_name}</MenuItem>)}</Select></FormControl>}
          {viewTab === 2 && <FormControl size="small" sx={{ minWidth: 140 }}><InputLabel>المعلم</InputLabel><Select value={selectedTeacher} label="المعلم" onChange={e => { setSelectedTeacher(e.target.value); setSelectedClass(''); setSelectedRoom(''); }}><MenuItem value="">الكل</MenuItem>{teachers.map(t => <MenuItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</MenuItem>)}</Select></FormControl>}
          {viewTab === 3 && <FormControl size="small" sx={{ minWidth: 140 }}><InputLabel>القاعة</InputLabel><Select value={selectedRoom} label="القاعة" onChange={e => { setSelectedRoom(e.target.value); setSelectedClass(''); setSelectedTeacher(''); }}><MenuItem value="">الكل</MenuItem>{uniqueRooms.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}</Select></FormControl>}
          {(viewTab === 0) && <FormControl size="small" sx={{ minWidth: 140 }}><InputLabel>المادة</InputLabel><Select value={subjectFilter} label="المادة" onChange={e => setSubjectFilter(e.target.value)}><MenuItem value="">جميع المواد</MenuItem>{uniqueSubjects.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}</Select></FormControl>}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" variant="contained" color="success" startIcon={<AutoAwesome />} onClick={() => setGenDialogOpen(true)}>توليد</Button>
          <Button size="small" variant="contained" color="info" startIcon={<CloudUpload />} onClick={() => { setPdfDialogOpen(true); setPdfFile(null); setPdfResult(null); setPdfPreview(null); setPdfPageMapping({}); setPdfError(''); }}>PDF</Button>
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
          {timeSearching ? renderTimeSearch() : (
            <>
              {viewTab === 0 && renderOverview()}
              {viewTab === 1 && renderClassView()}
              {viewTab === 2 && renderTeacherView()}
              {viewTab === 3 && renderRoomView()}
            </>
          )}
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
            <Grid item xs={12}><FormControl fullWidth><InputLabel>المرحلة</InputLabel><Select value={genSchool} label="المرحلة" onChange={e => setGenSchool(e.target.value)}>{!FORCED_SCHOOL_STAGE && <MenuItem value="all">جميع المراحل</MenuItem>}{stageOptions().map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}</Select></FormControl></Grid>
            <Grid item xs={12}><FormControl fullWidth><InputLabel>طريقة التوليد</InputLabel><Select value={genClear ? 'clear' : 'keep'} label="طريقة التوليد" onChange={e => setGenClear(e.target.value === 'clear')}><MenuItem value="clear">مسح الجدول الحالي وتوليد جديد</MenuItem><MenuItem value="keep">إضافة للفصول الفارغة فقط</MenuItem></Select></FormControl></Grid>
          </Grid>
          {genResult && <Alert severity="success" sx={{ mt: 2 }} icon={<AutoAwesome />}>تم توليد {genResult.generated} حصة دراسية لـ {genResult.classes_count} فصول</Alert>}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setGenDialogOpen(false)} disabled={genLoading}>إلغاء</Button>
          <Button variant="contained" color="success" onClick={handleGenerate} disabled={genLoading} startIcon={genLoading ? <CircularProgress size={18} /> : <AutoAwesome />}>{genLoading ? 'جاري التوليد...' : 'بدء التوليد'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={pdfDialogOpen} onClose={() => !pdfLoading && setPdfDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: 'info.main', color: 'white' }}>
          <CloudUpload sx={{ verticalAlign: 'middle', ml: 1 }} />استيراد جدول من PDF
          <IconButton onClick={() => setPdfDialogOpen(false)} sx={{ position: 'absolute', left: 8, top: 8, color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '24px !important' }}>
          {pdfError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPdfError('')}>{pdfError}</Alert>}

          {!pdfPreview ? (
            <>
              {/* Step 1: Upload file */}
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                قم برفع ملف PDF للجدول الدراسي (من برنامج aSc Timetables) ليتم استيراد جميع الحصص والمواد والمعلمين.
              </Typography>
              <Box
                sx={{
                  border: '2px dashed', borderRadius: 2, p: 4, textAlign: 'center', cursor: 'pointer', mb: 2,
                  borderColor: pdfDragOver ? 'info.main' : pdfFile ? 'success.main' : 'grey.400',
                  bgcolor: pdfDragOver ? '#e3f2fd' : 'grey.50',
                  transition: '0.2s',
                }}
                onDragOver={(e) => { e.preventDefault(); setPdfDragOver(true); }}
                onDragLeave={() => setPdfDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setPdfDragOver(false); const f = e.dataTransfer.files[0]; if (f?.name.endsWith('.pdf')) setPdfFile(f); }}
                onClick={() => document.getElementById('pdf-upload-input-admin')?.click()}
              >
                <input id="pdf-upload-input-admin" type="file" accept=".pdf" hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setPdfFile(f); }} />
                <CloudUpload sx={{ fontSize: 48, color: pdfFile ? 'success.main' : 'text.disabled', mb: 1 }} />
                <Typography color={pdfFile ? 'success.main' : 'text.secondary'}>
                  {pdfFile ? pdfFile.name : 'اسحب ملف PDF هنا أو اضغط للاختيار'}
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small"><InputLabel>المرحلة</InputLabel>
                    <Select value={pdfSchool} label="المرحلة" onChange={(e) => setPdfSchool(e.target.value)}>
                      {stageOptions().map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small"><InputLabel>الاستيراد</InputLabel>
                    <Select value={pdfClear ? 'clear' : 'keep'} label="الاستيراد" onChange={(e) => setPdfClear(e.target.value === 'clear')}>
                      <MenuItem value="clear">مسح الجدول الحالي</MenuItem>
                      <MenuItem value="keep">إضافة للفصول الفارغة</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </>
          ) : (
            <>
              {/* Step 2: Map pages to classes (class-card PDFs) or review teacher cards */}
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {isTeacherPdf
                  ? `تم استخراج ${pdfPreview.preview.numPages} صفحة — جداول معلمين مفردة. الفصول مأخوذة تلقائياً من داخل كل جدول:`
                  : `تم استخراج ${pdfPreview.preview.numPages} صفحة. اختر الفصل المناسب لكل صفحة:`}
              </Typography>
              <Box sx={{ maxHeight: 360, overflow: 'auto', mb: 2 }}>
                {pdfPreview.preview.pages.map((pg: any) => (
                  <Paper key={pg.pageIndex} variant="outlined" sx={{ p: 1.5, mb: 1, borderRadius: 1.5, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Typography sx={{ minWidth: 70, fontWeight: 'bold', fontSize: 14 }}>
                      الصفحة {pg.pageIndex}
                      <Chip size="small" label={`${pg.entryCount} حصة`} sx={{ mr: 1, fontSize: 11 }} />
                    </Typography>
                    {isTeacherPdf ? (
                      <Chip size="small" color="primary" variant="outlined" label={pg.title || `معلم ${pg.pageIndex}`} sx={{ fontSize: 12 }} />
                    ) : (
                      <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel>الفصل</InputLabel>
                        <Select
                          value={pdfPageMapping[pg.pageIndex] || ''}
                          label="الفصل"
                          onChange={(e) => setPdfPageMapping(prev => ({ ...prev, [String(pg.pageIndex)]: e.target.value }))}
                        >
                          <MenuItem value="">-- اختر الفصل --</MenuItem>
                          {pdfAllClasses.map((c: any) => (
                            <MenuItem key={c.id} value={String(c.id)}>{c.class_name} {c.grade ? `(${c.grade})` : ''}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                    <Box sx={{ fontSize: 11, color: 'text.secondary', flex: 1 }}>
                      <Typography variant="caption" display="block">المواد: {pg.subjects.slice(0, 5).join('، ')}{pg.subjects.length > 5 ? '...' : ''}</Typography>
                      {!isTeacherPdf && <Typography variant="caption" display="block">المعلمون: {pg.teachers.slice(0, 5).join('، ')}{pg.teachers.length > 5 ? '...' : ''}</Typography>}
                    </Box>
                  </Paper>
                ))}
              </Box>
            </>
          )}

          {pdfResult && (
            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography fontWeight="bold" gutterBottom>تم الاستيراد</Typography>
              <Typography variant="caption" display="block">الفصول: {pdfResult.summary.classes} (جديد: {pdfResult.summary.created_classes})</Typography>
              <Typography variant="caption" display="block">المعلمون: {pdfResult.summary.teachers} (جديد: {pdfResult.summary.created_teachers})</Typography>
              <Typography variant="caption" display="block">المواد: {pdfResult.summary.subjects} (جديد: {pdfResult.summary.created_subjects})</Typography>
              <Typography variant="caption" display="block">الحصص المدرجة: {pdfResult.summary.schedules}</Typography>
              {pdfResult.summary.skipped_existing > 0 && <Typography variant="caption" display="block">تخطي: {pdfResult.summary.skipped_existing} موجودة</Typography>}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setPdfDialogOpen(false); setPdfPreview(null); }} disabled={pdfLoading}>إلغاء</Button>
          {!pdfPreview ? (
            <Button variant="contained" color="info"
              onClick={async () => {
                if (!token || !pdfFile) return;
                setPdfLoading(true); setPdfResult(null); setPdfError('');
                try {
                  const fd = new FormData();
                  fd.append('file', pdfFile);
                  const res = await api.upload('/schedules/preview-pdf', fd, token);
                  setPdfPreview(res);
                  setPdfAllClasses(res.classes || []);
                  // Auto-map based on classId if it looks like a grade-section
                  if (res.preview?.pages) {
                    const mapping: Record<string, string> = {};
                    for (const pg of res.preview.pages) {
                      const cls = (res.classes || []).find((c: any) =>
                        c.grade && c.section && `${c.grade}-${c.section}` === String(pg.pageIndex)
                      );
                      if (cls) mapping[String(pg.pageIndex)] = String(cls.id);
                    }
                    setPdfPageMapping(mapping);
                  }
                } catch (err: any) { setPdfError(err?.message || 'فشل معاينة PDF'); }
                finally { setPdfLoading(false); }
              }}
              disabled={pdfLoading || !pdfFile}
              startIcon={pdfLoading ? <CircularProgress size={18} /> : <CloudUpload />}
            >{pdfLoading ? 'جاري المعاينة...' : 'معاينة'}</Button>
          ) : (
            <Button variant="contained" color="success"
              onClick={async () => {
                if (!token || !pdfFile) return;
                if (isTeacherPdf) {
                  // Teacher cards: classes come from the cells themselves — no mapping needed
                  setPdfLoading(true); setPdfResult(null); setPdfError('');
                  try {
                    const fd = new FormData();
                    fd.append('file', pdfFile);
                    fd.append('school', pdfSchool);
                    fd.append('clear_existing', String(pdfClear));
                    const res = await api.upload('/schedules/upload-pdf', fd, token);
                    setPdfResult(res);
                    loadData();
                  } catch (err: any) { setPdfError(err?.message || 'فشل استيراد PDF'); }
                  finally { setPdfLoading(false); }
                  return;
                }
                // Build pageMapping: map each page's original classId to the selected class
                const mapping: Record<string, string> = {};
                for (const pg of pdfPreview.preview.pages) {
                  const selected = pdfPageMapping[String(pg.pageIndex)];
                  if (selected) mapping[`page-${pg.pageIndex}`] = selected;
                }
                const unmapped = pdfPreview.preview.pages.filter((p: any) => !pdfPageMapping[String(p.pageIndex)]);
                if (unmapped.length > 0) {
                  if (!confirm(`⚠️ ${unmapped.length} صفحة بدون تحديد فصل. هل تريد المتابعة؟`)) return;
                }
                setPdfLoading(true); setPdfResult(null); setPdfError('');
                try {
                  const fd = new FormData();
                  fd.append('file', pdfFile);
                  fd.append('school', pdfSchool);
                  fd.append('clear_existing', String(pdfClear));
                  fd.append('page_mapping', JSON.stringify(mapping));
                  const res = await api.upload('/schedules/upload-pdf', fd, token);
                  setPdfResult(res);
                  loadData();
                } catch (err: any) { setPdfError(err?.message || 'فشل استيراد PDF'); }
                finally { setPdfLoading(false); }
              }}
              disabled={pdfLoading}
              startIcon={pdfLoading ? <CircularProgress size={18} /> : <CloudUpload />}
            >{pdfLoading ? 'جاري الاستيراد...' : 'استيراد'}</Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
