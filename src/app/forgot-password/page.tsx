'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { currentSchoolName } from '@/lib/school-brand';
import {
  Box, Container, Card, CardContent, TextField, Button, Typography,
  Alert, Paper
} from '@mui/material';
import { LockReset, School } from '@mui/icons-material';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const data = await api.post('/auth/forgot-password', { email });
      setMessage(data.message || 'تم إرسال الطلب');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ. حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', py: 4 }}>
      <Container maxWidth="sm">
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: '50%' }}>
                <LockReset sx={{ fontSize: 48, color: 'primary.main' }} />
              </Paper>
            </Box>

            <Typography variant="h5" textAlign="center" gutterBottom>
              استرجاع كلمة المرور
            </Typography>
            <Typography variant="body2" textAlign="center" color="text.secondary" sx={{ mb: 3 }}>
              أدخل بريدك الإلكتروني وسنرسل لك رابط لإعادة تعيين كلمة المرور
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

            {!message && (
              <form onSubmit={handleSubmit}>
                <TextField
                  fullWidth label="البريد الإلكتروني" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} margin="normal" required
                  autoComplete="email"
                />
                <Button
                  fullWidth size="large" type="submit" variant="contained"
                  disabled={loading} sx={{ mt: 3, mb: 2, py: 1.5 }}
                >
                  {loading ? 'جاري الإرسال...' : 'إرسال رابط الاسترجاع'}
                </Button>
              </form>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5, mt: 1 }}>
              <School fontSize="small" color="primary" />
              <Typography variant="body2" color="text.secondary">
                {currentSchoolName()}
              </Typography>
            </Box>
            <Typography textAlign="center" sx={{ mt: 1 }}>
              <Button onClick={() => router.push('/login')} sx={{ p: 0 }}>
                العودة لتسجيل الدخول
              </Button>
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
