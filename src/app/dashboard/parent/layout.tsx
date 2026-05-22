'use client';

import { Box, Typography, IconButton } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useRouter } from 'next/navigation';

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <IconButton onClick={() => router.push('/dashboard')} sx={{ bgcolor: 'grey.100', '&:hover': { bgcolor: 'grey.200' } }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" fontWeight="bold">بوابة ولي الأمر</Typography>
      </Box>
      {children}
    </Box>
  );
}
