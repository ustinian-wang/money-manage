/**
 * 鉴权壳 class 决策：高度跟 CSS --vv-height，禁止 Tailwind min-h-screen
 * （min-height:100vh 会盖住 height:var(--vv-height)，键盘态无法滚焦点入视）
 */

/** AuthBar page/gate：挂在 .auth-gate-root 上 */
export function authGateRootClassName(): string {
  return 'auth-gate-root flex min-h-0 flex-col items-center bg-[#f6f8f5] px-4 py-10 text-[#17212b]';
}

/** AuthPageShell 就绪态外层 main（fixed gate 自撑高，勿再叠 100vh） */
export function authPageShellMainClassName(): string {
  return 'bg-[#f6f8f5] text-[#17212b]';
}
