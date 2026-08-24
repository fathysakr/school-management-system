'use client';

import { ThemeProvider, createTheme, responsiveFontSizes } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

let theme = createTheme({
  direction: 'rtl',
  palette: {
    primary: { main: '#059669', light: '#10b981', dark: '#065f46' },
    secondary: { main: '#f59e0b' },
    background: { default: '#f2faf5', paper: '#ffffff' },
  },
  shape: { borderRadius: 12 },
  typography: { fontFamily: '"Segoe UI", "Tajawal", "Cairo", "Roboto", "Arial", sans-serif' },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, textTransform: 'none', fontWeight: 600, boxShadow: 'none' },
        contained: { boxShadow: '0 8px 18px -8px rgba(5,150,105,.45)', '&:hover': { boxShadow: '0 10px 22px -8px rgba(5,150,105,.55)' } },
      },
    },
    MuiCard: {
      styleOverrides: { root: { borderRadius: 16, border: '1px solid', borderColor: 'rgba(6,80,58,.08)' } },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiTableCell: { styleOverrides: { root: { borderColor: 'rgba(6,80,58,.07)' } } },
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
