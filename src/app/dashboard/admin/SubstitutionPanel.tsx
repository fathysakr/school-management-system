'use client';
import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Chip, Alert, CircularProgress, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Tabs, Tab
} from '@mui/material';
import { SwapHoriz, Search, Cancel } from '@mui/icons-material';
import { api } from '@/lib/api';

function dayOfWeekFromDate(dateStr: string): string {
  const d = new Date(dateStr);
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getDay()];
}

const dayLabels: Record<string, string> = {
  sunday: 'الأحد', monday: 'الاثنين', tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء', thursday: 'الخميس',
};

export default function SubstitutionPanel() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const [tab, setTab] = useState(0);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [substitutions, setSubstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [absentIds, setAbsentIds] = useState<number[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState<any>(null);

  const loadData = () => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      api.get('/teachers?page=1&limit=100', token),
      api.get(`/substitutions?date=${date}`, token),
    ]).then(([t, s]: any[]) => {
      setTeachers(t.teachers || []);
      setSubstitutions(s.substitutions || []);
    }).catch(() => setError('فشل تحميل البيانات'))
    .finally(() => setLoading(false));
  };

  useEffect(() => { loadData() }, [date]);
  useEffect(() => { if (token) loadData() }, []);

  const toggleAbsent = (id: number) => {
    setAbsentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSuggest = async () => {
    if (!token || absentIds.length === 0) return;
    setSuggestLoading(true);
    setSuggestions([]);
    try {
      const res = await api.post('/substitutions/suggest', { date, absent_teacher_ids: absentIds }, token);
      setSuggestions(res.suggestions || []);
      if (!res.suggestions?.length) setError('لا توجد بدائل متاحة');
    } catch { setError('فشل جلب البدائل') }
    finally { setSuggestLoading(false) }
  };

  const handleConfirm = async (item: any) => {
    if (!token) return;
    try {
      await api.post('/substitutions', {
        date, absent_teacher_id: item.absent_teacher_id, substitute_teacher_id: item.substitute_teacher_id,
        schedule_id: item.schedule_id, subject: item.subject, class_id: item.class_id,
        day_of_week: dayOfWeekFromDate(date), start_time: item.start_time, end_time: item.end_time,
        reason: '', status: 'approved',
      }, token);
      setSuccess('تم تأكيد البديل');
      setConfirmOpen(null);
      loadData();
    } catch { setError('فشل تأكيد البديل') }
  };

  const handleCancel = async (id: number) => {
    if (!token) return;
    try {
      await api.put(`/substitutions?id=${id}`, { status: 'cancelled' }, token);
      setSuccess('تم إلغاء البديل');
      loadData();
    } catch { setError('فشل الإلغاء') }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab icon={<SwapHoriz />} label="تسجيل البدائل" iconPosition="start" />
        <Tab icon={<Search />} label="سجل البدائل" iconPosition="start" />
      </Tabs>

      {tab === 0 && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <TextField label="التاريخ" type="date" fullWidth value={date} onChange={e => setDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ mb: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>اختر المعلمين الغائبين:</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {teachers.map(t => (
              <Chip key={t.id} label={`${t.first_name} ${t.last_name}`} variant={absentIds.includes(t.id) ? 'filled' : 'outlined'} color={absentIds.includes(t.id) ? 'error' : 'default'} onClick={() => toggleAbsent(t.id)} sx={{ cursor: 'pointer' }} />
            ))}
          </Box>
          <Button variant="contained" onClick={handleSuggest} disabled={absentIds.length === 0 || suggestLoading} startIcon={suggestLoading ? <CircularProgress size={18} /> : <SwapHoriz />}>
            {suggestLoading ? 'جاري البحث...' : 'اقتراح البدائل'}
          </Button>

          {suggestions.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>البدائل المقترحة:</Typography>
              {suggestions.map((item, i) => (
                <Paper key={i} variant="outlined" sx={{ p: 1.5, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Box>
                    <Typography variant="body2"><strong>{item.subject}</strong> — {item.class_name}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.start_time} - {item.end_time} | الغائب: {item.absent_teacher_name}</Typography>
                    {item.substitute_teacher_name && <Typography variant="caption" display="block" color="success.main">✅ البديل المقترح: {item.substitute_teacher_name} (توافق {item.score}/10)</Typography>}
                  </Box>
                  <Button size="small" variant="contained" onClick={() => setConfirmOpen(item)}>تأكيد</Button>
                </Paper>
              ))}
            </Box>
          )}
        </Paper>
      )}

      {tab === 1 && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>التاريخ</TableCell><TableCell>اليوم</TableCell><TableCell>المادة</TableCell><TableCell>الفصل</TableCell><TableCell>الوقت</TableCell>
                <TableCell>الغائب</TableCell><TableCell>البديل</TableCell><TableCell>الحالة</TableCell><TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              ) : substitutions.length === 0 ? (
                <TableRow><TableCell colSpan={9} align="center" sx={{ color: 'text.secondary' }}>لا توجد بدائل</TableCell></TableRow>
              ) : substitutions.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>{s.date}</TableCell>
                  <TableCell>{dayLabels[s.day_of_week] || s.day_of_week}</TableCell>
                  <TableCell>{s.subject}</TableCell>
                  <TableCell>{s.class_name}</TableCell>
                  <TableCell>{s.start_time} - {s.end_time}</TableCell>
                  <TableCell>{s.absent_first} {s.absent_last}</TableCell>
                  <TableCell>{s.sub_first} {s.sub_last || '—'}</TableCell>
                  <TableCell>
                    <Chip label={s.status === 'approved' ? 'تم' : s.status === 'pending' ? 'معلق' : 'ملغي'} size="small" color={s.status === 'approved' ? 'success' : s.status === 'pending' ? 'warning' : 'error'} />
                  </TableCell>
                  <TableCell>
                    {s.status !== 'cancelled' && <IconButton size="small" color="error" onClick={() => handleCancel(s.id)}><Cancel fontSize="small" /></IconButton>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!confirmOpen} onClose={() => setConfirmOpen(null)}>
        <DialogTitle>تأكيد البديل</DialogTitle>
        <DialogContent>
          {confirmOpen && (
            <Typography>تأكيد تعيين {confirmOpen.substitute_teacher_name} بديلاً عن {confirmOpen.absent_teacher_name} في حصة {confirmOpen.subject}؟</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmOpen(null)}>إلغاء</Button>
          <Button variant="contained" color="success" onClick={() => handleConfirm(confirmOpen)}>تأكيد</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
