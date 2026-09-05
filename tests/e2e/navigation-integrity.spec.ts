import { expect, test } from '@playwright/test';

const publicPages = [
  { path: '/', heading: /من التصميم إلى الاعتماد|From study design to/ },
  { path: '/features', heading: /ماذا تفعل المنصة|What Baseerah does/ },
  { path: '/solutions', heading: /اختر مسارك|Choose the path/ },
  { path: '/how-it-works', heading: /من الحساب إلى التقرير|From account to certified/ },
  { path: '/pricing', heading: /أسعار مبنية|Pricing built around/ },
  { path: '/faq', heading: /أسئلة تتكرر|Questions before you/ },
  { path: '/about', heading: /منصة تشغيل أكاديمي|Academic operations/ },
  { path: '/contact', heading: /اطلب عرضًا|Request a demo/ },
  { path: '/institutional', heading: /موجز تشغيلي|Operational brief/ },
  { path: '/terms', heading: /الشروط والأحكام|Terms of Service/ },
  { path: '/privacy', heading: /سياسة الخصوصية|Privacy Policy/ },
  { path: '/login', heading: /مرحباً بك مجدداً|Welcome Back to Baseerah|أنشئ حسابك|Create your free Baseerah/ },
] as const;

test('@critical public routes, aliases, footer, and 404 stay connected', async ({ page }) => {
  for (const item of publicPages) {
    await page.goto(item.path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first(), item.path).toBeVisible();
    await expect(page.locator('h1').first(), item.path).toHaveText(item.heading);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), item.path).toBe(true);
  }

  await page.goto('/register', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/login\?mode=register/);

  await page.goto('/signup', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/login\?mode=register/);

  await page.goto('/this-page-does-not-exist', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /هذه الصفحة غير موجودة|This page does not exist/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /تسجيل الدخول|Sign In/ })).toHaveCount(0);
  await page.getByRole('button', { name: /العودة للرئيسية|Back to home/ }).click();
  await expect(page).toHaveURL('/');

  await page.goto('/terms', { waitUntil: 'domcontentloaded' });
  await page.locator('footer').getByRole('link', { name: /الخصوصية|Privacy/ }).click();
  await expect(page).toHaveURL(/\/privacy/);
});

test('@critical marketing header and footer links resolve', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const targets = [
    '/features',
    '/solutions',
    '/how-it-works',
    '/pricing',
    '/faq',
    '/about',
    '/institutional',
    '/contact',
  ];
  for (const href of targets) {
    const link = page.locator(`a[href="${href}"]`).first();
    await expect(link, href).toHaveCount(1);
  }

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /فتح القائمة|Open menu/ }).click();
  await page.getByRole('dialog').getByRole('link', { name: /للجامعات|Universities/ }).click();
  await expect(page).toHaveURL(/\/institutional/);
});

test('@critical public pages fit tablet viewport', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  for (const path of ['/', '/pricing', '/institutional', '/this-page-does-not-exist', '/login']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), path).toBe(true);
    await expect(page.locator('main')).toHaveCount(1);
  }
});
