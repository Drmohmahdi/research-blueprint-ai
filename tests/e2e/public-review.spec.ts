import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('@critical @a11y external reviewer route stays outside the app shell and fails safely', async ({ page }) => {
  await page.goto('/external-review/invalid-e2e-token');
  await expect(page.getByRole('heading', { level: 1, name: 'تعذر الوصول إلى الجلسة' })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.locator('main')).toHaveCount(1);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
});

test('@critical @a11y external thesis examiner route is isolated and fails safely', async ({ page }) => {
  await page.goto('/thesis-examination/invalid-e2e-token');
  await expect(page.getByRole('heading', { name: 'الدعوة غير متاحة' })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.locator('main')).toHaveCount(1);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
});
