'use client';

/** /login：仅登录（空账号绑定草稿确认） */
import AuthPageShell from '../components/AuthPageShell';

export default function LoginPage() {
  return <AuthPageShell mode="login" title="登录" />;
}
