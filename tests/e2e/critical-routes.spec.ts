import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { login } from './helpers';

const criticalRoutes = [
  '/app',
  '/app/research',
  '/app/research/literature/synthesizer',
  '/app/search',
  '/app/promotion',
  '/app/peer-review',
  '/app/research/study-design/assistant',
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
});

test('@a11y critical authenticated routes have no serious axe violations', async ({ page }) => {
  for (const route of ['/app', '/app/search', '/app/research/study-design/assistant', '/saas/billing', '/app/peer-review']) {
    await page.goto(route);
    // Audit the settled UI, not the 180 ms theme transition's blended colors.
    await page.waitForTimeout(250);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    const serious = results.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
    expect(serious, `${route}: ${serious.map((v) => `${v.id}: ${v.help}`).join('; ')}`).toEqual([]);
  }
});
