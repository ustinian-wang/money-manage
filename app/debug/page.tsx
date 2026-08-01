'use client';

/**
 * 调试链接枢纽：未开 debug 时提示加 ?debug=true
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { resolveDebugEnabled } from '../../lib/debugEnvSnapshot';

const LINKS: Array<{ href: string; label: string }> = [
  { href: '/promo-mobile.html', label: '宣发页 /promo-mobile.html' },
  { href: '/promo-mobile.html?static=1', label: '宣发页（静态）?static=1' },
  { href: '/', label: '首页 /' },
  { href: '/login', label: '登录 /login' },
  { href: '/register', label: '注册 /register' },
  { href: '/icons/icon-192.png', label: 'icon-192' },
  { href: '/icons/icon-512.png', label: 'icon-512' },
  { href: '/?debug=true', label: '开启 dbg → /?debug=true' },
  { href: '/?debug=0', label: '关闭 dbg → /?debug=0' },
];

export default function DebugHubPage() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(resolveDebugEnabled());
  }, []);

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '2rem 1.25rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Debug 枢纽</h1>
      {!enabled ? (
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          当前未开启调试浮层。请加上{' '}
          <Link href="/debug?debug=true" style={{ color: '#0f766e' }}>?debug=true</Link>
          {' '}后刷新，或从宣发页隐蔽入口进入。
        </p>
      ) : (
        <p style={{ color: '#0f766e', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          dbg 已开启（右下角浮钮）。关闭：<Link href="/debug?debug=0">?debug=0</Link>
        </p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {LINKS.map((link) => (
          <li key={link.href}>
            <a href={link.href} style={{ color: '#0f172a', textDecoration: 'underline' }}>
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
