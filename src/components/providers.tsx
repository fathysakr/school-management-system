'use client';

import { ThemeProvider, createTheme, responsiveFontSizes } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

let theme = createTheme({
  direction: 'rtl',
  palette: {
    primary: { main: '#b91c1c', light: '#ef4444', dark: '#7f1d1d' },
    secondary: { main: '#f59e0b' },
    background: { default: '#fbf3f3', paper: '#ffffff' },
  },
  shape: { borderRadius: 12 },
  typography: { fontFamily: '"Segoe UI", "Tajawal", "Cairo", "Roboto", "Arial", sans-serif' },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, textTransform: 'none', fontWeight: 600, boxShadow: 'none' },
        contained: { boxShadow: '0 8px 18px -8px rgba(185,28,28,.45)', '&:hover': { boxShadow: '0 10px 22px -8px rgba(185,28,28,.55)' } },
      },
    },
    MuiCard: {
      styleOverrides: { root: { borderRadius: 16, border: '1px solid', borderColor: 'rgba(90,20,20,.08)' } },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiTableCell: { styleOverrides: { root: { borderColor: 'rgba(90,20,20,.07)' } } },
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
