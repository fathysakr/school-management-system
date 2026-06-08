'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, TextField, Chip, Alert, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Grid, IconButton
} from '@mui/material';
import { Save, Edit, Delete, Refresh, Visibility, FileDownload } from '@mui/icons-material';
import { exportToExcel } from '@/lib/excel';
import { hasPermission } from '@/lib/permissions';

const statusLabels: Record<string, string> = {
  present: 'حاضر', absent: 'غائب', late: 'متأخر', excused: 'استئذان', escape: 'هروب',
};

export default function AttendancePage() {
  const { user, token, selectedSchool } = useAuth();
  const schoolParam = selectedSchool && selectedSchool !== 'all' ? `&school=${selectedSchool}` : '';
  const [records, setRecords] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState({ class_id: '', date: new Date().toISOString().split('T')[0], period: 1 });
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<number, string>>({});
  const [editDialog, setEditDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editForm, setEditForm] = useState({ status: '', remarks: '' });

  const canCreateAttendance = hasPermission(user?.role, 'attendance:create');
  const canEditAttendance = hasPermission(user?.role, 'attendance:edit');
  const canDeleteAttendance = hasPermission(user?.role, 'attendance:delete');

  const handleExport = async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (filters.class_id) params.set('class_id', filters.class_id);
      if (filters.date) params.set('date', filters.date);
      params.set('period', String(filters.period));
      params.set('limit', '5000');
      const res = await api.get(`/attendance?${params.toString()}${schoolParam}`, token);
      const rows = (res.attendance || []).map((r: any) => [
        `${r.student_first || ''} ${r.student_last || ''}`.trim() || `طالب #${r.student_id}`,
        r.class_name || `فصل #${r.class_id}`,
        r.attendance_date,
        `الحصة ${r.period || 1}`,
        statusLabels[r.status] || r.status,
        r.remarks || '',
      ]);
      exportToExcel(['الطالب','الفصل','التاريخ','الحصة','الحالة','ملاحظات'], rows, 'الحضور', 'attendance.xlsx');
      setSuccess('تم تصدير البيانات بنجاح');
    } catch {
      setError('فشل في تصدير البيانات');
    }
  };

  const fetchAttendance = async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (filters.class_id) params.set('class_id', filters.class_id);
      if (filters.date) params.set('date', filters.date);
      params.set('period', String(filters.period));
      const res = await api.get(`/attendance?${params.toString()}${schoolParam}`, token);
      setRecords(res.attendance || []);
    } catch {
      setError('فشل في جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    if (!token) return;
    try {
      const res = await api.get(`/classes?page=1&limit=100${schoolParam}`, token);
      setClasses(res.classes || []);
    } catch {}
  };

  useEffect(() => { fetchAttendance(); fetchClasses(); }, [token, filters.class_id, filters.date, filters.period]);

  // Load students when class_id changes and populate attendance map
  useEffect(() => {
    if (!token || !filters.class_id) {
      setStudents([]);
      setAttendanceMap({});
      return;
    }
    const load = async () => {
      try {
        const res = await api.get(`/classes/${filters.class_id}`, token);
        const classStudents = res.students || [];
        setStudents(classStudents);

        // Map existing attendance records to students
        const map: Record<number, string> = {};
        for (const s of classStudents) {
          const existing = records.find((r: any) => r.student_id === s.id);
          map[s.id] = existing ? existing.status : 'present';
        }
        setAttendanceMap(map);
      } catch {
        setError('فشل في جلب طلاب الفصل');
      }
    };
    load();
  }, [filters.class_id]);

  // Update map when records change (from fetch)
  useEffect(() => {
    if (records.length === 0 || students.length === 0) return;
    setAttendanceMap((prev) => {
      const newMap = { ...prev };
      for (const r of records) {
        newMap[r.student_id] = r.status;
      }
      return newMap;
    });
  }, [records]);

  const handleBulkSave = async () => {
    if (!token || !filters.class_id || students.length === 0) return;
    setError('');
    setSaving(true);
    try {
      const recordsToSave = Object.entries(attendanceMap).map(([studentId, status]) => ({
        student_id: parseInt(studentId), status,
      }));
      await api.put('/attendance', {
        class_id: parseInt(filters.class_id),
        attendance_date: filters.date,
        period: filters.period,
        records: recordsToSave,
      }, token);
      setSuccess('تم تسجيل الحضور بنجاح');
      fetchAttendance();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  };

  const handleEditOpen = (record: any) => {
    setEditingRecord(record);
    setEditForm({ status: record.status, remarks: record.remarks || '' });
    setEditDialog(true);
  };

  const handleEditSubmit = async () => {
    if (!token || !editingRecord) return;
    try {
      await api.put(`/attendance/${editingRecord.id}`, editForm, token);
      setSuccess('تم تحديث السجل');
      setEditDialog(false);
      fetchAttendance();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    try {
      await api.delete(`/attendance/${id}`, token);
      setSuccess('تم حذف السجل');
      setDeleteConfirm(null);
      fetchAttendance();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">الحضور والغياب</Typography>
        <Button variant="outlined" startIcon={<FileDownload />} onClick={handleExport}>تصدير Excel</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>الفصل</InputLabel>
              <Select value={filters.class_id} label="الفصل" onChange={(e) => setFilters({ ...filters, class_id: e.target.value })}>
                <MenuItem value="">اختر الفصل</MenuItem>
                {classes.map((c) => <MenuItem key={c.id} value={c.id}>{c.class_name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField fullWidth label="التاريخ" type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth>
              <InputLabel>الحصة</InputLabel>
              <Select value={filters.period} label="الحصة" onChange={(e) => setFilters({ ...filters, period: e.target.value as number })}>
                {Array.from({ length: 7 }, (_, i) => (
                  <MenuItem key={i + 1} value={i + 1}>الحصة {i + 1}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Button variant="contained" fullWidth startIcon={<Refresh />} onClick={fetchAttendance}>تحديث</Button>
          </Grid>
        </Grid>
      </Paper>

      {filters.class_id ? (
        <Paper sx={{ overflow: 'auto' }}>
          {canCreateAttendance ? (
            <>
              <TableContainer>
                <Table dir="rtl">
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>الطالب</TableCell>
                      <TableCell>الحالة</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={3} align="center"><CircularProgress /></TableCell></TableRow>
                    ) : students.length === 0 ? (
                      <TableRow><TableCell colSpan={3} align="center">لا يوجد طلاب في هذا الفصل</TableCell></TableRow>
                    ) : (
                      students.map((s, idx) => (
                        <TableRow key={s.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{s.first_name} {s.last_name}</TableCell>
                          <TableCell sx={{ minWidth: 180 }}>
                            <FormControl size="small" fullWidth>
                              <Select
                                value={attendanceMap[s.id] || 'present'}
                                onChange={(e) => setAttendanceMap({ ...attendanceMap, [s.id]: e.target.value })}
                                sx={{
                                  bgcolor: attendanceMap[s.id] === 'present' ? '#e8f5e9' :
                                           attendanceMap[s.id] === 'absent' ? '#ffebee' :
                                           attendanceMap[s.id] === 'late' ? '#fff3e0' :
                                           attendanceMap[s.id] === 'escape' ? '#ffebee' : '#e3f2fd',
                                  fontWeight: 600,
                                }}
                              >
                                {Object.entries(statusLabels).map(([val, label]) => (
                                  <MenuItem key={val} value={val}>{label}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {students.length > 0 && (
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button variant="contained" size="large" startIcon={<Save />} onClick={handleBulkSave} disabled={saving}>
                    {saving ? 'جاري الحفظ...' : 'حفظ الكل'}
                  </Button>
                </Box>
              )}
            </>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Visibility sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">عرض الحضور - اختر الفصل والتاريخ لعرض السجلات المسجلة</Typography>
            </Box>
          )}
        </Paper>
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">اختر الفصل والتاريخ لعرض الطلاب</Typography>
        </Paper>
      )}

      {/* Existing records */}
      {records.length > 0 && (
        <Paper sx={{ mt: 3, overflow: 'auto' }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight="bold">سجل الحضور المسجل</Typography>
          </Box>
          <TableContainer>
            <Table dir="rtl">
              <TableHead>
                  <TableRow>
                    <TableCell>الطالب</TableCell>
                    <TableCell>الفصل</TableCell>
                    <TableCell>التاريخ</TableCell>
                    <TableCell>الحصة</TableCell>
                    <TableCell>الحالة</TableCell>
                    <TableCell>ملاحظات</TableCell>
                    {(canEditAttendance || canDeleteAttendance) && <TableCell>الإجراءات</TableCell>}
                  </TableRow>
              </TableHead>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.student_first ? `${r.student_first} ${r.student_last}` : `طالب #${r.student_id}`}</TableCell>
                    <TableCell>{r.class_name || `فصل #${r.class_id}`}</TableCell>
                    <TableCell>{r.attendance_date}</TableCell>
                    <TableCell>{r.period || 1}</TableCell>
                    <TableCell>
                      <Chip label={statusLabels[r.status] || r.status}
                        color={r.status === 'present' ? 'success' : r.status === 'absent' ? 'error' : r.status === 'late' ? 'warning' : r.status === 'escape' ? 'error' : 'info'} size="small" />
                    </TableCell>
                    <TableCell>{r.remarks || '-'}</TableCell>
                    {(canEditAttendance || canDeleteAttendance) && (
                      <TableCell>
                        {canEditAttendance && <IconButton size="small" onClick={() => handleEditOpen(r)}><Edit fontSize="small" /></IconButton>}
                        {canDeleteAttendance && <IconButton size="small" color="error" onClick={() => setDeleteConfirm(r.id)}><Delete fontSize="small" /></IconButton>}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>تعديل سجل الحضور</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><FormControl fullWidth><InputLabel>الحالة</InputLabel><Select value={editForm.status} label="الحالة" onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>{Object.entries(statusLabels).map(([val, label]) => (<MenuItem key={val} value={val}>{label}</MenuItem>))}</Select></FormControl></Grid>
            <Grid item xs={12}><TextField fullWidth label="ملاحظات" value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleEditSubmit}>تحديث</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>تأكيد الحذف</DialogTitle>
        <DialogContent>هل أنت متأكد من حذف سجل الحضور هذا؟</DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
          <Button color="error" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>حذف</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
