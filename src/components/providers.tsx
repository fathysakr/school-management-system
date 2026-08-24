'use client';

import { ThemeProvider, createTheme, responsiveFontSizes } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

let theme = createTheme({
  direction: 'rtl',
  palette: {
    primary: { main: '#2563eb', light: '#60a5fa', dark: '#1e40af' },
    secondary: { main: '#ef4444' },
    background: { default: '#f7fafe', paper: '#ffffff' },
  },
  shape: { borderRadius: 12 },
  typography: { fontFamily: '"Segoe UI", "Tajawal", "Cairo", "Roboto", "Arial", sans-serif' },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, textTransform: 'none', fontWeight: 600, boxShadow: 'none' },
        contained: { boxShadow: '0 8px 18px -8px rgba(37,99,235,.35)', '&:hover': { boxShadow: '0 10px 22px -8px rgba(37,99,235,.45)' } },
      },
    },
    MuiCard: {
      styleOverrides: { root: { borderRadius: 16, border: '1px solid', borderColor: 'rgba(20,40,100,.08)' } },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiTableCell: { styleOverrides: { root: { borderColor: 'rgba(20,40,100,.07)' } } },
  },
});

theme = responsiveFontSizes(theme);

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
