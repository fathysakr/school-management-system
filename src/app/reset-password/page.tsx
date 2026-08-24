'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { api } from '@/lib/api';
import { currentSchoolName } from '@/lib/school-brand';
import {
  Box, Container, Card, CardContent, TextField, Button, Typography,
  Alert, Paper, CircularProgress
} from '@mui/material';
import { Password, School } from '@mui/icons-material';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
      const data = await api.post('/auth/reset-password', { token, password });
      setSuccessMsg(data.message || 'تم تغيير كلمة المرور بنجاح');
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ. حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        رابط غير صالح. اطلب رابط استرجاع جديداً من صفحة تسجيل الدخول
      </Alert>
    );
  }

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}
      {!successMsg && (
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth label="كلمة المرور الجديدة" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} margin="normal" required
            autoComplete="new-password"
          />
          <TextField
            fullWidth label="تأكيد كلمة المرور" type="password" value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)} margin="normal" required
            autoComplete="new-password"
          />
          <Button
            fullWidth size="large" type="submit" variant="contained"
            disabled={loading} sx={{ mt: 3, mb: 2, py: 1.5 }}
          >
            {loading ? 'جاري الحفظ...' : 'حفظ كلمة المرور الجديدة'}
          </Button>
        </form>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', py: 4 }}>
      <Container maxWidth="sm">
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: '50%' }}>
                <Password sx={{ fontSize: 48, color: 'primary.main' }} />
              </Paper>
            </Box>

            <Typography variant="h5" textAlign="center" gutterBottom>
              تعيين كلمة مرور جديدة
            </Typography>
            <Typography variant="body2" textAlign="center" color="text.secondary" sx={{ mb: 3 }}>
              اختر كلمة مرور قوية لحسابك
            </Typography>

            <Suspense fallback={<CircularProgress />}>
              <ResetPasswordForm />
            </Suspense>

            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5, mt: 1 }}>
              <School fontSize="small" color="primary" />
              <Typography variant="body2" color="text.secondary">
                {currentSchoolName()}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
