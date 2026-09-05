import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'small-mobile', width: 320, height: 720 },
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'wide', width: 1440, height: 900 },
  { name: 'large-desktop', width: 1920, height: 1080 },
  { name: 'ultra-wide', width: 2560, height: 1080 },
] as const;

const pages = ['/', '/pricing', '/login', '/terms', '/privacy'] as const;

test.describe('@responsive visual enhancement pass', () => {
  for (const viewport of viewports) {
    test(`${viewport.name} ${viewport.width}px has no horizontal overflow on public routes`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const path of pages) {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, path).toBeLessThanOrEqual(1);
        await expect(page.locator('header, a[href="/"]').first()).toBeVisible();
        await expect(page.locator('footer').first()).toBeVisible();
        await expect(page.locator('h1').first()).toBeVisible();
      }
    });
  }

  test('small-mobile public chrome uses a drawer instead of overflowing links', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/terms', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /فتح القائمة|Open menu/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('link', { name: /الباقات|Pricing/ })).toBeVisible();
  });
});
