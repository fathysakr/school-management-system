'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton, Chip, Alert, CircularProgress,
  Grid, Tabs, Tab, Select, Accordion, AccordionSummary, AccordionDetails} from '@mui/material';
import { Add, Edit, Delete, Visibility, Close, FileUpload, FileDownload, CloudUpload, Phone, RemoveCircleOutline, DeleteSweep, AutoAwesome, ExpandMore } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { exportToExcel } from '@/lib/excel';
import { hasPermission } from '@/lib/permissions';
import EmptyState from '@/components/empty-state';

export default function StudentsPage() {
  const { user, token, selectedSchool } = useAuth();
  const schoolParam = selectedSchool && selectedSchool !== 'all' ? `&school=${selectedSchool}` : '';
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollingId, setEnrollingId] = useState<number | null>(null);
  const [bulkGrade, setBulkGrade] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    student_id: '', first_name: '', last_name: '', email: '',
    phone: '', date_of_birth: '', address: '',
    parent_email: '', parent_phone: '', parent_phones: [''] as string[],
    enrollment_date: new Date().toISOString().split('T')[0],
    semester: '', class_id: '', grade: '',
  });
  const [isEdit, setIsEdit] = useState(false);
  const [importTab, setImportTab] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStudents = async () => {
    if (!token) return;
    try {
      const [studentsRes, classesRes] = await Promise.all([
        api.get(`/students?page=1&limit=500${schoolParam}`, token),
        api.get(`/classes?page=1&limit=500${schoolParam}`, token),
      ]);
      setStudents(studentsRes.students || []);
      setClasses(classesRes.classes || []);
    } catch (err: any) {
      console.error('fetchStudents error:', err?.message || err);
      setError('فشل في جلب البيانات' + (err?.message ? ` (${err.message})` : ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStudents(); }, [token]);

  const parsePhones = (student: any): string[] => {
    if (student.parent_phones) {
      try {
        const parsed = JSON.parse(student.parent_phones);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.filter(Boolean);
      } catch { console.error('Invalid parent_phones JSON'); }
    }
    return student.parent_phone ? [student.parent_phone] : [''];
  };

  const handleOpenDialog = (student?: any) => {
    if (student) {
      setIsEdit(true);
      setSelectedStudent(student);
      setFormData({
        student_id: student.student_id, first_name: student.first_name, last_name: student.last_name,
        email: student.email || '', phone: student.phone || '',
        date_of_birth: student.date_of_birth || '',
        address: student.address || '', parent_email: student.parent_email || '',
        parent_phone: student.parent_phone || '',
        parent_phones: parsePhones(student),
        enrollment_date: student.enrollment_date || '',
        semester: student.semester || '',
        class_id: student.class_id ? String(student.class_id) : '',
        grade: student.grade || '',
      });
    } else {
      setIsEdit(false);
      setFormData({
        student_id: '', first_name: '', last_name: '', email: '',
        phone: '', date_of_birth: '', address: '',
        parent_email: '', parent_phone: '', parent_phones: [''],
        enrollment_date: new Date().toISOString().split('T')[0],
        semester: '', class_id: '', grade: '',
      });
    }
    setOpenDialog(true);
    setError('');
  };

  const handleSubmit = async () => {
    if (!token) return;
    setError('');
    setSuccess('');
    const phones = formData.parent_phones.filter(p => p.trim());
    const payload: Record<string, unknown> = {
      ...formData,
      parent_phones: phones,
      parent_phone: phones[0] || '',
      class_id: formData.class_id || undefined,
    };
    if (!payload.class_id) delete payload.class_id;
    try {
      if (isEdit && selectedStudent) {
        await api.put(`/students/${selectedStudent.id}`, payload, token);
        setSuccess('تم تحديث الطالب بنجاح');
      } else {
        await api.post('/students', payload, token);
        setSuccess('تم إضافة الطالب بنجاح');
      }
      setOpenDialog(false);
      fetchStudents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    setDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    if (!token || deleteConfirm === null) return;
    try {
      await api.delete(`/students/${deleteConfirm}`, token);
      setSuccess('تم حذف الطالب');
      setDeleteConfirm(null);
      fetchStudents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
      setDeleteConfirm(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!token) return;
    setDeletingAll(true);
    try {
      await api.post('/admin/bulk-delete', { action: 'delete_all_students' }, token);
      setSuccess('تم حذف جميع الطلاب وبياناتهم');
      setDeleteAllConfirm(false);
      fetchStudents();
    } catch {
      setError('فشل حذف جميع الطلاب');
    } finally {
      setDeletingAll(false);
    }
  };

  const handleView = async (id: number) => {
    if (!token) return;
    try {
      const res = await api.get(`/students/${id}`, token);
      setSelectedStudent(res.student);
      setViewDialog(true);
    } catch {
      setError('فشل في جلب بيانات الطالب');
    }
  };

  const handleGenerate = async () => {
    if (!token) return;
    setGenerating(true);
    try {
      const res = await api.post('/students/generate', { count: 50, school: selectedSchool === 'all' ? undefined : selectedSchool }, token);
      setSuccess(`تم إنشاء ${res.created || 0} طالب تجريبي`);
      fetchStudents();
    } catch {
      setError('فشل إنشاء الطلاب');
    }
    setGenerating(false);
  };

  const handleDistribute = async () => {
    if (!token) return;
    setDistributing(true);
    try {
      const res = await api.post('/admin/import-students', {}, token);
      setSuccess(
        res.created !== undefined
          ? `تم توزيع ${res.enrolled || 0} طالب على الفصول (${res.created || 0} جديد، ${res.errors || 0} خطأ)`
          : 'تم توزيع الطلاب على الفصول'
      );
      fetchStudents();
    } catch (err: any) {
      setError('فشل توزيع الطلاب: ' + (err?.message || ''));
    }
    setDistributing(false);
  };

  const handleBulkSetGrade = async (grade: string) => {
    if (!token || !grade) return;
    const ungraded = students.filter((s: any) => !s.grade);
    setEnrollingId(-1);
    try {
      await Promise.all(ungraded.map((s: any) => api.put(`/students/${s.id}`, { grade }, token)));
      setBulkGrade('');
      setSuccess(`تم تعيين مرحلة "${grade}" لـ ${ungraded.length} طالب`);
      fetchStudents();
    } catch (err: any) {
      setError('فشل في تعيين المرحلة: ' + (err?.message || ''));
    } finally {
      setEnrollingId(null);
    }
  };

  const handleEnroll = async (studentId: number, classId: string) => {
    if (!token) return;
    setEnrollingId(studentId);
    try {
      const selectedClass = classes.find((c: any) => String(c.id) === classId);
      const payload: Record<string, unknown> = { class_id: classId || undefined };
      if (selectedClass) payload.grade = selectedClass.grade;
      await api.put(`/students/${studentId}`, payload, token);
      await fetchStudents();
    } catch (err: any) {
      setError('فشل في تحديث الفصل: ' + (err?.message || ''));
    } finally {
      setEnrollingId(null);
    }
  };

  const gradeList = useMemo(() => {
    const grades = new Set<string>();
    classes.forEach((c: any) => { if (c.grade) grades.add(c.grade); });
    return Array.from(grades);
  }, [classes]);

  const groupedStudents = useMemo(() => {
    const gradeOrder = [
      'الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي',
      'الصف الأول المتوسط', 'الصف الثاني المتوسط', 'الصف الثالث المتوسط',
    ];
    const groups: { label: string; students: any[] }[] = [];

    gradeOrder.forEach(g => {
      const gStudents = students.filter((s: any) => s.grade === g);
      if (gStudents.length > 0) groups.push({ label: g, students: gStudents });
    });

    const unassigned = students.filter((s: any) => !s.grade);
    if (unassigned.length > 0) {
      groups.push({ label: 'بدون مرحلة', students: unassigned });
    }
    return groups;
  }, [students]);

  const handleExport = async () => {
    if (!token) return;
    try {
      const res = await api.get(`/students?page=1&limit=1000&status=all${schoolParam}`, token);
      const rows = (res.students || []).map((s: any) => {
        const phones: string[] = (() => {
          if (s.parent_phones) {
            try { const p = JSON.parse(s.parent_phones); if (Array.isArray(p)) return p; } catch { console.error('Invalid parent_phones JSON in export'); }
          }
          return s.parent_phone ? [s.parent_phone] : [];
        })();
        return [
          s.student_id,
          s.first_name,
          s.last_name,
          s.email || '',
          s.phone || '',
          s.date_of_birth || '',
          phones.join(' / '),
          s.parent_email || '',
          s.address || '',
          s.enrollment_date || '',
          s.school === 'middle' ? 'متوسطة' : 'ثانوية',
          s.semester || '',
          s.status === 'active' ? 'نشط' : s.status === 'graduated' ? 'متخرج' : 'غير نشط',
        ];
      });
      exportToExcel(['رقم الطالب','الاسم الأول','الاسم الأخير','البريد الإلكتروني','الهاتف','تاريخ الميلاد','هواتف ولي الأمر','بريد ولي الأمر','العنوان','تاريخ القيد','المرحلة','الفصل الدراسي','الحالة'], rows, 'الطلاب', 'students_صفوة_الرواد.xlsx');
      setSuccess('تم تصدير البيانات بنجاح');
    } catch {
      setError('فشل في تصدير البيانات');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!token) {
      setError('الرجاء تسجيل الدخول أولاً');
      return;
    }
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      const ts = Date.now();
      const fileName = file.name || '';
      const fileSchool = fileName.includes('متوسط') ? 'middle' : fileName.includes('ثانوي') ? 'high' : '';

      function parseSheet(sheet: XLSX.WorkSheet): any[] {
        let result: any[] = [];

        // Strategy 1: read with headers as keys (first row = Arabic/English column names)
        let rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, string>[];
        const firstRowKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
        const hasRecognizableHeaders = firstRowKeys.some(k =>
          ['رقم الطالب','اسم الطالب','الاسم الأول','الاسم الأخير','student_id','first_name','last_name',
           'الفصل','اسم الطالب','رقم الطالب','data','name'].includes(k)
        );

        if (hasRecognizableHeaders && firstRowKeys.length >= 2) {
          result = rows.map((row, i) => {
            const rawSchool = String(row['المرحلة'] || row['school'] || '');
            const school = rawSchool === 'ثانوية' || rawSchool === 'high' ? 'high' : rawSchool === 'متوسطة' || rawSchool === 'middle' ? 'middle' : fileSchool;

            let first_name = String(row['الاسم الأول'] || row['first_name'] || '');
            let last_name = String(row['الاسم الأخير'] || row['last_name'] || '');

            if ((!first_name || !last_name) && (row['اسم الطالب'] || row['full_name'] || row['name'])) {
              const fullName = String(row['اسم الطالب'] || row['full_name'] || row['name'] || '').trim();
              const spaceIdx = fullName.indexOf(' ');
              first_name = spaceIdx > 0 ? fullName.substring(0, spaceIdx).trim() : fullName;
              last_name = spaceIdx > 0 ? fullName.substring(spaceIdx + 1).trim() : '';
            }

            let semester = String(row['الفصل الدراسي'] || row['semester'] || row['فصل الطالب'] || '');
            let student_id = String(row['رقم الطالب'] || row['student_id'] || row['id'] || row['الرقم'] || `STU${ts}${i}`);
            let class_name = String(row['الفصل'] || row['class_name'] || row['class'] || '');
            let grade = String(row['المرحلة'] || row['grade'] || row['الصف'] || '');

            return {
              student_id,
              first_name,
              last_name,
              email: String(row['البريد الإلكتروني'] || row['email'] || ''),
              phone: String(row['الهاتف'] || row['phone'] || ''),
              date_of_birth: String(row['تاريخ الميلاد'] || row['date_of_birth'] || ''),
              parent_phones: String(row['هواتف ولي الأمر'] || row['parent_phones'] || '').split('/').map((s: string) => s.trim()).filter(Boolean),
              parent_phone: String(row['هاتف ولي الأمر'] || row['parent_phone'] || ''),
              parent_email: String(row['بريد ولي الأمر'] || row['parent_email'] || ''),
              address: String(row['العنوان'] || row['address'] || ''),
              enrollment_date: String(row['تاريخ القيد'] || row['enrollment_date'] || new Date().toISOString().split('T')[0]),
              semester,
              class_name,
              grade,
              school,
            };
          }).filter((r: any) => r.first_name && r.last_name);
        }

        // Strategy 2: Noor system multi-row header format
        if (result.length === 0) {
          const arrRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as string[][];
          let headerRowIdx = -1;
          for (let r = 0; r < Math.min(arrRows.length, 30); r++) {
            const row = arrRows[r];
            const rowStr = row.join('|');
            if ((rowStr.includes('الفصل') || rowStr.includes('اسم الطالب')) && rowStr.includes('رقم الطالب')) {
              headerRowIdx = r;
              break;
            }
          }
          if (headerRowIdx >= 0) {
            const headerRow = arrRows[headerRowIdx];
            const colIdx = (label: string) => {
              for (let c = 0; c < headerRow.length; c++) {
                if (String(headerRow[c] || '').trim() === label) return c;
              }
              return -1;
            };
            const classCol = colIdx('الفصل');
            const nameCol = colIdx('اسم الطالب');
            const idCol = colIdx('رقم الطالب');

            if (nameCol >= 0 && idCol >= 0) {
              const gradeFromFile =
                fileName.includes('أول') ? 'الصف الأول الثانوي' :
                fileName.includes('ثاني') ? 'الصف الثاني الثانوي' :
                fileName.includes('ثالث') ? 'الصف الثالث الثانوي' :
                fileName.includes('أولى') ? 'الصف الأول الثانوي' : '';
              const schoolFromFile = fileName.includes('ثانوي') ? 'high' : fileSchool;

              result = arrRows.slice(headerRowIdx + 1).map((row, i) => {
                const fullName = String(row[nameCol] || '').trim();
                const spaceIdx = fullName.indexOf(' ');
                const firstName = spaceIdx > 0 ? fullName.substring(0, spaceIdx).trim() : fullName;
                const lastName = spaceIdx > 0 ? fullName.substring(spaceIdx + 1).trim() : '';
                const classNum = classCol >= 0 ? String(row[classCol] || '').trim() : '';
                return {
                  student_id: String(row[idCol] || `STU${ts}${i}`),
                  first_name: firstName,
                  last_name: lastName,
                  email: '',
                  phone: '',
                  date_of_birth: '',
                  parent_phones: [] as string[],
                  parent_phone: '',
                  parent_email: '',
                  address: '',
                  enrollment_date: new Date().toISOString().split('T')[0],
                  semester: '',
                  school: schoolFromFile || 'high',
                  class_name: classNum,
                  grade: gradeFromFile,
                };
              }).filter((r: any) => r.first_name && r.last_name);
            }
          }
        }

        // Strategy 3: simplified 3-column position-based format
        if (result.length === 0) {
          const arrRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as string[][];
          const colCount = arrRows.length > 0 ? arrRows[0].length : 0;
          if (colCount <= 4 && arrRows.length > 1) {
            result = arrRows.slice(1).map((row, i) => {
              const fullName = String(row[1] || '').trim();
              const spaceIdx = fullName.indexOf(' ');
              const firstName = spaceIdx > 0 ? fullName.substring(0, spaceIdx).trim() : fullName;
              const lastName = spaceIdx > 0 ? fullName.substring(spaceIdx + 1).trim() : '';
              const rawSchool = String(row[3] || '').trim();
              const school = rawSchool === 'ثانوية' || rawSchool === 'high' ? 'high' : rawSchool === 'متوسطة' || rawSchool === 'middle' ? 'middle' : fileSchool || 'high';
              const classInfo = String(row[2] || '').trim();
              return {
                student_id: String(row[0] || `STU${ts}${i}`),
                first_name: firstName,
                last_name: lastName,
                email: '',
                phone: '',
                date_of_birth: '',
                parent_phones: [] as string[],
                parent_phone: '',
                parent_email: '',
                address: '',
                enrollment_date: new Date().toISOString().split('T')[0],
                semester: classInfo,
                school,
              };
            }).filter(r => r.first_name && r.last_name);
          }
        }

        // Strategy 4: full 12-column position-based format
        if (result.length === 0) {
          const arrRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as string[][];
          const colCount = arrRows.length > 0 ? arrRows[0].length : 0;
          if (colCount > 4 && arrRows.length > 1) {
            result = arrRows.slice(1).map((row, i) => {
              const rawSchool = String(row[10] || '');
              const school = rawSchool === 'ثانوية' || rawSchool === 'high' ? 'high' : rawSchool === 'متوسطة' || rawSchool === 'middle' ? 'middle' : fileSchool || 'high';
              const phones = (row[6] || '').split('/').map((s: string) => s.trim()).filter(Boolean);
              return {
                student_id: String(row[0] || `STU${ts}${i}`),
                first_name: String(row[1] || ''),
                last_name: String(row[2] || ''),
                email: String(row[3] || ''),
                phone: String(row[4] || ''),
                date_of_birth: String(row[5] || ''),
                parent_phones: phones,
                parent_phone: phones[0] || '',
                parent_email: String(row[7] || ''),
                address: String(row[8] || ''),
                enrollment_date: String(row[9] || new Date().toISOString().split('T')[0]),
                semester: String(row[11] || ''),
                school,
              };
            }).filter(r => r.first_name && r.last_name);
          }
        }

        return result;
      }

      let mapped: any[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        mapped = mapped.concat(parseSheet(sheet));
      }

      if (mapped.length === 0) {
        setError('لا توجد بيانات صالحة في الملف. تأكد من الصيغة: إما الأعمدة الكاملة أو 3 أعمدة (رقم الطالب، اسم الطالب، فصل الطالب)');
        return;
      }

      setError('');
      setSuccess(`تم قراءة ${mapped.length} طالب. جاري الاستيراد...`);
      setImportTab(1);

      let successCount = 0;
      let failCount = 0;
      let lastError = '';
      const existingByStudentId: Record<string, any> = {};
      students.forEach((s: any) => { if (s.student_id) existingByStudentId[s.student_id] = s; });
      for (const student of mapped) {
        try {
          const existing = existingByStudentId[student.student_id];
          if (existing) {
            const payload: Record<string, unknown> = { grade: student.grade || '', class_name: student.class_name || '' };
            if (!payload.grade) delete payload.grade;
            if (!payload.class_name) delete payload.class_name;
            if (Object.keys(payload).length > 0) {
              await api.put(`/students/${existing.id}`, payload, token);
            }
          } else {
            await api.post('/students', student, token);
          }
          successCount++;
        } catch (err: any) {
          const msg = err?.message || '';
          lastError = msg || lastError;
          console.error(`Import student ${student.student_id} failed:`, msg);
          failCount++;
        }
      }

      setSuccess(`تم استيراد ${successCount} طالب بنجاح${failCount > 0 ? `، فشل ${failCount} (آخر خطأ: ${lastError})` : ''}`);
      fetchStudents();
    } catch {
      setError('فشل في قراءة الملف');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">إدارة الطلاب</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<FileDownload />} onClick={handleExport}>تصدير Excel</Button>
          {hasPermission(user?.role, 'students:create') && (
            <Button variant="outlined" startIcon={<FileUpload />} onClick={() => setImportDialog(true)}>استيراد Excel</Button>
          )}
          {hasPermission(user?.role, 'students:create') && (
            <Button variant="outlined" startIcon={<AutoAwesome />} onClick={handleGenerate} disabled={generating}>
              {generating ? <CircularProgress size={18} /> : 'إنشاء عينة'}
            </Button>
          )}
          {user?.role === 'admin' && (
            <Button variant="outlined" startIcon={<AutoAwesome />} onClick={handleDistribute} disabled={distributing}>
              {distributing ? <CircularProgress size={18} /> : 'وزع على الفصول'}
            </Button>
          )}
          {user?.role === 'admin' && (
            <Button variant="outlined" color="error" startIcon={<DeleteSweep />} onClick={() => setDeleteAllConfirm(true)}>حذف الجميع</Button>
          )}
          {hasPermission(user?.role, 'students:create') && (
            <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()}>إضافة طالب</Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}<IconButton size="small" onClick={() => setError('')}><Close fontSize="small" /></IconButton></Alert>}
      {success && <Alert severity="success" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>{success}<IconButton size="small" onClick={() => setSuccess('')}><Close fontSize="small" /></IconButton></Alert>}

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>
      ) : students.length === 0 ? (
        <EmptyState message="لا يوجد طلاب" />
      ) : (
        groupedStudents.map((group) => {
          return (
            <Accordion key={group.label} defaultExpanded sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', ml: 1 }}>
                  <Typography variant="h6" fontWeight="bold">
                    {group.label}
                    <Chip label={`${group.students.length} طالب`} size="small" sx={{ mr: 1.5 }} />
                  </Typography>
                  {group.label === 'بدون مرحلة' && gradeList.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, mr: 'auto' }}>
                      <Select native size="small" value={bulkGrade} onChange={(e) => setBulkGrade(e.target.value)} sx={{ minWidth: 140 }}>
                        <option value="">تعيين مرحلة للجميع...</option>
                        {gradeList.map((g: string) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </Select>
                      <Button size="small" variant="contained" disabled={!bulkGrade || enrollingId === -1}
                        onClick={() => handleBulkSetGrade(bulkGrade)}>
                        {enrollingId === -1 ? <CircularProgress size={16} /> : 'تطبيق'}
                      </Button>
                    </Box>
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <TableContainer>
                  <Table sx={{ minWidth: 750 }} dir="rtl" size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>الرقم</TableCell>
                        <TableCell>الاسم</TableCell>
                        <TableCell>الفصل</TableCell>
                        <TableCell>الحالة</TableCell>
                        <TableCell>الإجراءات</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {group.students.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.student_id}</TableCell>
                          <TableCell>{s.first_name} {s.last_name}</TableCell>
                          <TableCell sx={{ minWidth: 220 }}>
                            <Select
                              native fullWidth size="small"
                              value={s.class_id ? String(s.class_id) : ''}
                              disabled={enrollingId === s.id}
                              onChange={(e) => handleEnroll(s.id, e.target.value)}
                            >
                              <option value="">بدون فصل</option>
                              {classes.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.class_name} ({c.grade})</option>
                              ))}
                            </Select>
                          </TableCell>
                            <TableCell>
                              <Chip label={s.status === 'active' ? 'نشط' : s.status === 'graduated' ? 'متخرج' : 'غير نشط'}
                                color={s.status === 'active' ? 'success' : s.status === 'graduated' ? 'info' : 'default'} size="small" />
                            </TableCell>
                            <TableCell>
                              <IconButton size="small" onClick={() => handleView(s.id)}><Visibility /></IconButton>
                              {hasPermission(user?.role, 'students:edit') && (
                                <IconButton size="small" onClick={() => handleOpenDialog(s)}><Edit /></IconButton>
                              )}
                              {hasPermission(user?.role, 'students:delete') && (
                                <Button size="small" color="error" startIcon={<Delete />} onClick={() => handleDelete(s.id)} sx={{ minWidth: 50 }}>حذف</Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          );
        })
      )}

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{isEdit ? 'تعديل الطالب' : 'إضافة طالب جديد'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><TextField fullWidth label="رقم الطالب" value={formData.student_id} onChange={(e) => setFormData({ ...formData, student_id: e.target.value })} disabled={isEdit} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="الاسم الأول" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="الاسم الأخير" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="البريد الإلكتروني" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="الهاتف" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="تاريخ الميلاد" type="date" value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12}><Typography variant="subtitle2" sx={{ mt: 1, fontWeight: 'bold' }}>بيانات ولي الأمر</Typography></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="بريد ولي الأمر" value={formData.parent_email} onChange={(e) => setFormData({ ...formData, parent_email: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600, color: 'text.secondary' }}>
                أرقام هواتف ولي الأمر
              </Typography>
              {formData.parent_phones.map((phone, idx) => (
                <Box key={idx} sx={{ display: 'flex', gap: 0.5, mb: 1, alignItems: 'center' }}>
                  <TextField
                    fullWidth size="small" placeholder={`رقم الهاتف ${idx + 1}`}
                    value={phone}
                    onChange={(e) => {
                      const updated = [...formData.parent_phones];
                      updated[idx] = e.target.value;
                      setFormData({ ...formData, parent_phones: updated });
                    }}
                  />
                  {formData.parent_phones.length > 1 && (
                    <IconButton
                      size="small" color="error"
                      onClick={() => {
                        const updated = formData.parent_phones.filter((_, i) => i !== idx);
                        setFormData({ ...formData, parent_phones: updated.length ? updated : [''] });
                      }}
                    >
                      <RemoveCircleOutline />
                    </IconButton>
                  )}
                </Box>
              ))}
              <Button
                size="small" startIcon={<Phone />}
                onClick={() => setFormData({ ...formData, parent_phones: [...formData.parent_phones, ''] })}
              >
                إضافة هاتف
              </Button>
            </Grid>
            <Grid item xs={12}><TextField fullWidth label="العنوان" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="الفصل الدراسي" value={formData.semester} onChange={(e) => setFormData({ ...formData, semester: e.target.value })} placeholder="مثال: الفصل الأول" /></Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="المرحلة" value={formData.grade} onChange={(e) => setFormData({ ...formData, grade: e.target.value })} SelectProps={{ native: true }}>
                <option value="">اختر المرحلة</option>
                {gradeList.map((g: string) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="الفصل" value={formData.class_id} onChange={(e) => setFormData({ ...formData, class_id: e.target.value })} SelectProps={{ native: true }}>
                <option value="">بدون فصل</option>
                {classes.filter((c: any) => !formData.grade || c.grade === formData.grade).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.class_name} - {c.grade}</option>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleSubmit}>{isEdit ? 'تحديث' : 'إضافة'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewDialog} onClose={() => setViewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>بيانات الطالب</DialogTitle>
        <DialogContent>
          {selectedStudent && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
              {[['الرقم', selectedStudent.student_id], ['الاسم', `${selectedStudent.first_name} ${selectedStudent.last_name}`], ['البريد', selectedStudent.email || '-'], ['المرحلة', selectedStudent.school === 'high' ? 'ثانوية' : 'متوسطة'], ['الفصل الدراسي', selectedStudent.semester || '-'], ['الفصل', selectedStudent.class_name ? `${selectedStudent.class_name} (${selectedStudent.class_grade})` : '-'], ['بريد ولي الأمر', selectedStudent.parent_email || '-'], ['الحالة', selectedStudent.status === 'active' ? 'نشط' : selectedStudent.status === 'graduated' ? 'متخرج' : 'غير نشط']].map(([label, value]) => (
                <Box key={label} sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider', pb: 1 }}>
                  <Typography fontWeight="bold" sx={{ minWidth: 130 }}>{label}:</Typography>
                  <Typography>{value}</Typography>
                </Box>
              ))}
              <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider', pb: 1 }}>
                <Typography fontWeight="bold" sx={{ minWidth: 130 }}>هواتف ولي الأمر:</Typography>
                <Box>
                  {(() => {
                    const phones: string[] = (() => {
                      if (selectedStudent.parent_phones) {
                        try { const p = JSON.parse(selectedStudent.parent_phones); if (Array.isArray(p)) return p; } catch { console.error('Invalid parent_phones JSON in view'); }
                      }
                      return selectedStudent.parent_phone ? [selectedStudent.parent_phone] : [];
                    })();
                    return phones.length > 0
                      ? phones.map((p, i) => <Typography key={i}><Chip label={p} size="small" sx={{ ml: 0.5 }} /></Typography>)
                      : <Typography>-</Typography>;
                  })()}
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialog(false)}>إغلاق</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={importDialog} onClose={() => { setImportDialog(false); setImportTab(0); }} maxWidth="sm" fullWidth>
        <DialogTitle>استيراد الطلاب من Excel</DialogTitle>
        <DialogContent>
          <Tabs value={importTab} onChange={(_, v) => setImportTab(v)} sx={{ mb: 2 }}>
            <Tab label="تحميل ملف" />
            <Tab label="النتيجة" />
          </Tabs>
          {importTab === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} style={{ display: 'none' }} />
              <CloudUpload sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>اختر ملف Excel</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                الصيغة المبسطة: 3 أعمدة (رقم الطالب، اسم الطالب، فصل الطالب)
                <br />المرحلة تُستخرج من اسم الملف (مثلاً: طلاب_متوسطة.xlsx)
              </Typography>
              <Button variant="contained" onClick={() => fileInputRef.current?.click()}>اختيار ملف</Button>
              <Box sx={{ mt: 3 }}>
                <Button size="small" onClick={() => {
                  exportToExcel(['رقم الطالب','اسم الطالب','فصل الطالب'],
                    [['STU001','أحمد محمد','الفصل الأول'],
                    ['STU002','خالد عمر','الفصل الأول']],
                    'نموذج_استيراد', 'import_template.xlsx');
                }}>تحميل نموذج ملف مبسط</Button>
              </Box>
            </Box>
          )}
          {importTab === 1 && (
            <Box sx={{ py: 2, textAlign: 'center' }}>
              <Typography>{success}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setImportDialog(false); setImportTab(0); }}>إغلاق</Button>
        </DialogActions>
      </Dialog>

      {/* Delete all students confirm dialog */}
      <Dialog open={deleteAllConfirm} onClose={() => !deletingAll && setDeleteAllConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteSweep color="error" />
          حذف جميع الطلاب
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="bold">سيتم حذف جميع الطلاب وبياناتهم بالكامل (الدرجات، الحضور، التقارير، التسجيلات)</Typography>
            <Typography variant="caption">هذا الإجراء لا يمكن التراجع عنه.</Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDeleteAllConfirm(false)} disabled={deletingAll}>إلغاء</Button>
          <Button variant="contained" color="error" onClick={handleDeleteAll} disabled={deletingAll} startIcon={<DeleteSweep />}>
            {deletingAll ? 'جاري الحذف...' : 'تأكيد حذف الكل'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Delete color="error" />
          حذف الطالب
        </DialogTitle>
        <DialogContent>
          <Typography>هل أنت متأكد من حذف هذا الطالب؟ هذا الإجراء لا يمكن التراجع عنه.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
          <Button variant="contained" color="error" onClick={confirmDelete} startIcon={<Delete />}>تأكيد الحذف</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
