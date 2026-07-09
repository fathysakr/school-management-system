'use client';

import { Box, Typography, Paper } from '@mui/material';
import { Psychology } from '@mui/icons-material';

export default function CounselingPage() {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Psychology sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" fontWeight="bold">الإرشاد الطلابي</Typography>
      </Box>
      <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
        <Psychology sx={{ fontSize: 80, color: 'text.disabled', mb: 2, opacity: 0.3 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>قريباً</Typography>
        <Typography color="text.disabled">سيتم إضافة الخدمات والقوائم الفرعية للإرشاد الطلابي</Typography>
      </Paper>
    </Box>
  );
}
