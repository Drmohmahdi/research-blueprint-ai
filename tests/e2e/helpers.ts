import type { Page } from '@playwright/test';

export async function login(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder(/أدخل اسم المستخدم|Enter username/).fill('e2e_researcher');
  await page.locator('input[type="password"]').fill('E2ePass123!');
  await Promise.all([
    page.waitForURL(/\/app(?:\/)?$/),
    page.getByRole('button', { name: /تسجيل الدخول|Sign In/ }).click({ force: true }),
  ]);
}
