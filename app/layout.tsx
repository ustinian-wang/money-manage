import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Money Manage · 财务管理系统',
  description: '个人收入、支出与长期分期消费评估原型',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
