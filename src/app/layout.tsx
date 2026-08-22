import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import Providers from '@/components/providers';
import PwaRegister from '@/components/pwa-register';

export const metadata = {
  title: 'مدرسة صفوة الرواد الأهلية',
  description: 'نظام إدارة مدرسة صفوة الرواد الأهلية',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent' as const,
    title: 'صفوة الرواد',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1a237e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0 }}>
        <Providers>
          <AuthProvider>{children}</AuthProvider>
          <PwaRegister />
        </Providers>
      </body>
    </html>
  );
}
