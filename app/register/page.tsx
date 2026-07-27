'use client';

/** /register：仅注册（新账号默认数据，不认领访客草稿） */
import AuthPageShell from '../components/AuthPageShell';

export default function RegisterPage() {
  return <AuthPageShell mode="register" title="注册" />;
}
