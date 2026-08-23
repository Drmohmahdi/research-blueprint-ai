import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('@critical protected route, invalid login, valid login, and logout', async ({ page }) => {
  await page.goto('/app/search');
  await expect(page.getByRole('button', { name: /تسجيل الدخول|Sign In/ })).toBeVisible();

  await page.getByPlaceholder(/أدخل اسم المستخدم|Enter username/).fill('invalid-user');
  await page.locator('input[type="password"]').fill('Invalid123!');
  await page.getByRole('button', { name: /تسجيل الدخول|Sign In/ }).click();
  await expect(page.getByText(/فشل تسجيل الدخول|Login failed/)).toBeVisible();

  await login(page);
  await expect(page.locator('main')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('rb_auth_token'))).toBeNull();
  await page.getByRole('button', { name: /تسجيل الخروج|Log out/ }).click();
  await expect(page.getByRole('button', { name: /تسجيل الدخول|Sign In/ })).toBeVisible();
  const statusAfterLogout = await page.evaluate(async () => (await fetch('http://127.0.0.1:8000/api/projects', { credentials: 'include' })).status);
  expect(statusAfterLogout).toBe(401);
});
