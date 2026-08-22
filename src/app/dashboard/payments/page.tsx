'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, CircularProgress, Grid, IconButton,
  Tabs, Tab, MenuItem, Autocomplete, Tooltip, Chip, Card, CardContent,
} from '@mui/material';
import { Edit, Delete, Payments as PaymentsIcon, Print, Savings, TrendingUp, Warning } from '@mui/icons-material';
import { hasPermission } from '@/lib/permissions';

const TERM_OPTIONS = ['مصروفات دراسية', 'مواصلات', 'كتب وزي مدرسي', 'أنشطة ورحلات', 'أخرى'];
const METHOD_LABELS: Record<string, string> = {
  cash: 'نقدي', bank: 'تحويل بنكي', wallet: 'محفظة إلكترونية', other: 'أخرى',
};

export default function FeesPage() {
  const { user, token } = useAuth();
  const [tab, setTab] = useState(0);
  const [payments, setPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const [studentInput, setStudentInput] = useState('');
  const [studentOptions, setStudentOptions] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const searchTimer = useRef<any>(null);

  const [formData, setFormData] = useState({
    amount: '', payment_date: new Date().toISOString().slice(0, 10),
    term: TERM_OPTIONS[0], method: 'cash', receipt_no: '', notes: '',
  });

  const [feeDialogOpen, setFeeDialogOpen] = useState(false);
  const [feeStudent, setFeeStudent] = useState<any>(null);
  const [feeValue, setFeeValue] = useState('');

  const canCreate = hasPermission(user?.role, 'fees:create');
  const canEdit = hasPermission(user?.role, 'fees:edit');
  const canDelete = hasPermission(user?.role, 'fees:delete');

  const fetchPayments = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/payments?limit=200', token);
      setPayments(res.payments || []);
    } catch (e: any) {
      setError(e?.message || 'فشل في جلب الدفعات');
    }
  }, [token]);

  const fetchSummary = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/payments/summary', token);
      setSummary(res);
    } catch {}
  }, [token]);

  useEffect(() => {
    if (!token) return;
    Promise.all([fetchPayments(), fetchSummary()]).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(''), 4000); return () => clearTimeout(t); }
  }, [error]);
  useEffect(() => {
    if (successMsg) { const t = setTimeout(() => setSuccessMsg(''), 4000); return () => clearTimeout(t); }
  }, [successMsg]);

  const searchStudents = useCallback((q: string) => {
    if (!token) return;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get(`/students?search=${encodeURIComponent(q)}&limit=20`, token);
        setStudentOptions(res.students || []);
      } catch {}
    }, 300);
  }, [token]);

  const openCreate = () => {
    setEditing(null);
    setSelectedStudent(null);
    setStudentInput('');
    setFormData({
      amount: '', payment_date: new Date().toISOString().slice(0, 10),
      term: TERM_OPTIONS[0], method: 'cash', receipt_no: '', notes: '',
    });
    setFormOpen(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setSelectedStudent({ id: p.student_id, first_name: p.student_name });
    setFormData({
      amount: String(p.amount), payment_date: String(p.payment_date).slice(0, 10),
      term: p.term || TERM_OPTIONS[0], method: p.method || 'cash',
      receipt_no: p.receipt_no || '', notes: p.notes || '',
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedStudent) { setError('يجب اختيار الطالب'); return; }
    if (!formData.amount || parseFloat(formData.amount) <= 0) { setError('أدخل مبلغاً صحيحاً'); return; }
    try {
      if (editing) {
        await api.put(`/payments/${editing.id}`, formData, token);
        setSuccessMsg('تم تحديث الدفعة');
      } else {
        await api.post('/payments', { ...formData, student_id: selectedStudent.id }, token);
        setSuccessMsg('تم تسجيل الدفعة بنجاح');
      }
      setFormOpen(false);
      fetchPayments(); fetchSummary();
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/payments/${id}`, token);
      setSuccessMsg('تم حذف الدفعة');
      setDeleteConfirm(null);
      fetchPayments(); fetchSummary();
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ');
    }
  };

  const saveAnnualFee = async () => {
    if (!feeStudent) return;
    try {
      await api.post('/payments/student-fee', { student_id: feeStudent.id, annual_fee: feeValue }, token);
      setSuccessMsg('تم تحديث الرسوم السنوية');
      setFeeDialogOpen(false);
      fetchSummary();
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ');
    }
  };

  const fmt = (n: any) => Number(n || 0).toLocaleString('ar-EG');

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">الرسوم الدراسية</Typography>
        {canCreate && (
          <Button variant="contained" startIcon={<PaymentsIcon />} onClick={openCreate}>
            تسجيل دفعة جديدة
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg('')}>{successMsg}</Alert>}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUp color="primary" />
                <Typography variant="body2" color="text.secondary">محصل هذا الشهر</Typography>
              </Box>
              <Typography variant="h5" fontWeight="bold" sx={{ mt: 1 }}>{fmt(summary?.month_total)} جنيه</Typography>
              <Typography variant="caption" color="text.secondary">{summary?.month_count || 0} دفعة</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PaymentsIcon sx={{ color: '#2e7d32' }} />
                <Typography variant="body2" color="text.secondary">محصل اليوم</Typography>
              </Box>
              <Typography variant="h5" fontWeight="bold" sx={{ mt: 1 }}>{fmt(summary?.today_total)} جنيه</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Warning sx={{ color: '#ed6c02' }} />
                <Typography variant="body2" color="text.secondary">طلاب متأخرون</Typography>
              </Box>
              <Typography variant="h5" fontWeight="bold" sx={{ mt: 1 }}>{summary?.arrears?.length || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Savings sx={{ color: '#d32f2f' }} />
                <Typography variant="body2" color="text.secondary">إجمالي المتأخرات</Typography>
              </Box>
              <Typography variant="h5" fontWeight="bold" sx={{ mt: 1 }}>{fmt(summary?.arrears_total)} جنيه</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ borderRadius: 3, mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="سجل الدفعات" />
          <Tab label={`تقرير المتأخرات (${summary?.arrears?.length || 0})`} />
        </Tabs>

        {tab === 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>الطالب</TableCell>
                  <TableCell>المرحلة</TableCell>
                  <TableCell>المبلغ</TableCell>
                  <TableCell>البند</TableCell>
                  <TableCell>طريقة الدفع</TableCell>
                  <TableCell>التاريخ</TableCell>
                  <TableCell>إيصال</TableCell>
                  {(canEdit || canDelete) && <TableCell align="left">إجراءات</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.student_name}<br /><Typography variant="caption" color="text.secondary">{p.student_code}</Typography></TableCell>
                    <TableCell><Chip size="small" label={p.student_school === 'middle' ? 'متوسط' : 'ثانوي'} /></TableCell>
                    <TableCell><strong>{fmt(p.amount)}</strong> جنيه</TableCell>
                    <TableCell>{p.term}</TableCell>
                    <TableCell>{METHOD_LABELS[p.method] || p.method}</TableCell>
                    <TableCell>{String(p.payment_date).slice(0, 10)}</TableCell>
                    <TableCell>{p.receipt_no || '-'}</TableCell>
                    {(canEdit || canDelete) && (
                      <TableCell align="left">
                        {canEdit && (
                          <Tooltip title="تعديل"><IconButton size="small" onClick={() => openEdit(p)}><Edit fontSize="small" /></IconButton></Tooltip>
                        )}
                        {canDelete && (
                          <Tooltip title="حذف"><IconButton size="small" onClick={() => setDeleteConfirm(p.id)}><Delete fontSize="small" color="error" /></IconButton></Tooltip>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {!payments.length && (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>لا توجد دفعات مسجلة بعد</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {tab === 1 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
              <Button variant="outlined" startIcon={<Print />} onClick={() => window.print()}>
                طباعة التقرير
              </Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>الطالب</TableCell>
                    <TableCell>الصف</TableCell>
                    <TableCell>الرسوم السنوية</TableCell>
                    <TableCell>المسدد</TableCell>
                    <TableCell>المتبقي</TableCell>
                    {canEdit && <TableCell align="left">تحديد الرسوم</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(summary?.arrears || []).map((a: any) => (
                    <TableRow key={a.id} hover>
                      <TableCell>{a.student_name}<br /><Typography variant="caption" color="text.secondary">{a.student_id}</Typography></TableCell>
                      <TableCell>{a.grade}</TableCell>
                      <TableCell>{fmt(a.annual_fee)}</TableCell>
                      <TableCell sx={{ color: '#2e7d32' }}>{fmt(a.paid)}</TableCell>
                      <TableCell><strong style={{ color: '#d32f2f' }}>{fmt(a.remaining)}</strong></TableCell>
                      {canEdit && (
                        <TableCell align="left">
                          <Button size="small" variant="outlined" onClick={() => { setFeeStudent(a); setFeeValue(String(a.annual_fee || '')); setFeeDialogOpen(true); }}>
                            تعديل الرسوم
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {!(summary?.arrears || []).length && (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>لا توجد متأخرات 🎉</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Alert severity="info" sx={{ m: 2 }}>
              حدد «الرسوم السنوية» لكل طالب من زر «تعديل الرسوم» ليظهر تلقائياً في تقرير المتأخرات بعد خصم ما دفعه.
            </Alert>
          </Box>
        )}
      </Paper>

      {/* Create/Edit dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'تعديل دفعة' : 'تسجيل دفعة جديدة'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Autocomplete
              options={studentOptions}
              getOptionLabel={(o: any) => `${o.first_name} ${o.last_name} (${o.student_id})`}
              disabled={!!editing}
              value={selectedStudent}
              inputValue={studentInput}
              onInputChange={(_, v) => { setStudentInput(v); searchStudents(v); }}
              onChange={(_, v) => setSelectedStudent(v)}
              renderInput={(params) => <TextField {...params} label="ابحث عن الطالب بالاسم أو الكود" required />}
            />
            <TextField label="المبلغ (جنيه)" type="number" value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
            <TextField label="تاريخ الدفع" type="date" value={formData.payment_date}
              onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })} InputLabelProps={{ shrink: true }} />
            <TextField select label="البند" value={formData.term}
              onChange={(e) => setFormData({ ...formData, term: e.target.value })}>
              {TERM_OPTIONS.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <TextField select label="طريقة الدفع" value={formData.method}
              onChange={(e) => setFormData({ ...formData, method: e.target.value })}>
              {Object.entries(METHOD_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </TextField>
            <TextField label="رقم الإيصال (اختياري)" value={formData.receipt_no}
              onChange={(e) => setFormData({ ...formData, receipt_no: e.target.value })} />
            <TextField label="ملاحظات (اختياري)" multiline rows={2} value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleSubmit}>{editing ? 'حفظ التعديل' : 'تسجيل الدفعة'}</Button>
        </DialogActions>
      </Dialog>

      {/* Annual fee dialog */}
      <Dialog open={feeDialogOpen} onClose={() => setFeeDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>الرسوم السنوية — {feeStudent?.student_name}</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth type="number" label="إجمالي الرسوم السنوية (جنيه)"
            value={feeValue} onChange={(e) => setFeeValue(e.target.value)}
            sx={{ mt: 1 }} helperText="اكتب 0 لإخفاء الطالب من تقرير المتأخرات" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFeeDialogOpen(false)}>إلغاء</Button>
          <Button variant="contained" onClick={saveAnnualFee}>حفظ</Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>تأكيد الحذف</DialogTitle>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
          <Button color="error" variant="contained" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>حذف</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
