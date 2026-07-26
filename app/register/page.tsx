'use client';

/** /register：仅注册（认领摘要闸门 keep/clear） */
import AuthPageShell from '../components/AuthPageShell';

export default function RegisterPage() {
  return <AuthPageShell mode="register" title="注册" />;
}
