import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { E2E_API, apiLogin, loginAs } from './helpers';

/** Presses Tab up to maxTabs times until the focused element's id matches. */
async function tabToId(page: Page, id: string, maxTabs: number): Promise<boolean> {
  for (let i = 0; i < maxTabs; i++) {
    const activeId = await page.evaluate(() => document.activeElement?.id);
    if (activeId === id) return true;
    await page.keyboard.press('Tab');
  }
  return false;
}

// ── Researcher Workspace Journey (network-level) ───────────────────────────────

test('@identity my profile auto-creates and reflects the seeded upsert', async ({ page }) => {
  await apiLogin(page, 'e2e_researcher');
  const r = await page.request.get(`${E2E_API}/academic-foundation/profile/me`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.preferred_name_en).toBe('Dr. Sarah Researcher');
  expect(data.visibility_status).toBe('PUBLIC');
  expect(data.identifiers.length).toBe(1);
  expect(data.identifiers[0].status).toBe('UNVERIFIED');
  expect(data.affiliations.length).toBe(1);
});

test('@identity researcher can edit bio, interests and re-save without losing identifiers', async ({ page }) => {
  await apiLogin(page, 'e2e_researcher');
  const before = await (await page.request.get(`${E2E_API}/academic-foundation/profile/me`)).json();
  const r = await page.request.post(`${E2E_API}/academic-foundation/profile/upsert`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      ...before,
      short_bio_en: 'Updated bio via researcher workspace journey e2e test.',
      research_interests_json: ['Quantum mechanics', 'Nanomaterials', 'Renewable energy'],
    },
  });
  expect(r.status()).toBe(200);
  const after = await r.json();
  expect(after.short_bio_en).toBe('Updated bio via researcher workspace journey e2e test.');
  expect(after.research_interests_json).toContain('Renewable energy');
  expect(after.identifiers.length).toBe(1);
  expect(after.affiliations.length).toBe(1);
  // Restore, so this test is re-runnable / doesn't leak state into other tests.
  await page.request.post(`${E2E_API}/academic-foundation/profile/upsert`, {
    headers: { 'Content-Type': 'application/json' },
    data: before,
  });
});

// ── Public Profile Journey (network-level privacy) ─────────────────────────────

test('@identity public profile projects only PUBLISHED assets, never DRAFT/ACCEPTED', async ({ page }) => {
  const r = await page.request.get(`${E2E_API}/academic-foundation/public/e2e_researcher`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  const titles = data.scholarly_assets.map((a: any) => a.title_en);
  expect(titles).toContain('Role of Nanomaterials in Biomedical Applications'); // PUBLISHED, visible
  expect(titles).not.toContain('Effect of training on achievement'); // e2e-manuscript, DRAFT — must not leak
});

test('@identity public profile payload excludes private account/tenant fields', async ({ page }) => {
  const r = await page.request.get(`${E2E_API}/academic-foundation/public/e2e_researcher`);
  const raw = await r.text();
  // These must never appear on the unauthenticated public projection —
  // institutional email, organization/tenant id, internal user id, phone,
  // and the visibility_status control field itself are all account/tenant
  // metadata, not public academic identity.
  expect(raw).not.toContain('sarah@ksu.edu.sa'); // institutional_email
  expect(raw).not.toContain('e2e-org');
  expect(raw).not.toContain('e2e-researcher-user');
  expect(raw).not.toContain('visibility_status');
  expect(raw).not.toContain('institutional_email');
  expect(raw).not.toContain('"phone"');
});

test('@identity non-public (PRIVATE) profile is not reachable via the public endpoint', async ({ page }) => {
  const r = await page.request.get(`${E2E_API}/academic-foundation/public/e2e_co_researcher`);
  expect(r.status()).toBe(404);
});

test('@identity unknown username returns 404, not a stack trace or auto-created profile', async ({ page }) => {
  const r = await page.request.get(`${E2E_API}/academic-foundation/public/no-such-user-e2e`);
  expect(r.status()).toBe(404);
});

// ── Security / spoofing (network-level) ─────────────────────────────────────────

test('@identity legacy academic-visibility IDOR router stays retired', async ({ page }) => {
  await apiLogin(page, 'e2e_outsider');
  const r = await page.request.get(`${E2E_API}/academic-visibility/profile/e2e-researcher-user`);
  expect(r.status()).toBe(404);
});

test('@identity a client cannot self-declare VERIFIED on a new identifier via the API', async ({ page }) => {
  await apiLogin(page, 'e2e_outsider');
  const r = await page.request.post(`${E2E_API}/academic-foundation/profile/upsert`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      preferred_name_en: 'Outsider Spoof Attempt',
      visibility_status: 'PUBLIC',
      identifiers: [{ identifier_type: 'ORCID', identifier_value: '0000-0009-9999-0001', status: 'VERIFIED' }],
    },
  });
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.identifiers[0].status).toBe('UNVERIFIED');
});

test('@identity self-declared published work is labeled SELF_DECLARED, not pipeline-verified', async ({ page }) => {
  const r = await page.request.get(`${E2E_API}/academic-foundation/public/e2e_researcher`);
  expect(r.status()).toBe(200);
  const asset = (await r.json()).scholarly_assets.find(
    (a: any) => a.title_en === 'Role of Nanomaterials in Biomedical Applications'
  );
  expect(asset).toBeTruthy();
  expect(asset.publication_verification_status).toBe('SELF_DECLARED');
});

test('@identity Unified Search hides a same-org colleague\'s unpublished manuscript', async ({ page }) => {
  await apiLogin(page, 'e2e_co_researcher');
  const r = await page.request.get(`${E2E_API}/search`, {
    params: { q: 'training on achievement', domains: 'ASSET' }, // e2e-manuscript's title, DRAFT, owned by e2e_researcher
  });
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.total).toBe(0);
  expect(data.results).toEqual([]);
});

test('@identity Unified Search navigates to a colleague\'s public profile, not the searcher\'s own editor', async ({ page }) => {
  await apiLogin(page, 'e2e_co_researcher');
  const r = await page.request.get(`${E2E_API}/search`, {
    params: { q: 'Dr. Sarah Researcher', domains: 'PROFILE' },
  });
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.total).toBeGreaterThan(0);
  expect(data.results[0].target).toBe('/researcher/e2e_researcher');
  expect(data.results[0].target).not.toBe('/app/profile');
});

// ── Researcher Workspace Journey (UI) ───────────────────────────────────────────

test('@identity researcher can navigate all three profile tabs and see seeded data', async ({ page }) => {
  await loginAs(page, 'e2e_researcher');
  await page.goto('/app/profile', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/الملف الأكاديمي الموحد|Unified Academic Profile/).first()).toBeVisible();
  await expect(page.locator('#profile-pref-name-en')).toHaveValue('Dr. Sarah Researcher');

  await page.getByRole('button', { name: /معرفات وقنوات النشر|Academic Identifiers/ }).click();
  await expect(page.locator('#identifier-value-0')).toHaveValue('0000-0002-1825-0097');

  await page.getByRole('button', { name: /الانتماءات الوظيفية|Affiliations/ }).click();
  await expect(page.locator('#aff-org-name-0')).toHaveValue('King Saud University');
});

// ── Public Profile Journey (UI) ─────────────────────────────────────────────────

test('@identity public profile page renders published work and hides unpublished work', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/researcher/e2e_researcher', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Dr. Sarah Researcher').or(page.getByText('د. سارة الباحثة'))).toBeVisible();
  await expect(page.getByText('Role of Nanomaterials in Biomedical Applications').or(page.getByText('دور المواد النانوية في التطبيقات الطبية'))).toBeVisible();
  await expect(page.getByText('Effect of training on achievement')).toHaveCount(0);
});

test('@identity public profile page shows a not-available state for a private profile', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/researcher/e2e_co_researcher', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/هذا الملف غير متاح|This profile is not available/)).toBeVisible();
});

// ── Keyboard-only ────────────────────────────────────────────────────────────────

test('@keyboard profile visibility select is reachable by Tab', async ({ page }) => {
  await loginAs(page, 'e2e_researcher');
  await page.goto('/app/profile', { waitUntil: 'domcontentloaded' });
  await page.locator('#profile-pref-name-ar').focus();
  const reached = await tabToId(page, 'profile-visibility-status', 30);
  expect(reached, 'visibility status select not reachable by Tab from the top of the general tab').toBe(true);
});

// ── Axe runtime ──────────────────────────────────────────────────────────────

test('@a11y axe: no serious/critical violations on the profile editor (general tab)', async ({ page }) => {
  await loginAs(page, 'e2e_researcher');
  await page.goto('/app/profile', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(serious, serious.map((v) => `${v.id}: ${v.help}`).join('; ')).toEqual([]);
});

test('@a11y axe: no serious/critical violations on the profile editor (identifiers tab)', async ({ page }) => {
  await loginAs(page, 'e2e_researcher');
  await page.goto('/app/profile', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /معرفات وقنوات النشر|Academic Identifiers/ }).click();
  await page.waitForTimeout(500);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(serious, serious.map((v) => `${v.id}: ${v.help}`).join('; ')).toEqual([]);
});

test('@a11y axe: no serious/critical violations on the profile editor (affiliations tab)', async ({ page }) => {
  await loginAs(page, 'e2e_researcher');
  await page.goto('/app/profile', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /الانتماءات الوظيفية|Affiliations/ }).click();
  await page.waitForTimeout(500);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(serious, serious.map((v) => `${v.id}: ${v.help}`).join('; ')).toEqual([]);
});

test('@a11y axe: no serious/critical violations on the public researcher profile', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/researcher/e2e_researcher', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(serious, serious.map((v) => `${v.id}: ${v.help}`).join('; ')).toEqual([]);
});

// "Visibility" is explicitly part of this domain's own name
// (Academic Identity, Visibility & Impact Intelligence) — these two screens
// are in scope, not a separate module.

test('@a11y axe: no serious/critical violations on the visibility dashboard', async ({ page }) => {
  await loginAs(page, 'e2e_researcher');
  await page.goto('/app/visibility', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(serious, serious.map((v) => `${v.id}: ${v.help}`).join('; ')).toEqual([]);
});

test('@a11y axe: no serious/critical violations on the visibility reports screen', async ({ page }) => {
  await loginAs(page, 'e2e_researcher');
  await page.goto('/app/visibility/reports', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(serious, serious.map((v) => `${v.id}: ${v.help}`).join('; ')).toEqual([]);
});

// ── RTL / LTR ────────────────────────────────────────────────────────────────

test('@rtl profile editor is RTL (Arabic)', async ({ page }) => {
  await loginAs(page, 'e2e_researcher');
  await page.goto('/app/profile', { waitUntil: 'domcontentloaded' });
  const dir = await page.locator('html').getAttribute('dir');
  expect(dir).toBe('rtl');
});

test('@ltr profile editor is LTR (English)', async ({ page }) => {
  await loginAs(page, 'e2e_researcher');
  await page.goto('/app/profile', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /تغيير اللغة إلى الإنجليزية|English/ }).first().click();
  await page.waitForTimeout(400);
  const dir = await page.locator('html').getAttribute('dir');
  expect(dir).toBe('ltr');
});

test('@rtl public profile defaults to RTL (Arabic) and toggles to LTR', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/researcher/e2e_researcher', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('div[dir="rtl"]').first()).toBeVisible();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('div[dir="ltr"]').first()).toBeVisible();
});

// ── Responsive runtime matrix ────────────────────────────────────────────────

const viewports: Array<[number, number]> = [
  [320, 568], [375, 667], [768, 1024], [1024, 768], [1440, 900], [2560, 1440],
];
for (const [width, height] of viewports) {
  test(`@responsive profile editor usable at ${width}px without page overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await loginAs(page, 'e2e_researcher');
    await page.goto('/app/profile', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `horizontal page overflow at ${width}`).toBe(false);
  });

  test(`@responsive public profile usable at ${width}px without page overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.context().clearCookies();
    await page.goto('/researcher/e2e_researcher', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `horizontal page overflow at ${width}`).toBe(false);
  });
}

// ── Reduced motion ───────────────────────────────────────────────────────────

test('@reduced-motion profile editor remains usable', async ({ page }) => {
  await loginAs(page, 'e2e_researcher');
  await page.goto('/app/profile', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  expect(await page.textContent('main')).not.toBe('');
});
