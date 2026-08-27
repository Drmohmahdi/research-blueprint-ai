import { expect, type Page } from '@playwright/test';

export async function login(page: Page) {
  await loginAs(page, 'e2e_researcher');
}

export async function loginAs(page: Page, username: string) {
  // Clear cookies so /login always shows (idempotent across users).
  await page.context().clearCookies();
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder(/أدخل اسم المستخدم|Enter username/).fill(username);
  await page.locator('input[type="password"]').fill('E2ePass123!');
  await Promise.all([
    page.waitForURL(/\/app(?:\/)?$/),
    page.getByRole('button', { name: /تسجيل الدخول|Sign In/ }).click({ force: true }),
  ]);
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 20_000 });
  // Force secure-mode backend sync so the seeded e2e project is the active one.
  await page.evaluate(() => {
    localStorage.setItem('rb_secure_mode', 'true');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 20_000 });
}

/** Fast API login — sets the session cookie for page.request + page context. */
export const E2E_API = `http://127.0.0.1:${process.env.PLAYWRIGHT_API_PORT || 8010}/api`;
export async function apiLogin(page: Page, username: string) {
  await page.context().clearCookies();
  const res = await page.request.post(`${E2E_API}/auth/login`, {
    data: { username, password: 'E2ePass123!' },
  });
  expect(res.status()).toBe(200);
}

export async function expectAuthenticatedShell(page: Page, label: string) {
  await expect(page.locator('#main-content'), label).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('main'), label).toHaveCount(1);
}
