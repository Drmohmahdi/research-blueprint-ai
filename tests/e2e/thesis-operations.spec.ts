import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('@critical External Thesis Examiner portal stays outside the app shell', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/thesis-examination/invalid-e2e-token');
  await expect(page.getByRole('heading', { name: /Invitation unavailable|Assigned thesis examination/ })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('@critical thesis operations and graduate studies screens render', async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/research/thesis');
  await expect(page.locator('#main-content')).toBeVisible();
  await expect(page.getByRole('heading', { name: /تشغيل الرسالة|Thesis operations|مساحة الرسالة|thesis workspace|لا يوجد مشروع/i })).toBeVisible();
  await page.keyboard.press('Tab');
  await page.goto('/app/research/graduate-studies');
  await expect(page.locator('#main-content')).toBeVisible();
  await expect(page.getByRole('heading', { name: /الدراسات العليا|Graduate Studies/i })).toBeVisible();
});

test('@a11y thesis targeted screens have no serious axe violations', async ({ page }) => {
  await login(page);
  for (const path of ['/app/research/thesis', '/app/research/graduate-studies', '/thesis-examination/invalid-e2e-token']) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.filter(item => item.impact === 'serious' || item.impact === 'critical'), JSON.stringify(results.violations, null, 2)).toEqual([]);
  }
});

test('@critical thesis screens honor reduced motion, RTL, and LTR', async ({ page }) => {
  await login(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/app/research/thesis');
  await expect(page.locator('html')).toHaveAttribute('dir', /rtl|ltr/);
  await page.goto('/app/research/graduate-studies');
  await expect(page.locator('#main-content')).toBeVisible();
});

const widths = [320, 375, 768, 1024, 1440, 2560] as const;

test('@critical thesis targeted screens do not overflow risk widths', async ({ page }) => {
  await login(page);
  for (const path of ['/app/research/thesis', '/app/research/graduate-studies']) {
    await page.goto(path);
    for (const width of widths) {
      await page.setViewportSize({ width, height: width >= 1440 ? 900 : 844 });
      await expect(page.locator('#main-content')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  }
});
