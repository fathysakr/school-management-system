'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Tabs, Tab, Card, CardContent, Grid, Chip,
  Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Tooltip, Alert, Snackbar,
  LinearProgress, Select, FormControl, InputLabel, Avatar,
} from '@mui/material';
import {
  Psychology, MenuBook,
  Add, Edit, Delete, Visibility, Search,
  CheckCircle, Warning, Assignment,
  EmojiObjects, Favorite, Handshake,
} from '@mui/icons-material';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

const domainConfig = {
  academic: {
    label: 'المهام الأكاديمية',
    icon: <MenuBook />,
    color: '#1565c0',
    description: 'متابعة التحصيل الدراسي للطلاب، والتدخل المبكر لمعالجة حالات التأخر الدراسي وتقديم برامج الدافعية',
    domains: ['academic'],
  },
  psychological: {
    label: 'المهام النفسية والاجتماعية',
    icon: <Favorite />,
    color: '#e91e63',
    description: 'تعزيز الصحة النفسية للطلاب وتقديم الاستشارات الفردية لحل المشكلات',
    domains: ['psychological', 'social'],
  },
  guidance: {
    label: 'المهام التوجيهية والمهنية',
    icon: <EmojiObjects />,
    color: '#ff8f00',
    description: 'توجيه الطلاب لاستكشاف ميولهم وقدراتهم ومساعدتهم في اختيار المسارات التعليمية والمهنية المناسبة',
    domains: ['guidance', 'career'],
  },
  community: {
    label: 'الإشراف والشراكة المجتمعية',
    icon: <Handshake />,
    color: '#2e7d32',
    description: 'إدارة مجالس الآباء وتعزيز الشراكة بين المدرسة والأسرة ومتابعة الانضباط المدرسي',
    domains: ['community'],
  },
};

const entityLabels: Record<string, string> = {
  programs: 'برنامج',
  attendance_reports: 'تقرير',
  cases: 'دراسة حالة',
  contracts: 'عقد سلوك',
  issues: 'مشكلة طلابية',
};

const statusColors: Record<string, string> = {
  active: '#4caf50',
  completed: '#2196f3',
  cancelled: '#f44336',
  open: '#ff9800',
  in_progress: '#2196f3',
  resolved: '#4caf50',
  closed: '#9e9e9e',
  breached: '#f44336',
  referred: '#9c27b0',
};

const statusLabels: Record<string, string> = {
  active: 'نشط', completed: 'مكتمل', cancelled: 'ملغي',
  open: 'مفتوح', in_progress: 'قيد المتابعة', resolved: 'تم الحل',
  closed: 'مغلق', breached: 'مخالف', referred: 'محول',
};

type EntityType = 'programs' | 'attendance_reports' | 'cases' | 'contracts' | 'issues';

export default function CounselingPage() {
  const { user, token, selectedSchool } = useAuth();
  const [tabIndex, setTabIndex] = useState(0);

  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  const tabs = Object.entries(domainConfig).map(([key, cfg]) => ({
    key,
    ...cfg,
  }));

  const [form, setForm] = useState<any>({});

  const fetchStudents = useCallback(async () => {
    if (!token || user?.role === 'parent') return;
    try {
      const res = await api.get(`/students?limit=500&school=${selectedSchool || ''}`, token);
      setStudents(res.students || []);
    } catch {}
  }, [token, selectedSchool, user]);

  const fetchClasses = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get(`/classes?limit=200&school=${selectedSchool || ''}`, token);
      setClasses(res.classes || []);
    } catch {}
  }, [token, selectedSchool]);

  useEffect(() => { fetchStudents(); fetchClasses(); }, [fetchStudents, fetchClasses]);

  const getEntityForTab = (idx: number): EntityType => {
    const key = tabs[idx].key;
    if (key === 'academic') return 'programs';
    if (key === 'psychological') return 'cases';
    if (key === 'guidance') return 'cases';
    return 'programs';
  };

  const fetchRecords = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const tab = tabs[tabIndex];
      const et = getEntityForTab(tabIndex);
      const domains = tab.domains;
      let params = `type=${et}&page=${page + 1}&limit=${rowsPerPage}`;
      if (statusFilter) params += `&status=${statusFilter}`;
      if (search) params += `&search=${encodeURIComponent(search)}`;
      if (selectedSchool && selectedSchool !== 'all') params += `&school=${selectedSchool}`;

      if (et === 'programs') {
        const domainParam = domains.join(',');
        if (domainParam) params += `&domain=${domainParam}`;
      } else if (et === 'cases') {
        const caseTypes = domains.map(d => d === 'psychological' ? 'psychological' : d === 'guidance' ? 'career' : d).filter(d => ['academic', 'behavioral', 'psychological', 'social', 'career'].includes(d));
        if (caseTypes.length === 1) params += `&case_type=${caseTypes[0]}`;
      }

      const res = await api.get(`/counseling?${params}`, token);
      setRecords(res.records || []);
      setTotal(res.pagination?.total || 0);
    } catch (e) {
      setSnackbar({ open: true, message: 'فشل في تحميل البيانات', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [token, tabIndex, page, rowsPerPage, search, statusFilter, selectedSchool, tabs]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const openCreateDialog = () => {
    setEditMode(false);
    setForm({});
    setDialogOpen(true);
  };

  const openEditDialog = (record: any) => {
    setEditMode(true);
    setSelectedRecord(record);
    setForm({ ...record });
    setDialogOpen(true);
  };

  const openViewDialog = (record: any) => {
    setSelectedRecord(record);
    setViewDialogOpen(true);
  };

  const handleSave = async () => {
    if (!token) return;
    try {
      const et = getEntityForTab(tabIndex);
      const payload = { ...form, type: et };
      if (editMode && selectedRecord) {
        await api.put(`/counseling/${selectedRecord.id}`, { ...payload, type: et }, token);
        setSnackbar({ open: true, message: 'تم التحديث بنجاح', severity: 'success' });
      } else {
        await api.post('/counseling', payload, token);
        setSnackbar({ open: true, message: 'تمت الإضافة بنجاح', severity: 'success' });
      }
      setDialogOpen(false);
      fetchRecords();
    } catch (e: any) {
      setSnackbar({ open: true, message: e?.message || 'فشل في الحفظ', severity: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!token || !confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      await api.delete(`/counseling/${id}?type=${getEntityForTab(tabIndex)}`, token);
      setSnackbar({ open: true, message: 'تم الحذف بنجاح', severity: 'success' });
      fetchRecords();
    } catch {
      setSnackbar({ open: true, message: 'فشل في الحذف', severity: 'error' });
    }
  };

  const getStats = () => {
    const total_records = records.length;
    const open_records = records.filter(r => r.status === 'open' || r.status === 'active' || r.status === 'in_progress').length;
    const resolved_records = records.filter(r => r.status === 'resolved' || r.status === 'completed' || r.status === 'closed').length;
    return { total_records, open_records, resolved_records };
  };

  const stats = getStats();
  const et = getEntityForTab(tabIndex);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Psychology sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" fontWeight="bold">الإرشاد الطلابي</Typography>
      </Box>

      {/* Domain Tabs */}
      <Tabs
        value={tabIndex}
        onChange={(_, v) => { setTabIndex(v); setPage(0); setSearch(''); setStatusFilter(''); }}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 3, '& .MuiTab-root': { minHeight: 72, py: 1 } }}
      >
        {tabs.map((tab, i) => (
          <Tab
            key={tab.key}
            icon={<Avatar sx={{ bgcolor: tabIndex === i ? tab.color : 'grey.300', width: 36, height: 36 }}>{tab.icon}</Avatar>}
            label={
              <Box>
                <Typography variant="body2" fontWeight={600}>{tab.label}</Typography>
                <Typography variant="caption" color="text.secondary">{tab.description.slice(0, 30)}...</Typography>
              </Box>
            }
            sx={{ alignItems: 'center', flexDirection: 'row', gap: 1.5, px: 2 }}
          />
        ))}
      </Tabs>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderRadius: 3, bgcolor: '#e3f2fd' }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Assignment sx={{ fontSize: 36, color: '#1565c0', mb: 1 }} />
              <Typography variant="h5" fontWeight={700}>{stats.total_records}</Typography>
              <Typography variant="body2" color="text.secondary">إجمالي السجلات</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderRadius: 3, bgcolor: '#fff3e0' }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Warning sx={{ fontSize: 36, color: '#ff9800', mb: 1 }} />
              <Typography variant="h5" fontWeight={700}>{stats.open_records}</Typography>
              <Typography variant="body2" color="text.secondary">قيد المتابعة</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderRadius: 3, bgcolor: '#e8f5e9' }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <CheckCircle sx={{ fontSize: 36, color: '#4caf50', mb: 1 }} />
              <Typography variant="h5" fontWeight={700}>{stats.resolved_records}</Typography>
              <Typography variant="body2" color="text.secondary">تمت المعالجة</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Action Bar */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="بحث..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ ml: 1, color: 'text.disabled', fontSize: 20 }} /> }}
          sx={{ minWidth: 250 }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>الحالة</InputLabel>
          <Select value={statusFilter} label="الحالة" onChange={e => setStatusFilter(e.target.value)}>
            <MenuItem value="">الكل</MenuItem>
            {Object.entries(statusLabels).map(([k, v]) => (
              <MenuItem key={k} value={k}>{v}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<Add />} onClick={openCreateDialog}>
          إضافة {entityLabels[et]}
        </Button>
      </Paper>

      {/* Table */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        {loading && <LinearProgress />}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {et === 'programs' && (
                  <>
                    <TableCell sx={{ fontWeight: 700 }}>العنوان</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>المجال</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>تاريخ البداية</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>الحالة</TableCell>
                  </>
                )}
                {(et === 'cases' || et === 'attendance_reports' || et === 'contracts' || et === 'issues') && (
                  <>
                    <TableCell sx={{ fontWeight: 700 }}>الطالب</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>الفصل</TableCell>
                    {et === 'cases' && <TableCell sx={{ fontWeight: 700 }}>النوع</TableCell>}
                    {et === 'attendance_reports' && <TableCell sx={{ fontWeight: 700 }}>التقرير</TableCell>}
                    {et === 'issues' && <TableCell sx={{ fontWeight: 700 }}>النوع</TableCell>}
                    {et === 'contracts' && <TableCell sx={{ fontWeight: 700 }}>العنوان</TableCell>}
                    <TableCell sx={{ fontWeight: 700 }}>الحالة</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>التاريخ</TableCell>
                  </>
                )}
                <TableCell sx={{ fontWeight: 700 }}>الإجراءات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">لا توجد سجلات</Typography>
                  </TableCell>
                </TableRow>
              ) : records.map((record: any) => (
                <TableRow key={record.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  {et === 'programs' && (
                    <>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{record.title}</Typography>
                        <Typography variant="caption" color="text.secondary">{record.domain && domainLabels[record.domain]}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={domainLabels[record.domain] || record.domain} size="small" color="primary" variant="outlined" />
                      </TableCell>
                      <TableCell>{record.start_date || '-'}</TableCell>
                      <TableCell>
                        <Chip label={statusLabels[record.status] || record.status} size="small" sx={{ bgcolor: `${statusColors[record.status] || '#9e9e9e'}20`, color: statusColors[record.status] || '#9e9e9e', fontWeight: 600 }} />
                      </TableCell>
                    </>
                  )}
                  {(et === 'cases' || et === 'attendance_reports' || et === 'contracts' || et === 'issues') && (
                    <>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{record.student_name || `#${record.student_id}`}</Typography>
                        <Typography variant="caption" color="text.secondary">{record.student_code}</Typography>
                      </TableCell>
                      <TableCell>{record.class_name || '-'}</TableCell>
                      {et === 'cases' && <TableCell><Chip label={caseTypeLabels[record.case_type] || record.case_type} size="small" /></TableCell>}
                      {et === 'attendance_reports' && <TableCell><Chip label={reportTypeLabels[record.report_type] || record.report_type} size="small" /></TableCell>}
                      {et === 'issues' && <TableCell><Chip label={issueTypeLabels[record.issue_type] || record.issue_type} size="small" /></TableCell>}
                      {et === 'contracts' && <TableCell>{record.title}</TableCell>}
                      <TableCell>
                        <Chip label={statusLabels[record.status] || record.status} size="small" sx={{ bgcolor: `${statusColors[record.status] || '#9e9e9e'}20`, color: statusColors[record.status] || '#9e9e9e', fontWeight: 600 }} />
                      </TableCell>
                      <TableCell>{record.created_at?.slice(0, 10)}</TableCell>
                    </>
                  )}
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="عرض"><IconButton size="small" onClick={() => openViewDialog(record)}><Visibility fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="تعديل"><IconButton size="small" onClick={() => openEditDialog(record)}><Edit fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="حذف"><IconButton size="small" color="error" onClick={() => handleDelete(record.id)}><Delete fontSize="small" /></IconButton></Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          labelRowsPerPage="عدد السجلات"
        />
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editMode ? `تعديل ${entityLabels[et]}` : `إضافة ${entityLabels[et]}`}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {et === 'programs' && (
              <>
                <TextField label="عنوان البرنامج" fullWidth required value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} />
                <TextField select label="المجال" fullWidth required value={form.domain || ''} onChange={e => setForm({ ...form, domain: e.target.value })}>
                  {Object.entries(domainLabels).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                </TextField>
                <TextField label="الوصف" fullWidth multiline rows={3} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
                <TextField label="الأهداف" fullWidth multiline rows={3} value={form.goals || ''} onChange={e => setForm({ ...form, goals: e.target.value })} />
                <TextField label="الفئة المستهدفة" fullWidth value={form.target_group || ''} onChange={e => setForm({ ...form, target_group: e.target.value })} />
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField label="تاريخ البداية" type="date" fullWidth value={form.start_date || ''} onChange={e => setForm({ ...form, start_date: e.target.value })} InputLabelProps={{ shrink: true }} />
                  <TextField label="تاريخ النهاية" type="date" fullWidth value={form.end_date || ''} onChange={e => setForm({ ...form, end_date: e.target.value })} InputLabelProps={{ shrink: true }} />
                </Box>
                {editMode && (
                  <FormControl fullWidth>
                    <InputLabel>الحالة</InputLabel>
                    <Select value={form.status || 'active'} label="الحالة" onChange={e => setForm({ ...form, status: e.target.value })}>
                      <MenuItem value="active">نشط</MenuItem>
                      <MenuItem value="completed">مكتمل</MenuItem>
                      <MenuItem value="cancelled">ملغي</MenuItem>
                    </Select>
                  </FormControl>
                )}
              </>
            )}
            {(et === 'cases' || et === 'attendance_reports' || et === 'contracts' || et === 'issues') && (
              <>
                <FormControl fullWidth>
                  <InputLabel>الطالب</InputLabel>
                  <Select value={form.student_id || ''} label="الطالب" required onChange={e => setForm({ ...form, student_id: e.target.value })}>
                    {students.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.student_id})</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>الفصل</InputLabel>
                  <Select value={form.class_id || ''} label="الفصل" onChange={e => setForm({ ...form, class_id: e.target.value })}>
                    <MenuItem value="">بدون فصل</MenuItem>
                    {classes.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.class_name} - {c.grade}</MenuItem>)}
                  </Select>
                </FormControl>
                {et === 'cases' && (
                  <>
                    <FormControl fullWidth>
                      <InputLabel>نوع الحالة</InputLabel>
                      <Select value={form.case_type || ''} label="نوع الحالة" required onChange={e => setForm({ ...form, case_type: e.target.value })}>
                        {Object.entries(caseTypeLabels).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <TextField label="عنوان الحالة" fullWidth required value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} />
                    <TextField label="الخلفية" fullWidth multiline rows={2} value={form.background || ''} onChange={e => setForm({ ...form, background: e.target.value })} />
                    <TextField label="التحليل" fullWidth multiline rows={2} value={form.analysis || ''} onChange={e => setForm({ ...form, analysis: e.target.value })} />
                    <TextField label="التدخل" fullWidth multiline rows={2} value={form.intervention || ''} onChange={e => setForm({ ...form, intervention: e.target.value })} />
                    <TextField label="النتيجة" fullWidth multiline rows={2} value={form.outcome || ''} onChange={e => setForm({ ...form, outcome: e.target.value })} />
                    <TextField label="التوصيات" fullWidth multiline rows={2} value={form.recommendations || ''} onChange={e => setForm({ ...form, recommendations: e.target.value })} />
                  </>
                )}
                {et === 'attendance_reports' && (
                  <>
                    <FormControl fullWidth>
                      <InputLabel>نوع التقرير</InputLabel>
                      <Select value={form.report_type || ''} label="نوع التقرير" required onChange={e => setForm({ ...form, report_type: e.target.value })}>
                        {Object.entries(reportTypeLabels).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <TextField label="الوصف" fullWidth required multiline rows={3} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
                    <TextField label="الإجراءات المتخذة" fullWidth multiline rows={2} value={form.actions_taken || ''} onChange={e => setForm({ ...form, actions_taken: e.target.value })} />
                    <TextField label="المتابعة" fullWidth multiline rows={2} value={form.follow_up || ''} onChange={e => setForm({ ...form, follow_up: e.target.value })} />
                  </>
                )}
                {et === 'contracts' && (
                  <>
                    <TextField label="عنوان العقد" fullWidth required value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} />
                    <TextField label="الشروط" fullWidth required multiline rows={4} value={form.terms || ''} onChange={e => setForm({ ...form, terms: e.target.value })} />
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <TextField label="تاريخ البداية" type="date" fullWidth value={form.start_date || ''} onChange={e => setForm({ ...form, start_date: e.target.value })} InputLabelProps={{ shrink: true }} />
                      <TextField label="تاريخ النهاية" type="date" fullWidth value={form.end_date || ''} onChange={e => setForm({ ...form, end_date: e.target.value })} InputLabelProps={{ shrink: true }} />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <FormControl>
                        <Typography variant="caption" color="text.secondary" gutterBottom>توقيع الطالب</Typography>
                        <Chip label={form.student_signed ? 'تم التوقيع' : 'لم يتم'} color={form.student_signed ? 'success' : 'default'} onClick={() => setForm({ ...form, student_signed: !form.student_signed })} />
                      </FormControl>
                      <FormControl>
                        <Typography variant="caption" color="text.secondary" gutterBottom>توقيع ولي الأمر</Typography>
                        <Chip label={form.parent_signed ? 'تم التوقيع' : 'لم يتم'} color={form.parent_signed ? 'success' : 'default'} onClick={() => setForm({ ...form, parent_signed: !form.parent_signed })} />
                      </FormControl>
                    </Box>
                  </>
                )}
                {et === 'issues' && (
                  <>
                    <FormControl fullWidth>
                      <InputLabel>نوع المشكلة</InputLabel>
                      <Select value={form.issue_type || ''} label="نوع المشكلة" required onChange={e => setForm({ ...form, issue_type: e.target.value })}>
                        {Object.entries(issueTypeLabels).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <FormControl fullWidth>
                      <InputLabel>مستوى الخطورة</InputLabel>
                      <Select value={form.severity || 'medium'} label="مستوى الخطورة" onChange={e => setForm({ ...form, severity: e.target.value })}>
                        <MenuItem value="low">منخفض</MenuItem>
                        <MenuItem value="medium">متوسط</MenuItem>
                        <MenuItem value="high">عالي</MenuItem>
                        <MenuItem value="critical">خطير</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField label="الوصف" fullWidth required multiline rows={3} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
                    <TextField label="الإجراءات المتخذة" fullWidth multiline rows={3} value={form.actions_taken || ''} onChange={e => setForm({ ...form, actions_taken: e.target.value })} />
                    {editMode && (
                      <FormControl fullWidth>
                        <InputLabel>الحالة</InputLabel>
                        <Select value={form.status || 'open'} label="الحالة" onChange={e => setForm({ ...form, status: e.target.value })}>
                          <MenuItem value="open">مفتوح</MenuItem>
                          <MenuItem value="in_progress">قيد المتابعة</MenuItem>
                          <MenuItem value="resolved">تم الحل</MenuItem>
                          <MenuItem value="closed">مغلق</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                  </>
                )}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleSave}>{editMode ? 'تحديث' : 'إضافة'}</Button>
        </DialogActions>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>تفاصيل {entityLabels[et]}</DialogTitle>
        <DialogContent>
          {selectedRecord && (
            <Box sx={{ pt: 2 }}>
              {et === 'programs' && (
                <>
                  <DetailRow label="العنوان" value={selectedRecord.title} />
                  <DetailRow label="المجال" value={domainLabels[selectedRecord.domain] || selectedRecord.domain} />
                  <DetailRow label="الوصف" value={selectedRecord.description} />
                  <DetailRow label="الأهداف" value={selectedRecord.goals} />
                  <DetailRow label="الفئة المستهدفة" value={selectedRecord.target_group} />
                  <DetailRow label="تاريخ البداية" value={selectedRecord.start_date} />
                  <DetailRow label="تاريخ النهاية" value={selectedRecord.end_date} />
                  <DetailRow label="الحالة" value={statusLabels[selectedRecord.status] || selectedRecord.status} chip color={statusColors[selectedRecord.status]} />
                  <DetailRow label="بواسطة" value={selectedRecord.created_by_email} />
                </>
              )}
              {(et === 'cases' || et === 'attendance_reports' || et === 'contracts' || et === 'issues') && (
                <>
                  <DetailRow label="الطالب" value={`${selectedRecord.student_name || ''} (${selectedRecord.student_code || ''})`} />
                  <DetailRow label="الفصل" value={selectedRecord.class_name || '-'} />
                  {et === 'cases' && (
                    <>
                      <DetailRow label="نوع الحالة" value={caseTypeLabels[selectedRecord.case_type] || selectedRecord.case_type} />
                      <DetailRow label="العنوان" value={selectedRecord.title} />
                      <DetailRow label="الخلفية" value={selectedRecord.background} />
                      <DetailRow label="التحليل" value={selectedRecord.analysis} />
                      <DetailRow label="التدخل" value={selectedRecord.intervention} />
                      <DetailRow label="النتيجة" value={selectedRecord.outcome} />
                      <DetailRow label="التوصيات" value={selectedRecord.recommendations} />
                    </>
                  )}
                  {et === 'attendance_reports' && (
                    <>
                      <DetailRow label="نوع التقرير" value={reportTypeLabels[selectedRecord.report_type] || selectedRecord.report_type} />
                      <DetailRow label="الوصف" value={selectedRecord.description} />
                      <DetailRow label="الإجراءات المتخذة" value={selectedRecord.actions_taken} />
                      <DetailRow label="المتابعة" value={selectedRecord.follow_up} />
                    </>
                  )}
                  {et === 'contracts' && (
                    <>
                      <DetailRow label="العنوان" value={selectedRecord.title} />
                      <DetailRow label="الشروط" value={selectedRecord.terms} />
                      <DetailRow label="تاريخ البداية" value={selectedRecord.start_date} />
                      <DetailRow label="تاريخ النهاية" value={selectedRecord.end_date} />
                      <DetailRow label="توقيع الطالب" value={selectedRecord.student_signed ? 'تم' : 'لم يتم'} />
                      <DetailRow label="توقيع ولي الأمر" value={selectedRecord.parent_signed ? 'تم' : 'لم يتم'} />
                      <DetailRow label="توقيع المرشد" value={selectedRecord.counselor_signed ? 'تم' : 'لم يتم'} />
                    </>
                  )}
                  {et === 'issues' && (
                    <>
                      <DetailRow label="نوع المشكلة" value={issueTypeLabels[selectedRecord.issue_type] || selectedRecord.issue_type} />
                      <DetailRow label="مستوى الخطورة" value={severityLabels[selectedRecord.severity] || selectedRecord.severity} />
                      <DetailRow label="الوصف" value={selectedRecord.description} />
                      <DetailRow label="الإجراءات المتخذة" value={selectedRecord.actions_taken} />
                    </>
                  )}
                  <DetailRow label="الحالة" value={statusLabels[selectedRecord.status] || selectedRecord.status} chip color={statusColors[selectedRecord.status]} />
                  <DetailRow label="المرشد" value={selectedRecord.counselor_email} />
                  <DetailRow label="تاريخ الإضافة" value={selectedRecord.created_at?.slice(0, 10)} />
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>إغلاق</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

function DetailRow({ label, value, chip, color }: { label: string; value?: string | number | null; chip?: boolean; color?: string }) {
  if (!value && value !== 0) return null;
  return (
    <Box sx={{ display: 'flex', py: 1, borderBottom: '1px solid', borderColor: 'divider', gap: 2 }}>
      <Typography variant="body2" fontWeight={600} sx={{ minWidth: 150, color: 'text.secondary' }}>{label}:</Typography>
      {chip && color ? (
        <Chip label={value} size="small" sx={{ bgcolor: `${color}20`, color, fontWeight: 600 }} />
      ) : (
        <Typography variant="body2">{String(value)}</Typography>
      )}
    </Box>
  );
}

const domainLabels: Record<string, string> = {
  academic: 'أكاديمي',
  psychological: 'نفسي',
  guidance: 'توجيهي',
  community: 'اجتماعي',
  social: 'اجتماعي',
  career: 'مهني',
};

const caseTypeLabels: Record<string, string> = {
  academic: 'أكاديمية',
  behavioral: 'سلوكية',
  psychological: 'نفسية',
  social: 'اجتماعية',
  career: 'مهنية',
};

const reportTypeLabels: Record<string, string> = {
  absence: 'غياب',
  behavior: 'سلوك',
  academic: 'تحصيل دراسي',
  general: 'عام',
};

const issueTypeLabels: Record<string, string> = {
  violence: 'عنف',
  bullying: 'تنمر',
  disruption: 'إخلال بالنظام',
  cyber: 'استخدام غير آمن للإنترنت',
  absence: 'غياب',
  other: 'أخرى',
};

const severityLabels: Record<string, string> = {
  low: 'منخفض',
  medium: 'متوسط',
  high: 'عالي',
  critical: 'خطير',
};
