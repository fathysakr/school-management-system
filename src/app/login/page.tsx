'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  Box, Container, Card, CardContent, TextField, Button, Typography,
  Alert, InputAdornment, IconButton, Paper
} from '@mui/material';
import { Visibility, VisibilityOff, School, AutoStories } from '@mui/icons-material';
import { FORCED_SCHOOL_STAGE } from '@/lib/auth-context';
import { schoolFullName } from '@/lib/school-brand';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Stage-locked deployment forces its own stage regardless of URL param
  const school = FORCED_SCHOOL_STAGE || searchParams.get('school') || 'middle';
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const expired = searchParams.get('expired') === '1';

  const isHigh = school === 'high';
  const schoolLabel = schoolFullName(school);
  const primaryColor = '#047857';
  const gradient = isHigh
    ? 'linear-gradient(135deg, #34d399 0%, #047857 100%)'
    : 'linear-gradient(135deg, #fbbf24 0%, #92400e 100%)';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.post('/auth/login', { email, password, school });
      login(data.token, data.user);
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'فشل تسجيل الدخول';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #022c22 0%, #065f46 50%, #022c22 100%)', py: 4 }}>
      <Container maxWidth="sm">
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
              <IconButton onClick={() => router.push('/')} sx={{ position: 'absolute', right: 24, top: 24, color: 'text.secondary' }}>
                <School />
              </IconButton>
            </Box>

            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: '50%', background: gradient, display: 'inline-flex', mb: 1.5 }}>
                {isHigh ? <School sx={{ fontSize: 48, color: '#fff' }} /> : <AutoStories sx={{ fontSize: 48, color: '#fff' }} />}
              </Paper>
              <Typography variant="h5" fontWeight="bold" sx={{ color: primaryColor }}>
                {schoolLabel}
              </Typography>
              {!FORCED_SCHOOL_STAGE && (
                <Typography variant="body1" color="text.secondary">
                  مدرسة صفوة الرواد الأهلية
                </Typography>
              )}
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {expired && !error && <Alert severity="info" sx={{ mb: 2 }}>انتهت صلاحية الجلسة، برجاء تسجيل الدخول مرة أخرى</Alert>}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth label="اسم المستخدم" value={email}
                onChange={(e) => setEmail(e.target.value)} margin="normal" required
                autoComplete="username"
              />

              <TextField
                fullWidth label="كلمة المرور" type={showPassword ? 'text' : 'password'}
                value={password} onChange={(e) => setPassword(e.target.value)}
                margin="normal" required autoComplete="current-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                fullWidth size="large" type="submit" variant="contained"
                disabled={loading}
                sx={{ mt: 3, mb: 2, py: 1.5, bgcolor: primaryColor, '&:hover': { bgcolor: '#065f46' } }}
              >
                {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
              </Button>
            </form>

            <Box sx={{ textAlign: 'center', mt: 1, mb: 1 }}>
              <Button onClick={() => router.push('/forgot-password')} sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                نسيت كلمة المرور؟
              </Button>
            </Box>

            {!FORCED_SCHOOL_STAGE && (
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Button onClick={() => router.push('/')} sx={{ color: 'text.secondary' }}>
                  ← العودة لاختيار القسم
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>جاري التحميل...</Box>}>
      <LoginForm />
    </Suspense>
  );
}
