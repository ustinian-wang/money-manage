import type { Metadata, Viewport } from 'next';
import { BRAND } from '../lib/ui/brandColors';
import AppChrome from './components/AppChrome';
import './globals.css';

export const metadata: Metadata = {
  title: 'Money Manage · 财务规划',
  description: '个人财务规划与消费承受力测算：调工资、资产与支出，即时看结余与长期走势',
  applicationName: '财务规划',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '财务规划',
  },
  // Chromium：替代已弃用的仅 apple-mobile-web-app-capable
  other: {
    'mobile-web-app-capable': 'yes',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // ponytail: 不设 maximumScale=1，避免妨碍无障碍缩放；iOS 输入缩放靠 ≥16px 字号
  viewportFit: 'cover',
  themeColor: BRAND.ink,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
