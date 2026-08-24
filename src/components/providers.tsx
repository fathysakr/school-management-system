'use client';

import { ThemeProvider, createTheme, responsiveFontSizes } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

let theme = createTheme({
  direction: 'rtl',
  palette: {
    primary: { main: '#1d4ed8', light: '#3b82f6', dark: '#1e3a8a' },
    secondary: { main: '#dc2626' },
    background: { default: '#f4f7fd', paper: '#ffffff' },
  },
  shape: { borderRadius: 12 },
  typography: { fontFamily: '"Segoe UI", "Tajawal", "Cairo", "Roboto", "Arial", sans-serif' },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, textTransform: 'none', fontWeight: 600, boxShadow: 'none' },
        contained: { boxShadow: '0 8px 18px -8px rgba(29,78,216,.40)', '&:hover': { boxShadow: '0 10px 22px -8px rgba(29,78,216,.50)' } },
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
