import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { serverSchoolFullName } from '@/lib/school-brand';
import Providers from '@/components/providers';
import PwaRegister from '@/components/pwa-register';

export const metadata = {
  title: serverSchoolFullName(),
  description: 'نظام إدارة مدرسة صفوة الرواد الأهلية',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent' as const,
    title: 'صفوة الرواد',
  },
  icons: {
    icon: [{ url: '/api/favicon' }],
    apple: '/api/favicon',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563eb',
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
