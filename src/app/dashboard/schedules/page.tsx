'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton, Alert, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Grid, Tabs, Tab
} from '@mui/material';
import { Add, Close, CalendarToday, FilterList, FileDownload } from '@mui/icons-material';
import { exportToExcel } from '@/lib/excel';
import { hasPermission } from '@/lib/permissions';

const dayLabels: Record<string, string> = {
  sunday: 'الأحد', monday: 'الاثنين', tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء', thursday: 'الخميس',
};
const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];

const classColors = [
  '#E3F2FD', '#F3E5F5', '#E8F5E9', '#FFF3E0', '#FCE4EC',
  '#E0F7FA', '#FFF8E1', '#F1F8E9', '#EDE7F6', '#E8EAF6',
  '#FFEBEE', '#E0F2F1', '#FBE9E7', '#F9FBE7', '#F3E5F5',
];

export default function SchedulesPage() {
  const { user, token, selectedSchool } = useAuth();
  const schoolParam = selectedSchool && selectedSchool !== 'all' ? `&school=${selectedSchool}` : '';
  const [schedules, setSchedules] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [viewTab, setViewTab] = useState(0);
  const [formData, setFormData] = useState({
    class_id: '', teacher_id: '', subject: '', day_of_week: 'sunday',
    start_time: '08:00', end_time: '09:00', room_number: '',
  });

  const canCreateSchedule = hasPermission(user?.role, 'schedules:create');
  const canEditSchedule = hasPermission(user?.role, 'schedules:edit');

  const handleExport = async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (selectedClass) params.set('class_id', selectedClass);
      params.set('limit', '500');
      const res = await api.get(`/schedules?${params.toString()}${schoolParam}`, token);
      const rows = (res.schedules || []).map((s: any) => [
        s.class_name || '',
        s.subject,
        `${s.teacher_first || ''} ${s.teacher_last || ''}`.trim() || '',
        dayLabels[s.day_of_week] || s.day_of_week,
        s.start_time,
        s.end_time,
        s.room_number || '',
      ]);
      exportToExcel(['الفصل','المادة','المعلم','اليوم','بداية','نهاية','القاعة'], rows, 'الجداول', 'schedules_صفوة_الرواد.xlsx');
      setSuccess('تم تصدير البيانات بنجاح');
    } catch {
      setError('فشل في تصدير البيانات');
    }
  };

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.get(`/classes?page=1&limit=100${schoolParam}`, token),
      api.get(`/teachers?page=1&limit=100${schoolParam}`, token),
    ]).then(([classesRes, teachersRes]) => {
      setClasses(classesRes.classes || []);
      setTeachers(teachersRes.teachers || []);
    }).catch(() => setError('فشل في جلب البيانات'));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
api.get(`/schedules${selectedClass ? `?class_id=${selectedClass}${schoolParam}` : `?${schoolParam.replace('&', '')}`}`, token)
      .then(res => setSchedules(res.schedules || []))
      .catch(() => setError('فشل في جلب الجدول'))
      .finally(() => setLoading(false));
  }, [token, selectedClass]);

  const timeSlots = Array.from({ length: 8 }, (_, i) => {
    const start = 8 + i;
    return {
      start: `${String(start).padStart(2, '0')}:00`,
      end: `${String(start + 1).padStart(2, '0')}:00`,
      label: `${String(start).padStart(2, '0')}:00 - ${String(start + 1).padStart(2, '0')}`,
    };
  });

  const getClassColor = (classId: string) => {
    const idx = parseInt(classId) % classColors.length;
    return classColors[idx];
  };

  const handleOpenDialog = (schedule?: any) => {
    if (schedule) {
      setEditing(schedule);
      setFormData({
        class_id: schedule.class_id.toString(),
        teacher_id: schedule.teacher_id.toString(),
        subject: schedule.subject,
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        room_number: schedule.room_number || '',
      });
    } else {
      setEditing(null);
      setFormData({
        class_id: selectedClass || (classes[0]?.id?.toString() || ''),
        teacher_id: '', subject: '', day_of_week: 'sunday',
        start_time: '08:00', end_time: '09:00', room_number: '',
      });
    }
    setOpenDialog(true);
    setError('');
  };

  const handleSubmit = async () => {
    if (!token) return;
    setError('');
    try {
      if (editing) {
        await api.put(`/schedules?id=${editing.id}`, formData, token);
        setSuccess('تم تحديث الحصة');
      } else {
        await api.post('/schedules', formData, token);
        setSuccess('تم إضافة الحصة');
      }
      setOpenDialog(false);
      const res = await api.get(`/schedules${selectedClass ? `?class_id=${selectedClass}` : ''}`, token);
      setSchedules(res.schedules || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    }
  };

  const filteredSchedules = selectedClass
    ? schedules.filter(s => s.class_id === parseInt(selectedClass))
    : schedules;

  const renderTimetable = (className: string, classId: number) => {
    const classSchedules = filteredSchedules.filter(s => s.class_id === classId);

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main' }}>
          {className}
        </Typography>
        <Box sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)' }}>
                <th style={{ padding: '12px 16px', color: 'white', fontWeight: 600, minWidth: 120, textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
                  الوقت
                </th>
                {days.map(d => (
                  <th key={d} style={{ padding: '12px 8px', color: 'white', fontWeight: 600, minWidth: 140, textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
                    {dayLabels[d]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot, rowIdx) => {
                const hasAny = days.some(d =>
                  classSchedules.some(s =>
                    s.day_of_week === d && s.start_time === slot.start
                  )
                );
                if (!hasAny && !classSchedules.some(s => s.start_time >= slot.start && s.start_time < slot.end)) return null;

                return (
                  <tr key={rowIdx} style={{ background: rowIdx % 2 === 0 ? '#fafbfc' : '#f5f6f8' }}>
                    <td style={{
                      padding: '8px 16px', fontWeight: 600, textAlign: 'center',
                      borderLeft: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0',
                      fontSize: 13, color: '#555', whiteSpace: 'nowrap'
                    }}>
                      {slot.label}
                    </td>
                    {days.map(d => {
                      const slotSchedule = classSchedules.find(s =>
                        s.day_of_week === d && s.start_time === slot.start
                      );

                      return (
                        <td key={d} style={{
                          padding: '4px', borderLeft: '1px solid #e0e0e0',
                          borderBottom: '1px solid #e0e0e0', verticalAlign: 'top',
                          height: 70
                        }}>
                          {slotSchedule ? (
                            <Box
                              sx={{
                                height: '100%',
                                borderRadius: 1.5,
                                p: 1,
                                bgcolor: getClassColor(slotSchedule.class_id.toString()),
                                borderLeft: '3px solid #1976d2',
                                  cursor: canEditSchedule ? 'pointer' : 'default',
                                  '&:hover': canEditSchedule ? { boxShadow: '0 2px 8px rgba(0,0,0,0.15)' } : {},
                                }}
                                onClick={() => canEditSchedule && handleOpenDialog(slotSchedule)}
                            >
                              <Typography sx={{ fontWeight: 700, fontSize: 12, color: '#1a1a2e', mb: 0.5 }}>
                                {slotSchedule.subject}
                              </Typography>
                              <Typography sx={{ fontSize: 10, color: '#555', lineHeight: 1.4 }}>
                                {slotSchedule.teacher_first} {slotSchedule.teacher_last}
                              </Typography>
                              {slotSchedule.room_number && (
                                <Typography sx={{ fontSize: 9, color: '#888', mt: 0.5 }}>
                                  🏫 {slotSchedule.room_number}
                                </Typography>
                              )}
                            </Box>
                          ) : (
                            <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Typography sx={{ color: '#ccc', fontSize: 18 }}>-</Typography>
                            </Box>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Box>
      </Box>
    );
  };

  const renderFullTimetable = () => {
    const classIds = [...new Set(schedules.map(s => s.class_id))];
    const classSchedulesMap: Record<number, any[]> = {};
    classIds.forEach(cid => {
      classSchedulesMap[cid] = schedules.filter(s => s.class_id === cid);
    });

    const allTimeSlots = [...new Set(schedules.map(s => s.start_time))].sort();

    return (
      <Box sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 2 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
          <thead>
            <tr style={{ background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)' }}>
              <th style={{ padding: '12px 16px', color: 'white', fontWeight: 600, minWidth: 100, textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
                الوقت
              </th>
              {days.map(d => (
                <th key={d} style={{ padding: '12px 8px', color: 'white', fontWeight: 600, minWidth: 140, textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
                  {dayLabels[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allTimeSlots.map((startTime, idx) => {
              const endMatch = schedules.find(s => s.start_time === startTime);
              const endTime = endMatch?.end_time || '';
              const hasAny = days.some(d =>
                schedules.some(s => s.day_of_week === d && s.start_time === startTime)
              );
              if (!hasAny) return null;

              return (
                <tr key={startTime} style={{ background: idx % 2 === 0 ? '#fafbfc' : '#f5f6f8' }}>
                  <td style={{
                    padding: '8px 16px', fontWeight: 600, textAlign: 'center',
                    borderLeft: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0',
                    fontSize: 13, color: '#555', whiteSpace: 'nowrap'
                  }}>
                    {startTime} - {endTime}
                  </td>
                  {days.map(d => {
                    const daySlots = schedules.filter(s => s.day_of_week === d && s.start_time === startTime);

                    return (
                      <td key={d} style={{
                        padding: '4px', borderLeft: '1px solid #e0e0e0',
                        borderBottom: '1px solid #e0e0e0', verticalAlign: 'top',
                        minHeight: 60
                      }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {daySlots.map((s) => (
                            <Box
                              key={s.id}
                              sx={{
                                borderRadius: 1,
                                p: 0.75,
                                bgcolor: getClassColor(s.class_id.toString()),
                                borderLeft: '3px solid #1976d2',
                                cursor: canEditSchedule ? 'pointer' : 'default',
                                '&:hover': canEditSchedule ? { boxShadow: '0 2px 8px rgba(0,0,0,0.15)' } : {},
                              }}
                              onClick={() => canEditSchedule && handleOpenDialog(s)}
                            >
                              <Typography sx={{ fontWeight: 700, fontSize: 11, color: '#1a1a2e' }}>
                                {s.subject}
                              </Typography>
                              <Typography sx={{ fontSize: 10, color: '#555' }}>
                                {s.class_name} | {s.teacher_first} {s.teacher_last}
                              </Typography>
                              {s.room_number && (
                                <Typography sx={{ fontSize: 9, color: '#888' }}>
                                  {s.room_number}
                                </Typography>
                              )}
                            </Box>
                          ))}
                        </Box>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Box>
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CalendarToday sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" fontWeight="bold">الجدول الدراسي</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>الفصل</InputLabel>
            <Select value={selectedClass} label="الفصل" onChange={(e) => setSelectedClass(e.target.value)}>
              <MenuItem value="">جميع الفصول</MenuItem>
              {classes.map((c) => <MenuItem key={c.id} value={c.id}>{c.class_name}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="outlined" startIcon={<FileDownload />} onClick={handleExport}>تصدير Excel</Button>
          {canCreateSchedule && (
            <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()}>إضافة حصة</Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}<IconButton size="small" onClick={() => setError('')}><Close fontSize="small" /></IconButton></Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}<IconButton size="small" onClick={() => setSuccess('')}><Close fontSize="small" /></IconButton></Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Tabs value={viewTab} onChange={(_, v) => setViewTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="الجدول الكامل" icon={<FilterList />} iconPosition="start" />
            <Tab label="حسب الفصول" icon={<CalendarToday />} iconPosition="start" />
          </Tabs>

          {viewTab === 0 && renderFullTimetable()}
          {viewTab === 1 && (
            <Box>
              {selectedClass ? (
                (() => {
                  const cls = classes.find(c => c.id === parseInt(selectedClass));
                  return cls ? renderTimetable(cls.class_name, cls.id) : null;
                })()
              ) : (
                classes.map((c) => (
                  <Box key={c.id} sx={{ mb: 2, px: 2, py: 1, bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider' }}>
                    {renderTimetable(c.class_name, c.id)}
                  </Box>
                ))
              )}
            </Box>
          )}
        </>
      )}

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white' }}>
          {editing ? 'تعديل الحصة' : 'إضافة حصة جديدة'}
          <IconButton onClick={() => setOpenDialog(false)} sx={{ position: 'absolute', left: 8, top: 8, color: 'white' }}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '24px !important' }}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>الفصل</InputLabel>
                <Select value={formData.class_id} label="الفصل" onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}>
                  {classes.map((c) => <MenuItem key={c.id} value={c.id}>{c.class_name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>المعلم</InputLabel>
                <Select value={formData.teacher_id} label="المعلم" onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}>
                  {teachers.map((t) => <MenuItem key={t.id} value={t.id}>{t.first_name} {t.last_name} - {t.specialization || ''}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="المادة" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>اليوم</InputLabel>
                <Select value={formData.day_of_week} label="اليوم" onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}>
                  {days.map(d => <MenuItem key={d} value={d}>{dayLabels[d]}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="القاعة" value={formData.room_number} onChange={(e) => setFormData({ ...formData, room_number: e.target.value })} placeholder="مثال: قاعة 101" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="وقت البداية" type="time" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="وقت النهاية" type="time" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenDialog(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleSubmit}>{editing ? 'تحديث' : 'إضافة'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
