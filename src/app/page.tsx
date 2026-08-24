'use client';

import { useAuth, FORCED_SCHOOL_STAGE } from '@/lib/auth-context';
import { STAGE_FULL_NAMES } from '@/lib/school-brand';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  Box, Button, Container, Typography, Card, CardActionArea
} from '@mui/material';
import { School, AutoStories } from '@mui/icons-material';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  // Stage-locked deployment: skip the section chooser entirely
  useEffect(() => {
    if (!isLoading && !user && FORCED_SCHOOL_STAGE) {
      router.replace(`/login?school=${FORCED_SCHOOL_STAGE}`);
    }
  }, [user, isLoading, router]);

  if (isLoading || (!user && FORCED_SCHOOL_STAGE)) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>جاري التحميل...</Box>;
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #1e3a8a 100%)', py: 4 }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <School sx={{ fontSize: { xs: 48, sm: 72 }, color: '#fff', mb: 2, opacity: 0.9 }} />
          <Typography variant="h3" fontWeight="bold" color="#fff" gutterBottom sx={{ fontSize: { xs: '1.75rem', sm: '3rem' } }}>
            مدرسة صفوة الرواد الأهلية
          </Typography>
          <Typography variant="h6" color="rgba(255,255,255,0.7)" sx={{ mb: 1, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            اختر القسم الذي تريد الدخول إليه
          </Typography>
        </Box>

        {/* Two choice cards */}
        <Box sx={{ display: 'flex', gap: { xs: 2, sm: 4 }, justifyContent: 'center', flexWrap: 'wrap', px: { xs: 2, sm: 0 } }}>
          {/* Middle School */}
          <Card
            sx={{
              width: { xs: '100%', sm: 320 }, borderRadius: 4,
              background: 'linear-gradient(145deg, #ffffff, #eff6ff)',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              },
            }}
          >
            <CardActionArea
              onClick={() => router.push('/login?school=middle')}
              sx={{ p: 4, textAlign: 'center' }}
            >
              <Box
                sx={{
                  width: 100, height: 100, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #60a5fa, #2563eb)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  mx: 'auto', mb: 2.5, boxShadow: '0 8px 24px rgba(21,101,192,0.3)',
                }}
              >
                <AutoStories sx={{ fontSize: 48, color: '#fff' }} />
              </Box>
              <Typography variant="h6" fontWeight="bold" color="#1e40af" gutterBottom sx={{ fontSize: '1.35rem' }}>
                {STAGE_FULL_NAMES.middle}
              </Typography>
              <Button
                variant="contained"
                size="large"
                sx={{
                  bgcolor: '#2563eb', borderRadius: 8, px: 4,
                  '&:hover': { bgcolor: '#1e46b8' },
                }}
              >
                دخول
              </Button>
            </CardActionArea>
          </Card>

          {/* High School */}
          <Card
            sx={{
              width: { xs: '100%', sm: 320 }, borderRadius: 4,
              background: 'linear-gradient(145deg, #ffffff, #fef2f2)',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              },
            }}
          >
            <CardActionArea
              onClick={() => router.push('/login?school=high')}
              sx={{ p: 4, textAlign: 'center' }}
            >
              <Box
                sx={{
                  width: 100, height: 100, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f87171, #dc2626)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  mx: 'auto', mb: 2.5, boxShadow: '0 8px 24px rgba(230,81,0,0.3)',
                }}
              >
                <School sx={{ fontSize: 48, color: '#fff' }} />
              </Box>
              <Typography variant="h6" fontWeight="bold" color="#b91c1c" gutterBottom sx={{ fontSize: '1.35rem' }}>
                {STAGE_FULL_NAMES.high}
              </Typography>
              <Button
                variant="contained"
                size="large"
                sx={{
                  bgcolor: '#dc2626', borderRadius: 8, px: 4,
                  '&:hover': { bgcolor: '#b91c1c' },
                }}
              >
                دخول
              </Button>
            </CardActionArea>
          </Card>
        </Box>
      </Container>
    </Box>
  );
}
