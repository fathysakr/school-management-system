'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, Alert, Chip, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, FormControl, InputLabel, Select, MenuItem,
  CircularProgress, IconButton
} from '@mui/material';
import { hasPermission } from '@/lib/permissions';
import { Add, Delete, CalendarMonth } from '@mui/icons-material';

const leaveTypeLabels: Record<string, string> = {
  sick: 'مرضي',
  personal: 'شخصي',
  emergency: 'طارئ',
  annual: 'سنوي',
};

const leaveTypeColors: Record<string, string> = {
  sick: 'error',
  personal: 'warning',
  emergency: 'info',
  annual: 'success',
};

const statusLabels: Record<string, string> = {
  pending: 'قيد الانتظار',
  approved: 'تمت الموافقة',
  rejected: 'مرفوض',
};

const statusColors: Record<string, 'warning' | 'success' | 'error'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

export default function LeavesPage() {
  const { user, token } = useAuth();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ leave_type: 'sick', start_date: '', end_date: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!token) return;
    loadLeaves();
  }, [user, token]);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const res = await api.get('/leaves', token);
      setLeaves(res.leaves || []);
    } catch { setMessage('فشل تحميل الإجازات'); }
    finally { setLoading(false); }
  };

  const submitLeave = async () => {
    if (!form.start_date || !form.end_date) { setMessage('تاريخ البداية والنهاية مطلوبان'); return; }
    setSaving(true);
    setMessage('');
    try {
      await api.post('/leaves', form, token);
      setMessage('تم تقديم طلب الإجازة');
      setDialogOpen(false);
      loadLeaves();
    } catch (e: any) { setMessage(e?.message || 'فشل تقديم الطلب'); }
    setSaving(false);
  };

  const deleteLeave = async (id: number) => {
    if (!token) return;
    setDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    if (!token || deleteConfirm === null) return;
    try {
      await api.delete(`/leaves/${deleteConfirm}`, token);
      setDeleteConfirm(null);
      loadLeaves();
    } catch { setMessage('فشل الحذف'); setDeleteConfirm(null); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <CalendarMonth sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" fontWeight="bold">طلبات الإجازات</Typography>
        <Box sx={{ flexGrow: 1 }} />
        {hasPermission(user?.role, 'settings:edit') && <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>تقديم إجازة</Button>}
        {!hasPermission(user?.role, 'settings:edit') && <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>تقديم إجازة</Button>}
      </Box>
      {message && <Alert severity={message.includes('فشل') ? 'error' : 'success'} sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}
      <TableContainer component={Paper} variant="outlined">
        <Table dir="rtl">
          <TableHead>
            <TableRow>
              <TableCell>نوع الإجازة</TableCell>
              <TableCell>تاريخ البداية</TableCell>
              <TableCell>تاريخ النهاية</TableCell>
              <TableCell>السبب</TableCell>
              <TableCell>الحالة</TableCell>
              <TableCell>تاريخ التقديم</TableCell>
              <TableCell>إجراءات</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {leaves.length === 0 ? (
              <TableRow><TableCell colSpan={7} align="center">لا توجد إجازات</TableCell></TableRow>
            ) : leaves.map((l: any) => (
              <TableRow key={l.id}>
                <TableCell><Chip label={leaveTypeLabels[l.leave_type] || l.leave_type} size="small" color={(leaveTypeColors[l.leave_type] as any) || 'default'} /></TableCell>
                <TableCell>{l.start_date}</TableCell>
                <TableCell>{l.end_date}</TableCell>
                <TableCell>{l.reason || '—'}</TableCell>
                <TableCell><Chip label={statusLabels[l.status] || l.status} size="small" color={statusColors[l.status] || 'default'} /></TableCell>
                <TableCell>{l.created_at ? new Date(l.created_at).toLocaleDateString('ar-EG') : '—'}</TableCell>
                <TableCell>
                  {l.status === 'pending' && (l.user_id === user?.id || hasPermission(user?.role, 'settings:edit')) && (
                    <IconButton size="small" color="error" onClick={() => deleteLeave(l.id)}><Delete /></IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>تقديم طلب إجازة</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>نوع الإجازة</InputLabel>
              <Select value={form.leave_type} label="نوع الإجازة" onChange={(e) => setForm({ ...form, leave_type: e.target.value })}>
                <MenuItem value="sick">مرضي</MenuItem>
                <MenuItem value="personal">شخصي</MenuItem>
                <MenuItem value="emergency">طارئ</MenuItem>
                <MenuItem value="annual">سنوي</MenuItem>
              </Select>
            </FormControl>
            <TextField label="تاريخ البداية" type="date" fullWidth value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })} InputLabelProps={{ shrink: true }} />
            <TextField label="تاريخ النهاية" type="date" fullWidth value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })} InputLabelProps={{ shrink: true }} />
            <TextField label="السبب" fullWidth multiline rows={3} value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)}>إلغاء</Button>
          <Button variant="contained" onClick={submitLeave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'تقديم'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Delete color="error" />
          حذف الإجازة
        </DialogTitle>
        <DialogContent>
          <Typography>هل أنت متأكد من حذف هذه الإجازة؟</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
          <Button variant="contained" color="error" onClick={confirmDelete} startIcon={<Delete />}>تأكيد الحذف</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
