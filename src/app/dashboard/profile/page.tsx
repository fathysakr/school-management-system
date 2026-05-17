'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  Box, Typography, Card, CardContent, Avatar, Chip, Divider,
  TextField, Button, Alert, Grid, IconButton, CircularProgress
} from '@mui/material';
import { Edit, Save, Close } from '@mui/icons-material';

const roleLabels: Record<string, string> = {
  admin: 'مدير النظام',
  middle_supervisor: 'مشرف المرحلة المتوسطة',
  high_supervisor: 'مشرف المرحلة الثانوية',
  middle_teacher: 'معلم المرحلة المتوسطة',
  high_teacher: 'معلم المرحلة الثانوية',
  middle_counselor: 'مرشد طلابي - متوسط',
  high_counselor: 'مرشد طلابي - ثانوي',
};

const roleColors: Record<string, string> = {
  admin: '#7c4dff',
  middle_supervisor: '#1565c0',
  high_supervisor: '#e65100',
  middle_teacher: '#2e7d32',
  high_teacher: '#d32f2f',
  middle_counselor: '#00897b',
  high_counselor: '#6a1b9a',
};

export default function ProfilePage() {
  const { user, token, login } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingEmail, setEditingEmail] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    const fetchProfile = async () => {
      try {
        const res = await api.get('/auth/profile', token);
        setProfile(res.user);
        setEditEmail(res.user.email);
      } catch {
        setError('فشل في تحميل البيانات');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [token]);

  const handleSaveEmail = async () => {
    if (!token) return;
    setError(''); setSuccess('');
    setSaving(true);
    try {
      const res = await api.put('/auth/profile', { email: editEmail }, token);
      login(res.token || token, res.user);
      setSuccess('تم تحديث اسم المستخدم');
      setEditingEmail(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setError(''); setSuccess('');

    if (!currentPassword) {
      setError('كلمة المرور الحالية مطلوبة');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    if (newPassword.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    if (!token) return;
    setSaving(true);
    try {
      await api.put('/auth/profile', { currentPassword, newPassword }, token);
      setSuccess('تم تحديث كلمة المرور بنجاح');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  };

  if (!user || loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><CircularProgress size={60} /></Box>;

  const nameDisplay = profile?.teacher_first
    ? `${profile.teacher_first} ${profile.teacher_last}`
    : profile?.student_first
      ? `${profile.student_first} ${profile.student_last}`
      : user.email?.split('@')[0] || 'مستخدم';

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">الملف الشخصي</Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center', pt: 4 }}>
              <Avatar sx={{ width: 100, height: 100, mx: 'auto', mb: 2, bgcolor: roleColors[user.role] || 'primary.main', fontSize: 40, fontWeight: 700 }}>
                {nameDisplay.charAt(0)}
              </Avatar>
              <Typography variant="h5" gutterBottom fontWeight={600}>{nameDisplay}</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                <Chip label={roleLabels[user.role] || user.role} sx={{ bgcolor: roleColors[user.role] + '20', color: roleColors[user.role], fontWeight: 600 }} />
                <Chip label="نشط" color="success" size="small" />
              </Box>
              {profile?.specialization && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{profile.specialization}</Typography>
              )}
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">معرف المستخدم</Typography>
                <Typography variant="h6">{user.id}</Typography>
              </Box>
              {profile?.teacher_id && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">رقم المعلم</Typography>
                  <Typography variant="h6">{profile.teacher_id}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          {/* Email */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">اسم المستخدم</Typography>
              <Divider sx={{ mb: 2 }} />
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {editingEmail ? (
                  <>
                    <TextField fullWidth size="small" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                    <IconButton color="primary" onClick={handleSaveEmail} disabled={saving}><Save /></IconButton>
                    <IconButton onClick={() => { setEditingEmail(false); setEditEmail(profile?.email); }}><Close /></IconButton>
                  </>
                ) : (
                  <>
                    <Typography sx={{ flexGrow: 1 }}>{profile?.email}</Typography>
                    <Button size="small" startIcon={<Edit />} onClick={() => setEditingEmail(true)}>تعديل</Button>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Password */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">تغيير كلمة المرور</Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12}><TextField fullWidth label="كلمة المرور الحالية" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="كلمة المرور الجديدة" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="تأكيد كلمة المرور الجديدة" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></Grid>
                <Grid item xs={12}>
                  <Button variant="contained" onClick={handlePasswordChange} disabled={saving}>
                    {saving ? 'جاري الحفظ...' : 'تحديث كلمة المرور'}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Account info */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">معلومات الحساب</Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {[
                  ['الاسم', nameDisplay],
                  ['اسم المستخدم', profile?.email],
                  ['نوع الحساب', roleLabels[user.role] || user.role],
                  ['الحالة', 'نشط'],
                  ['تاريخ التسجيل', profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ar-SA') : '-'],
                ].map(([label, value]) => (
                  <Box key={label} sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider', pb: 1 }}>
                    <Typography fontWeight="bold" sx={{ minWidth: 150 }}>{label}:</Typography>
                    <Typography>{value}</Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
