'use client';

import { Box, Typography, Button } from '@mui/material';
import { Inbox } from '@mui/icons-material';

interface EmptyStateProps {
  message?: string;
  action?: string;
  onAction?: () => void;
  icon?: React.ReactElement;
}

export default function EmptyState({ message = 'لا توجد بيانات', action, onAction, icon }: EmptyStateProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 1.5 }}>
      {icon || <Inbox sx={{ fontSize: 64, color: 'grey.300' }} />}
      <Typography color="text.secondary" sx={{ fontSize: '1rem' }}>{message}</Typography>
      {action && onAction && (
        <Button variant="outlined" size="small" onClick={onAction} sx={{ mt: 1 }}>
          {action}
        </Button>
      )}
    </Box>
  );
}
