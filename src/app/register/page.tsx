'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  Box, Container, Card, CardContent, TextField, Button, Typography,
  Alert, MenuItem, Paper
} from '@mui/material';
import { School } from '@mui/icons-material';
import { FORCED_SCHOOL_STAGE } from '@/lib/auth-context';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('middle_teacher');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/register', { email, password, role });
      setSuccessMsg('تم إنشاء الحساب بنجاح، سيتم تفعيله بعد مراجعة الإدارة. سيتم تحويلك لصفحة تسجيل الدخول...');
      setTimeout(() => router.push('/login'), 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'فشل التسجيل';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const allRoles = [
    { value: 'middle_teacher', label: 'معلم المرحلة المتوسطة' },
    { value: 'high_teacher', label: 'معلم المرحلة الثانوية' },
    { value: 'middle_counselor', label: 'مرشد طلابي - متوسط' },
    { value: 'high_counselor', label: 'مرشد طلابي - ثانوي' },
  ];
  // Stage-locked deployment: only show that stage's roles
  const roles = FORCED_SCHOOL_STAGE
    ? allRoles.filter((r) => r.value.startsWith(FORCED_SCHOOL_STAGE as 'middle' | 'high'))
    : allRoles;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', py: 4 }}>
      <Container maxWidth="sm">
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: '50%', bgcolor: 'primary.50' }}>
                <School sx={{ fontSize: 48, color: 'primary.main' }} />
              </Paper>
            </Box>

            <Typography variant="h4" textAlign="center" gutterBottom>
              مدرسة صفوة الرواد الأهلية
            </Typography>
            <Typography variant="body1" textAlign="center" color="text.secondary" sx={{ mb: 4 }}>
              إنشاء حساب جديد
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth label="اسم المستخدم" value={email}
                onChange={(e) => setEmail(e.target.value)} margin="normal" required
                autoComplete="username"
              />

              <TextField
                fullWidth label="كلمة المرور" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} margin="normal" required
                autoComplete="new-password"
              />

              <TextField
                fullWidth label="تأكيد كلمة المرور" type="password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} margin="normal" required
              />

              <TextField
                fullWidth select label="نوع الحساب" value={role}
                onChange={(e) => setRole(e.target.value)} margin="normal" required
              >
                {roles.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>

              <Button
                fullWidth size="large" type="submit" variant="contained"
                disabled={loading} sx={{ mt: 3, mb: 2, py: 1.5 }}
              >
                {loading ? 'جاري التسجيل...' : 'إنشاء الحساب'}
              </Button>
            </form>

            <Typography textAlign="center" sx={{ mt: 2 }}>
              لديك حساب بالفعل؟{' '}
              <Button onClick={() => router.push('/login')} sx={{ p: 0 }}>
                تسجيل الدخول
              </Button>
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
