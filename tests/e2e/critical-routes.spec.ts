import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { login } from './helpers';

const criticalRoutes = [
  '/app',
  '/app/research',
  '/app/research/lifecycle',
  '/app/research/data-analysis',
  '/app/research/literature/synthesizer',
  '/app/search',
  '/app/promotion',
  '/app/peer-review',
  '/app/research/study-design/assistant',
  '/app/publishing',
  '/app/profile',
  '/app/visibility',
  '/saas/billing',
];

test.beforeEach(async ({ page }) => login(page));

test('@critical authenticated critical routes remain semantic and responsive', async ({ page }) => {
  for (const route of criticalRoutes) {
    await page.goto(route);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('@critical keyboard navigation and notification drawer', async ({ page }) => {
  await page.goto('/app');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /تخطَّ إلى المحتوى|Skip to main content/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  const notifications = page.getByRole('button', { name: /الإشعارات|Notifications/ });
  await notifications.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: /مركز الإشعارات|notification center/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /مركز الإشعارات|notification center/ })).toHaveCount(0);
});

test('@critical keyboard reaches Data Studio primary action', async ({ page }) => {
  await page.goto('/app/research/data-analysis');
  await expect(page.getByRole('heading', { name: /بصيرة للبيانات|Research Data/ })).toBeVisible();
  const upload = page.getByRole('button', { name: 'مجموعة بيانات', exact: true }).or(page.getByRole('button', { name: 'Dataset', exact: true }));
  await upload.focus();
  await expect(upload).toBeFocused();
});

test('@critical lifecycle command center preserves project context and keyboard access', async ({ page }) => {
  await page.goto('/app/research/lifecycle');
  await expect(page.getByRole('heading', { name: /مركز قيادة المشروع البحثي|Research Project Command Center/ })).toBeVisible();
  const rail = page.getByRole('region', { name: /مراحل دورة حياة المشروع|Project lifecycle stages/ });
  await rail.focus();
  await expect(rail).toBeFocused();
  await expect(page.getByText(/الإجراء الأكاديمي التالي|Next academic action/)).toBeVisible();
});

test('@a11y critical authenticated routes have no serious axe violations', async ({ page }) => {
  for (const route of ['/app', '/app/search', '/app/research/lifecycle', '/app/research/data-analysis', '/app/research/study-design/assistant', '/app/publishing', '/app/peer-review', '/app/profile', '/saas/billing']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    const serious = results.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
    expect(serious, `${route}: ${serious.map((v) => `${v.id}: ${v.help}`).join('; ')}`).toEqual([]);
  }
});
