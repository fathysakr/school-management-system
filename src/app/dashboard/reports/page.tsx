'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  Box, Typography, Button, Paper, TextField, Chip, Alert, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Grid, Card, CardContent,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Avatar,
  Divider
} from '@mui/material';
import {
  Add, Edit, Delete, Close, Assignment, Warning, Psychology, MenuBook,
  EmojiEvents, Print, FilterAlt, PersonSearch,
  FactCheck, CalendarMonth, FileDownload, PictureAsPdf
} from '@mui/icons-material';
import { exportToExcel } from '@/lib/excel';
import { hasPermission } from '@/lib/permissions';

const reportConfig = {
  activity: {
    label: 'تقرير نشاط', icon: <Assignment />, color: '#1976d2', lightBg: '#e3f2fd',
  },
  positive: {
    label: 'تقرير إيجابي', icon: <EmojiEvents />, color: '#2e7d32', lightBg: '#e8f5e9',
  },
  behavioral: {
    label: 'تقرير سلوكي', icon: <Psychology />, color: '#ed6c02', lightBg: '#fff3e0',
  },
  academic_deficiency: {
    label: 'تقرير قصور دراسي', icon: <MenuBook />, color: '#d32f2f', lightBg: '#ffebee',
  },
};

const mainTabs = [
  { value: 'activity', label: 'النشاط', icon: <Assignment sx={{ fontSize: 40 }} />, config: reportConfig.activity },
  { value: 'positive', label: 'إيجابي', icon: <EmojiEvents sx={{ fontSize: 40 }} />, config: reportConfig.positive },
  { value: 'negative', label: 'سلبي', icon: <Warning sx={{ fontSize: 40 }} />, config: null },
];

const formatDate = (d: string) => {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
};

const printContent = (html: string) => {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head><meta charset="utf-8"><title>تقرير طالب</title>
    <style>
      @page { margin: 1.5cm; size: A4; }
      body { font-family: 'Traditional Arabic', 'Arial', sans-serif; padding: 20px; color: #333; }
      .header { text-align: center; border-bottom: 2px solid #1976d2; padding-bottom: 15px; margin-bottom: 20px; }
      .header h1 { color: #1976d2; margin: 0 0 5px; font-size: 24px; }
      .header p { color: #666; margin: 0; font-size: 14px; }
      .student-info { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
      .student-info table { width: 100%; }
      .student-info td { padding: 4px 10px; font-size: 14px; }
      .report-card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px; page-break-inside: avoid; }
      .report-card .type-badge { display: inline-block; padding: 3px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; color: #fff; margin-bottom: 8px; }
      .report-card h3 { margin: 0 0 5px; font-size: 16px; }
      .report-card .meta { color: #888; font-size: 12px; margin-bottom: 8px; }
      .report-card .content { line-height: 1.8; font-size: 14px; }
      .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 12px; color: #999; }
      @media print { .no-print { display: none; } body { padding: 0; } }
    </style>
    </head><body>${html}
    <div class="footer">تم إنشاء هذا التقرير بواسطة نظام مدرسة صفوة الرواد الأهلية</div>
    </body></html>
  `);
  win.document.close();
  setTimeout(() => { win.print(); }, 500);
};

export default function ReportsPage() {
  const { user, token, selectedSchool } = useAuth();
  const schoolParam = selectedSchool && selectedSchool !== 'all' ? `&school=${selectedSchool}` : '';
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');

  const [mainTab, setMainTab] = useState('activity');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const handleExport = async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (selectedClass) params.set('class_id', selectedClass);
      if (selectedStudent) params.set('student_id', selectedStudent);
      if (selectedTeacher) params.set('teacher_id', selectedTeacher);
      params.set('limit', '2000');
      const res = await api.get(`/teacher-reports?${params.toString()}${schoolParam}`, token);
      const rows = (res.reports || []).map((r: any) => [
        reportConfig[r.report_type as keyof typeof reportConfig]?.label || r.report_type,
        r.title || '',
        r.content,
        `${r.student_first || ''} ${r.student_last || ''}`.trim() || '',
        r.class_name || '',
        `${r.teacher_first || ''} ${r.teacher_last || ''}`.trim() || '',
        r.date || '',
      ]);
      exportToExcel(['النوع','العنوان','المحتوى','الطالب','الفصل','المعلم','التاريخ'], rows, 'التقارير', 'reports_صفوة_الرواد.xlsx');
      setSuccess('تم تصدير البيانات بنجاح');
    } catch {
      setError('فشل في تصدير البيانات');
    }
  };
  const [negativeTab, setNegativeTab] = useState('behavioral');

  // Student file state
  const [studentFileOpen, setStudentFileOpen] = useState(false);
  const [fileStudent, setFileStudent] = useState<any>(null);
  const [fileReports, setFileReports] = useState<any[]>([]);
  const [fileLoading, setFileLoading] = useState(false);

  const [formData, setFormData] = useState({
    teacher_id: '', student_id: '', class_id: '', title: '', content: '', date: new Date().toISOString().split('T')[0],
  });

  const getCurrentType = () => {
    if (mainTab === 'activity') return 'activity';
    if (mainTab === 'positive') return 'positive';
    return negativeTab;
  };

  const currentType = getCurrentType();
  const currentCfg = reportConfig[currentType as keyof typeof reportConfig];
  const isCounselor = user?.role === 'middle_counselor' || user?.role === 'high_counselor';
  const isSupervisor = user?.role === 'admin' || user?.role === 'middle_supervisor' || user?.role === 'high_supervisor' || isCounselor;
  const canCreateReport = hasPermission(user?.role, 'reports:create');
  const canEditReport = hasPermission(user?.role, 'reports:edit');
  const canDeleteReport = hasPermission(user?.role, 'reports:delete');

  useEffect(() => {
    if (!token) return;
    const fetchMeta = async () => {
      try {
        const [cRes, tRes, sRes] = await Promise.all([
          api.get(`/classes?page=1&limit=100${schoolParam}`, token),
          canEditReport ? api.get(`/teachers?page=1&limit=100${schoolParam}`, token) : Promise.resolve({ teachers: [] }),
          api.get(`/students?page=1&limit=500${schoolParam}`, token).catch(() => ({ students: [] })),
        ]);
        setClasses(cRes.classes || []);
        if (tRes?.teachers) setTeachers(tRes.teachers);
        if (sRes?.students) setAllStudents(sRes.students);
      } catch {}
    };
    fetchMeta();
  }, [token, canEditReport]);

  useEffect(() => {
    if (!token || !selectedClass) { setStudents([]); return; }
    api.get(`/students?page=1&limit=200&class_id=${selectedClass}${schoolParam}`, token)
      .then(res => setStudents(res.students || []))
      .catch(() => setError('فشل تحميل الطلاب'));
  }, [token, selectedClass]);

  const fetchReports = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('report_type', currentType);
      if (selectedClass) params.set('class_id', selectedClass);
      if (selectedStudent) params.set('student_id', selectedStudent);
      if (selectedTeacher) params.set('teacher_id', selectedTeacher);
      params.set('limit', '100');
      const res = await api.get(`/teacher-reports?${params.toString()}${schoolParam}`, token);
      setReports(res.reports || []);
    } catch {
      setError('فشل في جلب التقارير');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, [token, currentType, selectedClass, selectedStudent, selectedTeacher]);

  const dialogStudents = useMemo(() => {
    if (!formData.class_id) return allStudents;
    return allStudents.filter((s: any) => String(s.class_id) === String(formData.class_id));
  }, [allStudents, formData.class_id]);

  const handleOpenDialog = (report?: any) => {
    if (report) {
      setEditing(report);
      setFormData({
        teacher_id: report.teacher_id.toString(),
        student_id: report.student_id.toString(),
        class_id: report.class_id.toString(),
        title: report.title || '',
        content: report.content,
        date: report.date,
      });
    } else {
      setEditing(null);
      setFormData({
        teacher_id: '',
        student_id: '', class_id: selectedClass || '',
        title: '', content: '',
        date: new Date().toISOString().split('T')[0],
      });
    }
    setOpenDialog(true);
    setError('');
  };

  const handleSubmit = async () => {
    if (!token) return;
    setError('');
    try {
      const payload = { ...formData, report_type: currentType };
      if (editing) {
        await api.put(`/teacher-reports?id=${editing.id}`, payload, token);
        setSuccess('تم تحديث التقرير');
      } else {
        await api.post('/teacher-reports', payload, token);
        setSuccess('تم إضافة التقرير');
      }
      setOpenDialog(false);
      fetchReports();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    setDeleteConfirm(id);
  };

  const confirmDeleteReport = async () => {
    if (!token || deleteConfirm === null) return;
    try {
      await api.delete(`/teacher-reports?id=${deleteConfirm}`, token);
      setSuccess('تم حذف التقرير');
      setDeleteConfirm(null);
      fetchReports();
    } catch {
      setError('فشل الحذف');
      setDeleteConfirm(null);
    }
  };

  // Student file: fetch ALL reports for a student
  const openStudentFile = async (student: any) => {
    if (!token) return;
    setFileStudent(student);
    setStudentFileOpen(true);
    setFileLoading(true);
    try {
      const res = await api.get(`/teacher-reports?student_id=${student.id}&limit=200${schoolParam}`, token);
      setFileReports(res.reports || []);
    } catch {
      setFileReports([]);
    } finally {
      setFileLoading(false);
    }
  };

  const printStudentFile = () => {
    if (!fileStudent || fileReports.length === 0) return;
    const reportsHtml = fileReports.map(r => {
      const cfg = reportConfig[r.report_type as keyof typeof reportConfig] || reportConfig.activity;
      return `
        <div class="report-card" style="border-right: 4px solid ${cfg.color};">
          <span class="type-badge" style="background: ${cfg.color};">${cfg.label}</span>
          <h3>${r.title || cfg.label}</h3>
          <div class="meta">${r.teacher_first} ${r.teacher_last} · ${r.class_name} · ${formatDate(r.date)}</div>
          <div class="content">${r.content}</div>
        </div>
      `;
    }).join('');

    const html = `
      <div class="header">
        <h1>ملف الطالب</h1>
        <p>مدرسة صفوة الرواد الأهلية</p>
      </div>
      <div class="student-info">
        <table>
          <tr><td><strong>الاسم:</strong> ${fileStudent.first_name} ${fileStudent.last_name}</td>
              <td><strong>الرقم:</strong> ${fileStudent.student_id}</td></tr>
          <tr><td><strong>الفصل:</strong> ${fileReports[0]?.class_name || '-'}</td>
              <td><strong>عدد التقارير:</strong> ${fileReports.length}</td></tr>
        </table>
      </div>
      <h2 style="font-size:18px;color:#1976d2;margin-bottom:15px;">جميع التقارير</h2>
      ${reportsHtml}
    `;
    printContent(html);
  };

  const printCurrentReports = () => {
    if (reports.length === 0) return;
    const reportsHtml = reports.map(r => {
      const cfg = reportConfig[r.report_type as keyof typeof reportConfig] || reportConfig.activity;
      return `
        <div class="report-card" style="border-right: 4px solid ${cfg.color};">
          <span class="type-badge" style="background: ${cfg.color};">${cfg.label}</span>
          <h3>${r.title || cfg.label}</h3>
          <div class="meta">${r.student_first} ${r.student_last} · ${r.teacher_first} ${r.teacher_last} · ${r.class_name} · ${formatDate(r.date)}</div>
          <div class="content">${r.content}</div>
        </div>
      `;
    }).join('');

    const html = `
      <div class="header">
        <h1>${currentCfg?.label}</h1>
        <p>مدرسة صفوة الرواد الأهلية - ${reports.length} تقرير</p>
      </div>
      ${reportsHtml}
    `;
    printContent(html);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <FactCheck sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" fontWeight="bold">التقارير</Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} action={<IconButton size="small" color="inherit" onClick={() => setError('')}><Close fontSize="small" /></IconButton>}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} action={<IconButton size="small" color="inherit" onClick={() => setSuccess('')}><Close fontSize="small" /></IconButton>}>{success}</Alert>}

      {/* Negative sub-tabs */}
      {mainTab === 'negative' && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 2 }}>
          <Chip icon={<Psychology />} label="سلوكي" onClick={() => setNegativeTab('behavioral')}
            color={negativeTab === 'behavioral' ? 'warning' : 'default'}
            variant={negativeTab === 'behavioral' ? 'filled' : 'outlined'} sx={{ px: 1.5, py: 2, fontSize: 14 }} />
          <Chip icon={<MenuBook />} label="قصور دراسي" onClick={() => setNegativeTab('academic_deficiency')}
            color={negativeTab === 'academic_deficiency' ? 'error' : 'default'}
            variant={negativeTab === 'academic_deficiency' ? 'filled' : 'outlined'} sx={{ px: 1.5, py: 2, fontSize: 14 }} />
        </Box>
      )}

      {/* Main tabs */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {mainTabs.map((t) => {
          const isActive = mainTab === t.value;
          if (t.value === 'negative') {
            return (
              <Grid item xs={4} key={t.value}>
                <Paper onClick={() => setMainTab('negative')}
                  sx={{ p: 2, textAlign: 'center', cursor: 'pointer', borderRadius: 3,
                    border: isActive ? '2px solid #ed6c02' : '2px solid transparent',
                    bgcolor: isActive ? '#fff3e0' : 'background.paper',
                    transition: 'all 0.2s',
                    '&:hover': { bgcolor: isActive ? '#fff3e0' : 'action.hover', transform: 'translateY(-3px)', boxShadow: 3 },
                  }}>
                  <Warning sx={{ fontSize: 40, color: isActive ? '#ed6c02' : 'text.disabled' }} />
                  <Typography fontWeight="bold" sx={{ mt: 0.5 }}>{t.label}</Typography>
                </Paper>
              </Grid>
            );
          }
          const cfg = t.config!;
          return (
            <Grid item xs={4} key={t.value}>
              <Paper onClick={() => setMainTab(t.value)}
                sx={{ p: 2, textAlign: 'center', cursor: 'pointer', borderRadius: 3,
                  border: isActive ? `2px solid ${cfg.color}` : '2px solid transparent',
                  bgcolor: isActive ? cfg.lightBg : 'background.paper',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: isActive ? cfg.lightBg : 'action.hover', transform: 'translateY(-3px)', boxShadow: 3 },
                }}>
                <Box sx={{ color: isActive ? cfg.color : 'text.disabled' }}>{t.icon}</Box>
                <Typography fontWeight="bold" sx={{ mt: 0.5 }}>{t.label}</Typography>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      {/* Banner */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: currentCfg?.lightBg || 'grey.50', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: currentCfg?.color || 'primary.main', width: 40, height: 40 }}>
            {currentCfg && React.cloneElement(currentCfg.icon as React.ReactElement, { sx: { color: '#fff', fontSize: 22 } })}
          </Avatar>
          <Box>
            <Typography fontWeight="bold" sx={{ color: currentCfg?.color }}>{currentCfg?.label}</Typography>
            <Typography variant="caption" color="text.secondary">{reports.length} تقرير</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" variant={showFilters ? 'contained' : 'outlined'} startIcon={<FilterAlt />} onClick={() => setShowFilters(!showFilters)}>فلترة</Button>
          {reports.length > 0 && (
            <Button size="small" variant="outlined" startIcon={<Print />} onClick={printCurrentReports}>طباعة</Button>
          )}
          {reports.length > 0 && (
            <Button size="small" variant="outlined" startIcon={<FileDownload />} onClick={handleExport}>تصدير Excel</Button>
          )}
          {isSupervisor && (
            <Button size="small" variant="outlined" startIcon={<PersonSearch />} onClick={() => setStudentFileOpen(true)} sx={{ borderColor: currentCfg?.color, color: currentCfg?.color }}>
              ملف طالب
            </Button>
          )}
          {canCreateReport && (
            <Button size="small" variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()}
              sx={{ bgcolor: currentCfg?.color, '&:hover': { bgcolor: currentCfg?.color, filter: 'brightness(0.9)' } }}>
              إضافة
            </Button>
          )}
        </Box>
      </Paper>

      {/* Filters */}
      {showFilters && (
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>الفصل</InputLabel>
                <Select value={selectedClass} label="الفصل" onChange={(e) => setSelectedClass(e.target.value)}>
                  <MenuItem value="">جميع الفصول</MenuItem>
                  {classes.map((c) => <MenuItem key={c.id} value={c.id}>{c.class_name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>الطالب</InputLabel>
                <Select value={selectedStudent} label="الطالب" onChange={(e) => setSelectedStudent(e.target.value)}>
                  <MenuItem value="">جميع الطلاب</MenuItem>
                  {students.map((s) => <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            {canEditReport && (
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>المعلم</InputLabel>
                  <Select value={selectedTeacher} label="المعلم" onChange={(e) => setSelectedTeacher(e.target.value)}>
                    <MenuItem value="">جميع المعلمين</MenuItem>
                    {teachers.map((t) => <MenuItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}

      {/* Reports */}
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>
      ) : reports.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <Box sx={{ color: 'text.disabled', mb: 2 }}>
            {currentCfg && React.cloneElement(currentCfg.icon as React.ReactElement, { sx: { fontSize: 80, color: currentCfg.color + '30' } })}
          </Box>
          <Typography variant="h6" color="text.secondary" gutterBottom>لا توجد تقارير</Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>لم يتم إضافة أي تقارير من هذا النوع بعد</Typography>
          {canCreateReport && (
            <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()} sx={{ bgcolor: currentCfg?.color, '&:hover': { bgcolor: currentCfg?.color, filter: 'brightness(0.9)' } }}>
              إضافة أول تقرير
            </Button>
          )}
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {reports.map((r) => {
            const cfg = reportConfig[r.report_type as keyof typeof reportConfig] || reportConfig.activity;
            return (
              <Card key={r.id} sx={{ borderRadius: 2, borderRight: `4px solid ${cfg.color}`, '&:hover': { boxShadow: 4 }, transition: '0.2s' }}>
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
                      <Avatar sx={{ bgcolor: cfg.lightBg, width: 48, height: 48 }}>
                        {React.cloneElement(cfg.icon as React.ReactElement, { sx: { color: cfg.color, fontSize: 26 } })}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography fontWeight="bold" sx={{ mb: 0.5, fontSize: 16 }}>{r.title || cfg.label}</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                          <Chip avatar={<Avatar sx={{ bgcolor: 'primary.light', width: 20, height: 20, fontSize: 10 }}>{r.student_first?.[0]}</Avatar>}
                            label={`${r.student_first} ${r.student_last}`} size="small" variant="outlined" />
                          <Chip label={r.class_name} size="small" color="primary" variant="outlined" />
                          <Chip icon={<CalendarMonth sx={{ fontSize: 14 }} />} label={formatDate(r.date)} size="small" variant="outlined" />
                          {r.teacher_first && <Chip label={`${r.teacher_first} ${r.teacher_last}`} size="small" variant="outlined" />}
                        </Box>
                        <Divider sx={{ mb: 1.5 }} />
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: 14 }}>
                          {r.content}
                        </Typography>
                      </Box>
                    </Box>
                    {(canEditReport || canDeleteReport) && (
                      <Box sx={{ display: 'flex', gap: 0.5, mr: 1, flexShrink: 0 }}>
                        {canEditReport && <IconButton size="small" sx={{ color: 'primary.main' }} onClick={() => handleOpenDialog(r)}><Edit fontSize="small" /></IconButton>}
                        {canDeleteReport && <IconButton size="small" color="error" onClick={() => handleDelete(r.id)}><Delete fontSize="small" /></IconButton>}
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ bgcolor: currentCfg?.color || 'primary.main', width: 32, height: 32 }}>
              {currentCfg && React.cloneElement(currentCfg.icon as React.ReactElement, { sx: { color: '#fff', fontSize: 18 } })}
            </Avatar>
            {editing ? 'تعديل التقرير' : `إضافة ${currentCfg?.label || 'تقرير'}`}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField fullWidth label="العنوان (اختياري)" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>الفصل</InputLabel>
                <Select value={formData.class_id} label="الفصل" onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}>
                  {classes.map((c) => <MenuItem key={c.id} value={c.id}>{c.class_name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>الطالب</InputLabel>
                <Select value={formData.student_id} label="الطالب" onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}>
                  {dialogStudents.map((s) => <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="التاريخ" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="المحتوى" multiline rows={5} value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} required />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenDialog(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleSubmit} sx={{ bgcolor: currentCfg?.color, '&:hover': { bgcolor: currentCfg?.color, filter: 'brightness(0.9)' } }}>
            {editing ? 'تحديث' : 'إضافة'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Student File Dialog */}
      <Dialog open={studentFileOpen} onClose={() => setStudentFileOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonSearch color="primary" />
              <Typography fontWeight="bold">ملف الطالب - التقارير الكاملة</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {fileStudent && fileReports.length > 0 && (
                <Button size="small" variant="contained" startIcon={<PictureAsPdf />} onClick={printStudentFile} sx={{ bgcolor: '#d32f2f', '&:hover': { bgcolor: '#b71c1c' } }}>
                  طباعة PDF
                </Button>
              )}
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {/* Student selector */}
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>اختر الطالب</InputLabel>
            <Select
              value={fileStudent?.id || ''}
              label="اختر الطالب"
              onChange={(e) => {
                const s = allStudents.find(st => st.id === e.target.value);
                if (s) openStudentFile(s);
              }}
            >
              {allStudents.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.student_id})</MenuItem>
              ))}
            </Select>
          </FormControl>

          {fileLoading ? (
            <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>
          ) : !fileStudent ? (
            <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
              <PersonSearch sx={{ fontSize: 64, mb: 1, opacity: 0.3 }} />
              <Typography>اختر طالباً لعرض جميع تقاريره</Typography>
            </Box>
          ) : fileReports.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
              <Typography>لا توجد تقارير لهذا الطالب</Typography>
            </Box>
          ) : (
            <>
              {/* Student info */}
              <Paper sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: '#f5f5f5', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontSize: 24 }}>
                  {fileStudent.first_name?.[0]}
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight="bold">{fileStudent.first_name} {fileStudent.last_name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {fileStudent.student_id} · {fileReports[0]?.class_name || '-'} · {fileReports.length} تقرير
                  </Typography>
                </Box>
              </Paper>

              {/* Reports grouped by type */}
              {['activity', 'positive', 'behavioral', 'academic_deficiency'].map(type => {
                const cfg = reportConfig[type as keyof typeof reportConfig];
                const typeReports = fileReports.filter(r => r.report_type === type);
                if (typeReports.length === 0) return null;
                return (
                  <Box key={type} sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <Avatar sx={{ bgcolor: cfg.lightBg, width: 32, height: 32 }}>
                        {React.cloneElement(cfg.icon as React.ReactElement, { sx: { color: cfg.color, fontSize: 18 } })}
                      </Avatar>
                      <Typography fontWeight="bold" sx={{ color: cfg.color }}>{cfg.label}</Typography>
                      <Chip label={typeReports.length} size="small" sx={{ bgcolor: cfg.lightBg, color: cfg.color, fontWeight: 600 }} />
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mr: 5 }}>
                      {typeReports.map(r => (
                        <Paper key={r.id} variant="outlined" sx={{ p: 2, borderRadius: 2, borderRight: `3px solid ${cfg.color}` }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography fontWeight="bold" fontSize={14}>{r.title || cfg.label}</Typography>
                            <Typography variant="caption" color="text.disabled">{formatDate(r.date)}</Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                            {r.teacher_first} {r.teacher_last} · {r.class_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                            {r.content}
                          </Typography>
                        </Paper>
                      ))}
                    </Box>
                  </Box>
                );
              })}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setStudentFileOpen(false)}>إغلاق</Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Delete color="error" />
          حذف التقرير
        </DialogTitle>
        <DialogContent>
          <Typography>هل أنت متأكد من حذف هذا التقرير؟</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
          <Button variant="contained" color="error" onClick={confirmDeleteReport} startIcon={<Delete />}>تأكيد الحذف</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
