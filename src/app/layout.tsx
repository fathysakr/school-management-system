import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import Providers from '@/components/providers';

export const metadata = {
  title: 'مدرسة صفوة الرواد الأهلية',
  description: 'نظام إدارة مدرسة صفوة الرواد الأهلية',
  manifest: '/manifest.json',
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
        </Providers>
      </body>
    </html>
  );
}
