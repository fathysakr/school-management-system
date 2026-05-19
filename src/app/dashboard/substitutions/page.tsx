'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import {
  Box, Typography, Button, TextField, Alert, CircularProgress,
  Chip, Grid, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Tooltip, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { SwapHoriz, Close, Check, Delete, Event, History, Refresh } from '@mui/icons-material';

const dayLabels: Record<string, string> = {
  sunday: 'الأحد', monday: 'الاثنين', tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء', thursday: 'الخميس',
};

export default function SubstitutionsPage() {
  const { user, token, selectedSchool } = useAuth();
  const [tab, setTab] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const teachingTeachers = teachers.filter(t => !t.user_role || t.user_role.includes('teacher'));
  const [selectedAbsent, setSelectedAbsent] = useState<number[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDate, setHistoryDate] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<any>(null);

  const schoolParam = selectedSchool && selectedSchool !== 'all' ? `&school=${selectedSchool}` : '';
  const canView = hasPermission(user?.role, 'substitutions:view');
  const canEdit = hasPermission(user?.role, 'substitutions:edit');
  const canDelete = hasPermission(user?.role, 'substitutions:delete');

  useEffect(() => {
    if (!token || !canView) return;
    api.get(`/teachers?page=1&limit=200${schoolParam}`, token)
      .then(res => setTeachers(res.teachers || []))
      .catch(() => {});
  }, [token, canView]);

  const fetchHistory = useCallback(async () => {
    if (!token || !canView) return;
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (historyDate) params.set('date', historyDate);
      const res = await api.get(`/substitutions?${params.toString()}`, token);
      setHistory(res.substitutions || []);
    } catch { setError('فشل في جلب السجل'); }
    finally { setHistoryLoading(false); }
  }, [token, canView, historyDate]);

  useEffect(() => {
    if (tab === 1) fetchHistory();
  }, [tab, fetchHistory]);

  const handleSuggest = async () => {
    if (!token || selectedAbsent.length === 0) {
      setError('اختر معلمين غائبين على الأقل');
      return;
    }
    setSuggesting(true);
    setError('');
    setSuggestions([]);
    try {
      const res = await api.post('/substitutions/suggest', { date, absent_teacher_ids: selectedAbsent }, token);
      setSuggestions(res.suggestions || []);
      
      if ((res.suggestions || []).length === 0) setSuccess(res.message || 'لا توجد حصص للمعلمين الغائبين');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل في اقتراح البدائل');
    } finally { setSuggesting(false); }
  };

  const handleConfirmSuggestion = async (suggestion: any, teacherId: number) => {
    if (!token) return;
    try {
      await api.post('/substitutions', {
        date, absent_teacher_id: suggestion.absent_teacher.id,
        substitute_teacher_id: teacherId,
        schedule_id: suggestion.schedule_id,
        subject: suggestion.subject,
        class_id: suggestion.class_id,
        day_of_week: suggestion.day_of_week,
        start_time: suggestion.start_time,
        end_time: suggestion.end_time,
      }, token);
      setSuccess(`تم تأكيد البديل بنجاح`);
      setSuggestions(prev => prev.filter(s => s.schedule_id !== suggestion.schedule_id));
      setConfirmDialog(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل في تأكيد البديل');
    }
  };

  const handleCancelSub = async (id: number) => {
    if (!token) return;
    try {
      await api.put(`/substitutions/${id}`, { status: 'cancelled' }, token);
      setSuccess('تم إلغاء البديل');
      fetchHistory();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل في الإلغاء');
    }
  };

  const handleDeleteSub = async (id: number) => {
    if (!token) return;
    try {
      await api.delete(`/substitutions/${id}`, token);
      setSuccess('تم حذف البديل');
      fetchHistory();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل في الحذف');
    }
  };

  const toggleAbsent = (id: number) => {
    setSelectedAbsent(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const statusColor: Record<string, string> = {
    pending: '#f57c00', approved: '#2e7d32', rejected: '#d32f2f', cancelled: '#757575',
  };
  const statusLabel: Record<string, string> = {
    pending: 'معلق', approved: 'معتمد', rejected: 'مرفوض', cancelled: 'ملغي',
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <SwapHoriz sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" fontWeight="bold">حصص الانتظار</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')} action={<IconButton size="small" onClick={() => setError('')}><Close fontSize="small" /></IconButton>}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')} action={<IconButton size="small" onClick={() => setSuccess('')}><Close fontSize="small" /></IconButton>}>{success}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="تسجيل البدائل" icon={<Event />} iconPosition="start" />
        <Tab label="سجل البدائل" icon={<History />} iconPosition="start" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>اختيار التاريخ والمعلمين الغائبين</Typography>
            <Grid container spacing={2} alignItems="flex-end">
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth label="التاريخ" type="date"
                  value={date} onChange={(e) => setDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <Button
                  variant="contained" color="primary"
                  onClick={handleSuggest}
                  disabled={suggesting || selectedAbsent.length === 0}
                  startIcon={suggesting ? <CircularProgress size={18} color="inherit" /> : <SwapHoriz />}
                  sx={{ height: 40 }}
                >
                  {suggesting ? 'جاري البحث...' : 'اقتراح البدائل'}
                </Button>
              </Grid>
            </Grid>
            <Box sx={{ mt: 2, maxHeight: 200, overflow: 'auto' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>اختر المعلمين الغائبين:</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {teachingTeachers.map((t) => (
                  <Chip
                    key={t.id}
                    label={`${t.first_name} ${t.last_name}`}
                    color={selectedAbsent.includes(t.id) ? 'error' : 'default'}
                    variant={selectedAbsent.includes(t.id) ? 'filled' : 'outlined'}
                    onClick={() => toggleAbsent(t.id)}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
                {teachingTeachers.length === 0 && <Typography variant="body2" color="text.disabled">لا يوجد معلمون</Typography>}
              </Box>
            </Box>
          </Paper>

          {suggestions.length > 0 && (
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <SwapHoriz color="primary" />
                <Typography variant="h6" fontWeight={600}>البدائل المقترحة</Typography>
                <Chip label={`${suggestions.length} حصة`} size="small" color="primary" />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                التاريخ: {date} - اليوم: {dayLabels[dayOfWeekFromDate(date)] || ''}
              </Typography>
              <TableContainer>
              <Table size="small" dir="rtl">
                <TableHead>
                  <TableRow>
                    <TableCell>الفصل</TableCell>
                    <TableCell>المادة</TableCell>
                    <TableCell>الوقت</TableCell>
                      <TableCell>المعلم الغائب</TableCell>
                      <TableCell>البديل المقترح</TableCell>
                      <TableCell>بدائل أخرى</TableCell>
                      <TableCell>إجراء</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {suggestions.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell>{s.class_name}</TableCell>
                        <TableCell>{s.subject}</TableCell>
                        <TableCell>{s.start_time} - {s.end_time}</TableCell>
                        <TableCell>
                          <Chip label={s.absent_teacher.name} size="small" color="error" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          {s.suggested_teacher ? (
                            <Chip
                              label={`${s.suggested_teacher.name}${s.suggested_teacher.specialization ? ` (${s.suggested_teacher.specialization})` : ''}`}
                              size="small" color="success"
                              onClick={() => setConfirmDialog({ suggestion: s, teacherId: s.suggested_teacher.id })}
                              sx={{ cursor: 'pointer' }}
                            />
                          ) : <Typography variant="caption" color="error">لا يوجد معلم متاح</Typography>}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {s.alternatives?.filter((alt: any) => alt.id !== s.suggested_teacher?.id).map((alt: any, j: number) => (
                              <Chip
                                key={j} size="small" variant="outlined"
                                label={`${alt.name} (${alt.score})`}
                                onClick={() => setConfirmDialog({ suggestion: s, teacherId: alt.id })}
                                sx={{ cursor: 'pointer' }}
                              />
                            ))}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {s.suggested_teacher && (
                            <Button size="small" variant="contained" color="success"
                              onClick={() => setConfirmDialog({ suggestion: s, teacherId: s.suggested_teacher.id })}>
                              <Check fontSize="small" /> تأكيد
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Box>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
            <TextField label="تصفية بالتاريخ" type="date" value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)} InputLabelProps={{ shrink: true }}
              size="small" />
            <Button variant="outlined" onClick={() => setHistoryDate('')}>إظهار الكل</Button>
            <IconButton onClick={fetchHistory}><Refresh /></IconButton>
          </Box>
          {historyLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : history.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>لا توجد بدائل مسجلة</Typography>
          ) : (
            <TableContainer>
              <Table size="small" dir="rtl">
                <TableHead>
                  <TableRow>
                    <TableCell>التاريخ</TableCell>
                    <TableCell>الفصل</TableCell>
                    <TableCell>المادة</TableCell>
                    <TableCell>الوقت</TableCell>
                    <TableCell>المعلم الغائب</TableCell>
                    <TableCell>البديل</TableCell>
                    <TableCell>الحالة</TableCell>
                    <TableCell>إجراء</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((h: any) => (
                    <TableRow key={h.id}>
                      <TableCell>{h.date}</TableCell>
                      <TableCell>{h.class_name}</TableCell>
                      <TableCell>{h.subject}</TableCell>
                      <TableCell>{h.start_time}</TableCell>
                      <TableCell>{h.absent_first} {h.absent_last}</TableCell>
                      <TableCell>{h.sub_first} {h.sub_last || '—'}</TableCell>
                      <TableCell>
                        <Chip label={statusLabel[h.status] || h.status} size="small"
                          sx={{ bgcolor: `${statusColor[h.status] || '#757575'}20`, color: statusColor[h.status] || '#757575', fontWeight: 600 }} />
                      </TableCell>
                      <TableCell>
                        {h.status === 'approved' && canEdit && (
                          <Tooltip title="إلغاء"><IconButton size="small" color="warning" onClick={() => handleCancelSub(h.id)}><Close fontSize="small" /></IconButton></Tooltip>
                        )}
                        {canDelete && (
                          <Tooltip title="حذف"><IconButton size="small" color="error" onClick={() => handleDeleteSub(h.id)}><Delete fontSize="small" /></IconButton></Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      <Dialog open={!!confirmDialog} onClose={() => setConfirmDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>تأكيد البديل</DialogTitle>
        <DialogContent>
          {confirmDialog && (
            <Box sx={{ py: 2 }}>
              <Typography><strong>الفصل:</strong> {confirmDialog.suggestion.class_name}</Typography>
              <Typography><strong>المادة:</strong> {confirmDialog.suggestion.subject}</Typography>
              <Typography><strong>الوقت:</strong> {confirmDialog.suggestion.start_time} - {confirmDialog.suggestion.end_time}</Typography>
              <Typography><strong>المعلم الغائب:</strong> {confirmDialog.suggestion.absent_teacher.name}</Typography>
              <Typography><strong>البديل:</strong> {(() => {
                const t = teachers.find((t: any) => t.id === confirmDialog.teacherId);
                return t ? `${t.first_name} ${t.last_name}` : 'غير محدد';
              })()}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(null)}>إلغاء</Button>
          <Button variant="contained" color="success" onClick={() => {
            if (confirmDialog) handleConfirmSuggestion(confirmDialog.suggestion, confirmDialog.teacherId);
          }}>تأكيد</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function dayOfWeekFromDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const days = ['sunday', 'saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];
  return days[d.getDay()] || '';
}
