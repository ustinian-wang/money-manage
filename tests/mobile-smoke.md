# 移动端冒烟（390×844）

> **能力边界**：Chromium / Cursor 设备模式 **不能 100% 等价 iOS Safari 键盘**（visualViewport、橡皮筋、`position: fixed` 与键盘顶起均可能不同）。真机仍需 Safari Web Inspector 复核键盘场景。

未引入 Playwright/Puppeteer（`package.json` 无浏览器 E2E 依赖）。本冒烟分两层：

1. **可重复步骤**（人工 / Cursor Browser，设备模式 390×844）
2. **可选脚本** `npm run test:mobile-smoke`：对已启动的本地服务做 HTTP + 可选 headless Chromium（系统自带，无则跳过交互断言）

## 前置

```bash
cd projects/money-manage
npm run dev   # 默认 http://localhost:3000
```

## 人工 / Cursor Browser 步骤

1. 打开 DevTools → Toggle device toolbar → **iPhone 12/13/14** 或自定义 **390 × 844**
2. 访问 `http://localhost:3000`
3. **访客主界面**：未登录应直接进主应用，见「访客」chip / 示例数据条幅；主财务面板可用
4. 顶栏「更多」含：快照、安装（若有）、**重启网站**、登录（窄屏）；点「重启网站」应弹出确认（取消则不刷新）
5. 聚焦可编辑字段：页面不应白屏/崩溃
6. （可选）注册 → 刷新仍登录且数据在 → 登出回访客

## 脚本怎么跑

```bash
# 终端 A
npm run dev

# 终端 B（BASE_URL 可改）
npm run test:mobile-smoke
```

脚本行为：请求首页 HTTP 200；可选 headless 检查 `document.body`。**不再**要求全屏门禁文案。

## 刻意不测

- 完整注册→认领→图表交互（需账号，属手工回归）
- 「重启网站」真清 Cache 后的网络层行为（确认框存在即可）
- iOS 真实键盘高度 / 安全区
