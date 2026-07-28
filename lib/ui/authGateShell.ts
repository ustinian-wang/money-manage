/**
 * 鉴权页布局 class：普通文档流居中，不用 fixed overflow 壳
 */

/** AuthBar page/gate：内容区居中 */
export function authGateRootClassName(): string {
  return 'flex flex-1 flex-col items-center justify-center px-4 py-10';
}

/** AuthPageShell 外层 main：相对定位 + 撑满视口，供左上角 logo 锚点 */
export function authPageShellMainClassName(): string {
  return 'relative flex min-h-screen flex-col bg-paper text-ink';
}
