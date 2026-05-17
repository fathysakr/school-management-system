'use client';

import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const theme = createTheme({
  direction: 'rtl',
  palette: {
    primary: { main: '#1976d2', light: '#42a5f5', dark: '#1565c0' },
    secondary: { main: '#9c27b0' },
    background: { default: '#f5f5f5', paper: '#ffffff' },
  },
  typography: { fontFamily: '"Segoe UI", "Roboto", "Arial", sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { borderRadius: 8, textTransform: 'none' } } },
    MuiCard: { styleOverrides: { root: { borderRadius: 12 } } },
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
