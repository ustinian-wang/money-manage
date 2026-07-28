import { expect, test } from '@playwright/test';

/**
 * 访客最小冒烟（1～2 条）：首页摘要 / 改收入后摘要仍在。
 * 不铺全旅程；不依赖登录。
 */
test.describe('访客冒烟', () => {
  test('打开首页可见决策摘要', async ({ page }) => {
    await page.goto('/');
    const summary = page.getByRole('region', { name: '本月决策摘要' });
    await expect(summary).toBeVisible();
    await expect(summary.getByText('月可花')).toBeVisible();
    await expect(summary.getByText('月支出')).toBeVisible();
    await expect(summary.getByText('月结余')).toBeVisible();
  });

  test('改到手收入后摘要数字区域仍在', async ({ page }) => {
    await page.goto('/');
    const summary = page.getByRole('region', { name: '本月决策摘要' });
    await expect(summary).toBeVisible();

    // Editable：点数值按钮（勿点 InfoTip「?」）再填 input
    const incomeRow = page.locator('.field-row-mobile', { hasText: '到手收入' }).first();
    await incomeRow.locator('button.field-click').click();
    const incomeInput = page.getByRole('spinbutton', { name: '到手收入' });
    await expect(incomeInput).toBeVisible();
    await incomeInput.fill('18000');
    await incomeInput.blur();

    await expect(summary).toBeVisible();
    await expect(summary.locator('.tabular-nums').first()).toBeVisible();
  });
});
