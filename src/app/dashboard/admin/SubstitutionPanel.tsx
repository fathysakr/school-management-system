'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Chip, Alert, CircularProgress, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Tabs, Tab
} from '@mui/material';
import { SwapHoriz, Search, Cancel, CheckCircle, WarningAmber } from '@mui/icons-material';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const dayOfWeekFromDate = (dateStr: string) => ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date(dateStr).getDay()];

export default function SubstitutionPanel() {
  const { token } = useAuth();
  const [tab, setTab] = useState(0);
  const [allSubs, setAllSubs] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const teachingTeachers = teachers.filter((t: any) => !t.user_role || t.user_role.includes('teacher'));
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
    let cancelled = false;
    api.get('/teachers?page=1&limit=100', token).then((t: any) => {
      if (!cancelled) setTeachers(t.teachers || []);
    }).catch(() => { if (!cancelled) setError('فشل تحميل المعلمين'); });
    api.get('/substitutions?limit=500', token).then((s: any) => {
      if (!cancelled) setAllSubs(s.substitutions || []);
    }).catch(() => { if (!cancelled) setError('فشل تحميل البدائل'); })
    .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  };
  useEffect(() => { loadData() }, []);

  const stats = useMemo(() => ({
    total: allSubs.length,
    approved: allSubs.filter(s => s.status === 'approved').length,
    pending: allSubs.filter(s => s.status === 'pending').length,
    cancelled: allSubs.filter(s => s.status === 'cancelled').length,
  }), [allSubs]);

  const toggleAbsent = (id: number) => setAbsentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSuggest = async () => {
    if (!token || absentIds.length === 0) return;
    setSuggestLoading(true);
    setSuggestions([]);
    try {
      const res = await api.post('/substitutions/suggest', { date, absent_teacher_ids: absentIds }, token);
      setSuggestions(res.suggestions || []);
      if (!res.suggestions?.length) setError('لا توجد بدائل متاحة');
    } catch (e: any) {
      setError(e?.message || 'فشل جلب البدائل');
    }
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
    } catch (e: any) {
      setError(e?.message || 'فشل تأكيد البديل');
    }
  };

  const handleCancel = async (id: number) => {
    if (!token) return;
    try {
      await api.put(`/substitutions?id=${id}`, { status: 'cancelled' }, token);
      setSuccess('تم إلغاء البديل');
      loadData();
    } catch (e: any) {
      setError(e?.message || 'فشل الإلغاء');
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Paper sx={{ flex: 1, minWidth: 100, p: 1.5, textAlign: 'center', borderRadius: 2, bgcolor: '#E3F2FD' }}>
          <Typography variant="h5" fontWeight="bold" color="#1565c0">{stats.total}</Typography>
          <Typography variant="caption">إجمالي البدائل</Typography>
        </Paper>
        <Paper sx={{ flex: 1, minWidth: 100, p: 1.5, textAlign: 'center', borderRadius: 2, bgcolor: '#E8F5E9' }}>
          <Typography variant="h5" fontWeight="bold" color="#2e7d32">{stats.approved}</Typography>
          <Typography variant="caption">تم التنفيذ</Typography>
        </Paper>
        <Paper sx={{ flex: 1, minWidth: 100, p: 1.5, textAlign: 'center', borderRadius: 2, bgcolor: '#FFF3E0' }}>
          <Typography variant="h5" fontWeight="bold" color="#e65100">{stats.pending}</Typography>
          <Typography variant="caption">معلق</Typography>
        </Paper>
        <Paper sx={{ flex: 1, minWidth: 100, p: 1.5, textAlign: 'center', borderRadius: 2, bgcolor: '#FFEBEE' }}>
          <Typography variant="h5" fontWeight="bold" color="#c62828">{stats.cancelled}</Typography>
          <Typography variant="caption">ملغي</Typography>
        </Paper>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab icon={<SwapHoriz />} label="تسجيل البدائل" iconPosition="start" />
        <Tab icon={<Search />} label="السجل" iconPosition="start" />
      </Tabs>

      {tab === 0 && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <TextField label="التاريخ" type="date" fullWidth value={date} onChange={e => { setDate(e.target.value); setSuggestions([]); }} InputLabelProps={{ shrink: true }} sx={{ mb: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>اختر المعلمين الغائبين:</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {teachingTeachers.map(t => (
              <Chip key={t.id} label={`${t.first_name} ${t.last_name}`}
                variant={absentIds.includes(t.id) ? 'filled' : 'outlined'}
                color={absentIds.includes(t.id) ? 'error' : 'default'}
                onClick={() => toggleAbsent(t.id)} sx={{ cursor: 'pointer' }} />
            ))}
          </Box>
          <Button variant="contained" onClick={handleSuggest} disabled={absentIds.length === 0 || suggestLoading}
            startIcon={suggestLoading ? <CircularProgress size={18} /> : <SwapHoriz />}>
            {suggestLoading ? 'جاري البحث...' : 'اقتراح البدائل'}
          </Button>

          {suggestions.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>البدائل المقترحة ({suggestions.length}):</Typography>
              {suggestions.map((item, i) => (
                <Paper key={item.subject + item.class_name + item.start_time || i} variant="outlined" sx={{ p: 1.5, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, borderRight: '4px solid #2e7d32' }}>
                  <Box>
                    <Typography variant="body2"><strong>{item.subject}</strong> — {item.class_name}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">{item.start_time} - {item.end_time}</Typography>
                    <Typography variant="caption" color="error">الغائب: {item.absent_teacher_name}</Typography>
                    {item.substitute_teacher_name && <Typography variant="caption" display="block" color="success.main">✅ البديل: {item.substitute_teacher_name} (توافق {item.score}/10)</Typography>}
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
                <TableCell>التاريخ</TableCell><TableCell>المادة</TableCell><TableCell>الفصل</TableCell><TableCell>الوقت</TableCell>
                <TableCell>الغائب</TableCell><TableCell>البديل</TableCell><TableCell>الحالة</TableCell><TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allSubs.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>لا توجد بدائل مسجلة</TableCell></TableRow>
              ) : allSubs.map((s: any) => (
                <TableRow key={s.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                  <TableCell>{s.date}</TableCell>
                  <TableCell>{s.subject}</TableCell>
                  <TableCell>{s.class_name}</TableCell>
                  <TableCell>{s.start_time}</TableCell>
                  <TableCell>{s.absent_first} {s.absent_last}</TableCell>
                  <TableCell>{s.sub_first} {s.sub_last || '—'}</TableCell>
                  <TableCell>
                    <Chip icon={s.status === 'approved' ? <CheckCircle /> : s.status === 'cancelled' ? <Cancel /> : <WarningAmber />}
                      label={s.status === 'approved' ? 'تم' : s.status === 'pending' ? 'معلق' : 'ملغي'} size="small"
                      color={s.status === 'approved' ? 'success' : s.status === 'pending' ? 'warning' : 'error'} />
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
          {confirmOpen && <Typography>تأكيد تعيين <strong>{confirmOpen.substitute_teacher_name}</strong> بديلاً عن <strong>{confirmOpen.absent_teacher_name}</strong> في حصة <strong>{confirmOpen.subject}</strong>؟</Typography>}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmOpen(null)}>إلغاء</Button>
          <Button variant="contained" color="success" onClick={() => handleConfirm(confirmOpen)}>تأكيد</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
