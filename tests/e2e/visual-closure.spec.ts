import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { login } from './helpers';

const themeRoutes = ['/app', '/app/research/data-analysis', '/app/peer-review', '/app/publishing'];
const widthRoutes = [
  { path: '/app', name: 'command-center' },
  { path: '/app/research', name: 'research' },
  { path: '/app/research/data-analysis', name: 'data-studio' },
  { path: '/app/publishing', name: 'publication' },
  { path: '/app/peer-review', name: 'peer-review' },
  { path: '/app/promotion', name: 'promotion' },
  { path: '/app/visibility', name: 'identity' },
];
const widths = [320, 375, 768, 1024, 1440, 2560] as const;

test('@critical login remains usable across theme and locale', async ({ page }) => {
  const matrix = [
    { lang: 'ar', theme: 'dark' },
    { lang: 'ar', theme: 'light' },
    { lang: 'en', theme: 'dark' },
    { lang: 'en', theme: 'light' },
  ] as const;
  for (const combo of matrix) {
    await page.setViewportSize({ width: combo.theme === 'light' ? 390 : 1440, height: 844 });
    await page.goto('/login');
    await page.evaluate(({ lang, theme }) => {
      localStorage.setItem('rb_lang', lang);
      localStorage.setItem('rb_theme', theme);
    }, combo);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /تسجيل الدخول|Sign In/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const dir = await page.evaluate(() => document.documentElement.getAttribute('dir'));
    expect(dir).toBe(combo.lang === 'ar' ? 'rtl' : 'ltr');
  }
});

test('@a11y login has no serious axe violations', async ({ page }) => {
  await page.goto('/login');
  await page.waitForTimeout(250);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(serious, serious.map((v) => `${v.id}: ${v.help}`).join('; ')).toEqual([]);
});

test('@critical risk-based widths do not overflow critical workspaces', async ({ page }) => {
  test.setTimeout(6 * 60_000);
  await login(page);
  for (const width of widths) {
    await page.setViewportSize({ width, height: width >= 1440 ? 900 : 844 });
    for (const route of widthRoutes) {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main'), `${width} ${route.name}`).toHaveCount(1);
      await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth).catch(() => false), {
        message: `${width}px ${route.name} must not create page-level horizontal overflow`,
      }).toBe(true);
    }
  }
});

test('@critical Data Studio tables scroll locally at 320', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await login(page);
  await page.goto('/app/research/data-analysis');
  await expect(page.getByRole('heading', { name: /بصيرة للبيانات|Research Data/ })).toBeVisible();
  const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(pageOverflow).toBe(true);
});

test('@critical External Reviewer stays outside the app shell at compact and wide widths', async ({ page }) => {
  for (const width of [320, 768, 1440, 2560] as const) {
    await page.setViewportSize({ width, height: 720 });
    await page.goto('/external-review/invalid-e2e-token');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('@critical mixed statistical strings stay LTR inside Arabic UI', async ({ page }) => {
  await login(page);
  await page.goto('/app/research');
  await expect(page.locator('main')).toBeVisible();
  const sample = await page.evaluate(() => {
    const probe = document.createElement('p');
    probe.className = 'ds-numeric';
    probe.dir = 'ltr';
    probe.textContent = "p = 0.021 · Cohen's d = 0.63 · 95% CI [0.21, 1.05] · ORCID · DOI";
    document.querySelector('main')?.append(probe);
    const style = getComputedStyle(probe);
    return { dir: probe.dir, family: style.fontFamily, numeric: style.fontVariantNumeric };
  });
  expect(sample.dir).toBe('ltr');
  expect(sample.family.toLowerCase()).toMatch(/ibm plex sans arabic|inter/);
});

test('@critical chart series remain distinct under vision deficiency', async ({ page }) => {
  await login(page);
  await page.goto('/app/research');
  await expect(page.locator('main')).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  for (const type of ['protanopia', 'deuteranopia', 'tritanopia'] as const) {
    await cdp.send('Emulation.setEmulatedVisionDeficiency', { type });
    await expect(page.locator('main')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await cdp.send('Emulation.setEmulatedVisionDeficiency', { type: 'none' });
});

test('@reduced-motion critical routes still render with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  for (const route of themeRoutes) {
    await page.goto(route);
    await expect(page.locator('main')).toHaveCount(1);
    const duration = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.className = 'ds-transition';
      document.body.append(probe);
      const value = getComputedStyle(probe).transitionDuration;
      probe.remove();
      return value;
    });
    const tokens = duration.split(',').map((part) => part.trim());
    expect(tokens.every((part) => part === '0s' || part === '0.001s' || part === '1ms' || parseFloat(part) === 0)).toBeTruthy();
  }
});
