'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Chip, Alert, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Grid, IconButton,
  TablePagination, DialogContentText, Tooltip
} from '@mui/material';
import { Edit, Delete, Campaign, FileDownload, WhatsApp } from '@mui/icons-material';
import { exportToExcel } from '@/lib/excel';
import { hasPermission } from '@/lib/permissions';

const targetLabels: Record<string, string> = {
  all: 'الكل', teachers: 'المعلمون', students: 'الطلاب', parents: 'أولياء الأمور', class: 'فصل معين',
};

export default function AnnouncementsPage() {
  const { user, token, selectedSchool } = useAuth();
  const schoolParam = selectedSchool && selectedSchool !== 'all' ? `&school=${selectedSchool}` : '';
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [sendingWhatsapp, setSendingWhatsapp] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;

  const [formData, setFormData] = useState({
    title: '', content: '', target_audience: 'all', class_id: '',
  });

  const canCreateAnnouncement = hasPermission(user?.role, 'announcements:create');
  const canEditAnnouncement = hasPermission(user?.role, 'announcements:edit');
  const canDeleteAnnouncement = hasPermission(user?.role, 'announcements:delete');

  const fetchAnnouncements = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get(`/announcements?${schoolParam.replace('&', '')}`, token);
      setAnnouncements(res.announcements || []);
    } catch {
      setError('فشل في جلب البيانات');
    } finally {
      setLoading(false);
    }
  }, [token, schoolParam]);

  const fetchClasses = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get(`/classes?page=1&limit=100${schoolParam}`, token);
      setClasses(res.classes || []);
    } catch {}
  }, [token, schoolParam]);

  useEffect(() => { fetchAnnouncements(); if (canCreateAnnouncement) fetchClasses(); }, [token, canCreateAnnouncement, fetchAnnouncements, fetchClasses]);

  const handleOpenDialog = (announcement?: any) => {
    if (announcement) {
      setEditing(announcement);
      setFormData({
        title: announcement.title,
        content: announcement.content,
        target_audience: announcement.target_audience,
        class_id: announcement.class_id || '',
      });
    } else {
      setEditing(null);
      setFormData({ title: '', content: '', target_audience: 'all', class_id: '' });
    }
    setOpenDialog(true);
    setError('');
  };

  const handleSubmit = async () => {
    if (!token || !formData.title || !formData.content) return;
    setError('');

    try {
      if (editing) {
        await api.put(`/announcements?id=${editing.id}`, formData, token);
        setSuccess('تم تحديث الإعلان');
      } else {
        await api.post('/announcements', formData, token);
        setSuccess('تم نشر الإعلان');
      }
      setOpenDialog(false);
      fetchAnnouncements();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    try {
      await api.delete(`/announcements?id=${id}`, token);
      setSuccess('تم حذف الإعلان');
      setDeleteConfirm(null);
      fetchAnnouncements();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    }
  };

  const handleSendWhatsapp = async (a: any) => {
    if (!token) return;
    setSendingWhatsapp(a.id);
    setError('');
    try {
      const res = await api.post(`/announcements/${a.id}/whatsapp`, {}, token);
      setSuccess(res.message || 'تم الإرسال');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل إرسال الواتساب');
    } finally {
      setSendingWhatsapp(null);
    }
  };

  const handleExport = async () => {
    if (!token) return;
    try {
      const rows = announcements.map((a: any) => [
        a.title,
        a.content,
        targetLabels[a.target_audience] || a.target_audience,
        a.published_date || '',
        a.status === 'active' ? 'نشط' : 'مؤرشف',
      ]);
      exportToExcel(['العنوان','المحتوى','الجمهور المستهدف','تاريخ النشر','الحالة'], rows, 'الإعلانات', 'announcements_صفوة_الرواد.xlsx');
      setSuccess('تم تصدير البيانات بنجاح');
    } catch {
      setError('فشل في تصدير البيانات');
    }
  };

  const paginatedRows = announcements.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">الإعلانات</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<FileDownload />} onClick={handleExport}>تصدير Excel</Button>
          {canCreateAnnouncement && (
            <Button variant="contained" startIcon={<Campaign />} onClick={() => handleOpenDialog()}>إعلان جديد</Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Paper sx={{ overflow: 'auto' }}>
        <TableContainer>
          <Table dir="rtl">
            <TableHead>
              <TableRow>
                <TableCell>العنوان</TableCell>
                <TableCell>المحتوى</TableCell>
                <TableCell>الجمهور المستهدف</TableCell>
                <TableCell>تاريخ النشر</TableCell>
                <TableCell>الحالة</TableCell>
                {(canEditAnnouncement || canDeleteAnnouncement) && <TableCell>الإجراءات</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={(canEditAnnouncement || canDeleteAnnouncement) ? 6 : 5} align="center"><CircularProgress /></TableCell></TableRow>
              ) : announcements.length === 0 ? (
                <TableRow><TableCell colSpan={(canEditAnnouncement || canDeleteAnnouncement) ? 6 : 5} align="center">لا توجد إعلانات</TableCell></TableRow>
              ) : (
                paginatedRows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell sx={{ fontWeight: 'bold', maxWidth: 200 }}>{a.title}</TableCell>
                    <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.content}</TableCell>
                    <TableCell>
                      <Chip label={targetLabels[a.target_audience] || a.target_audience} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell>{a.published_date ? new Date(a.published_date).toLocaleDateString('ar-EG') : '—'}</TableCell>
                    <TableCell>
                      <Chip label={a.status === 'active' ? 'نشط' : 'مؤرشف'} size="small" color={a.status === 'active' ? 'success' : 'default'} />
                    </TableCell>
                    {(canEditAnnouncement || canDeleteAnnouncement) && (
                      <TableCell>
                        <Tooltip title="إرسال لأولياء الأمور عبر واتساب">
                          <IconButton
                            size="small"
                            sx={{ color: '#25D366' }}
                            disabled={sendingWhatsapp === a.id}
                            onClick={() => handleSendWhatsapp(a)}
                          >
                            {sendingWhatsapp === a.id ? <CircularProgress size={16} /> : <WhatsApp fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        {canEditAnnouncement && <IconButton size="small" onClick={() => handleOpenDialog(a)}><Edit fontSize="small" /></IconButton>}
                        {canDeleteAnnouncement && <IconButton size="small" color="error" onClick={() => setDeleteConfirm(a.id)}><Delete fontSize="small" /></IconButton>}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {announcements.length > rowsPerPage && (
          <TablePagination
            component="div"
            count={announcements.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[10]}
            labelRowsPerPage="صفوف لكل صفحة"
          />
        )}
      </Paper>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'تعديل الإعلان' : 'إعلان جديد'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><TextField fullWidth label="العنوان" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="المحتوى" multiline rows={4} value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} /></Grid>
            <Grid item xs={12}><FormControl fullWidth><InputLabel>الجمهور المستهدف</InputLabel><Select value={formData.target_audience} label="الجمهور المستهدف" onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}>{Object.entries(targetLabels).map(([val, label]) => (<MenuItem key={val} value={val}>{label}</MenuItem>))}</Select></FormControl></Grid>
            {formData.target_audience === 'class' && (
              <Grid item xs={12}><FormControl fullWidth><InputLabel>الفصل</InputLabel><Select value={formData.class_id} label="الفصل" onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}>{classes.map((c) => <MenuItem key={c.id} value={c.id}>{c.class_name}</MenuItem>)}</Select></FormControl></Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleSubmit}>{editing ? 'تحديث' : 'نشر'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>تأكيد الحذف</DialogTitle>
        <DialogContent><DialogContentText>هل أنت متأكد من حذف هذا الإعلان؟</DialogContentText></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
          <Button color="error" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>حذف</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
