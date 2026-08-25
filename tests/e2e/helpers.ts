import { expect, type Page } from '@playwright/test';

export async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder(/أدخل اسم المستخدم|Enter username/).fill('e2e_researcher');
  await page.locator('input[type="password"]').fill('E2ePass123!');
  await Promise.all([
    page.waitForURL(/\/app(?:\/)?$/),
    page.getByRole('button', { name: /تسجيل الدخول|Sign In/ }).click({ force: true }),
  ]);
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 20_000 });
}

export async function expectAuthenticatedShell(page: Page, label: string) {
  await expect(page.locator('#main-content'), label).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('main'), label).toHaveCount(1);
}
