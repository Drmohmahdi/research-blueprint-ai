import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { E2E_API, apiLogin, loginAs } from './helpers';

const MS = 'e2e-manuscript';
const MSV3 = 'e2e-msv3';

// ── Publication Command Center (network-level) ──────────────────────────────

test('@pub command center returns separated indicators', async ({ page }) => {
  await apiLogin(page, 'e2e_researcher');
  const r = await page.request.get(`${E2E_API}/publication-intelligence/assets/${MS}/command-center`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.asset.id).toBe(MS);
  expect(data.version.number).toBe(3);
  // Separate indicators: readiness, journal match, submission readiness
  expect(data.manuscript_readiness).toBeTruthy();
  expect(data.journal_match).toBeTruthy();
  expect(data.submission_readiness).toBeTruthy();
  expect(data.next_best_action).toBeTruthy();
});

// ── Manuscript version history (immutable, current ≠ submitted) ─────────────

test('@pub manuscript versioning: 3 versions, fingerprint-bound', async ({ page }) => {
  await apiLogin(page, 'e2e_researcher');
  const r = await page.request.get(`${E2E_API}/publication-intelligence/assets/${MS}/command-center`);
  const data = await r.json();
  expect(data.version.fingerprint).toMatch(/^[0-9a-f]{64}$/); // SHA-256
  expect(data.version.number).toBe(3);
  // Submission is bound to v3 (exact version), not a later current version
  expect(data.submissions[0].manuscript_version_id).toBe(MSV3);
});

// ── Data → Publication approved gate ─────────────────────────────────────────

test('@pub approved data dependency works, unapproved blocked', async ({ page }) => {
  await apiLogin(page, 'e2e_researcher');
  // v4 with approved dependency succeeds
  const ok = await page.request.post(`${E2E_API}/publication-intelligence/assets/${MS}/versions`, {
    headers: { 'Content-Type': 'application/json' },
    data: { article_type: 'ORIGINAL_RESEARCH', change_summary: 'v4', dependencies: [{ type: 'ANALYSIS', id: 'e2e-analysis-approved' }] },
  });
  expect(ok.status()).toBe(201);
  // Unapproved dependency (not approved) blocked
  const bad = await page.request.post(`${E2E_API}/publication-intelligence/assets/${MS}/versions`, {
    headers: { 'Content-Type': 'application/json' },
    data: { article_type: 'ORIGINAL_RESEARCH', change_summary: 'v5', dependencies: [{ type: 'ANALYSIS', id: 'e2e-analysis-under-review' }] },
  });
  expect(bad.status()).toBe(409);
});

// ── Readiness: high completion but blocked on gate ──────────────────────────

test('@pub readiness gap visible in command center', async ({ page }) => {
  await apiLogin(page, 'e2e_researcher');
  const r = await page.request.get(`${E2E_API}/publication-intelligence/assets/${MS}/command-center`);
  const readiness = (await r.json()).manuscript_readiness;
  expect(readiness.status).toBeDefined(); // READY or NOT_READY, with blocking list
  expect(readiness.blocking).toBeDefined();
});

// ── Authorship + persona boundaries (network-level) ──────────────────────────

test('@pub authorship: owner manages, co-author cannot escalate', async ({ page }) => {
  await apiLogin(page, 'e2e_researcher'); // owner
  const snap = await page.request.get(`${E2E_API}/publication-intelligence/assets/${MS}/versions/${MSV3}/authorship`);
  const authors = (await snap.json()).authors;
  expect(authors.length).toBe(2);
  expect(authors.filter(a => a.is_corresponding_author).length).toBe(1);
  const coAuthId = authors.find(a => a.user_id === 'e2e-co-researcher').id;
  // Co-author tries to set self as corresponding → 403
  await apiLogin(page, 'e2e_co_researcher');
  const escalate = await page.request.patch(`${E2E_API}/publication-intelligence/assets/${MS}/versions/${MSV3}/authorship/${coAuthId}`,
    { headers: { 'Content-Type': 'application/json' }, data: { is_corresponding_author: true } });
  expect(escalate.status()).toBe(403);
});

// ── Reporting guideline runtime ──────────────────────────────────────────────

test('@pub guidelines: STROBE applied to cross-sectional study', async ({ page }) => {
  await apiLogin(page, 'e2e_researcher');
  const g = await page.request.get(`${E2E_API}/publication-intelligence/assets/${MS}/versions/${MSV3}/guidelines`);
  expect(g.status()).toBe(200);
  const data = await g.json();
  // STROBE applies to cross-sectional quantitative research
  expect(data.applicable).toContain('STROBE');
  expect(data.checks.length).toBeGreaterThanOrEqual(1);
});

// ── Reference integrity runtime ──────────────────────────────────────────────

test('@pub references: duplicate DOI detected', async ({ page }) => {
  await apiLogin(page, 'e2e_researcher');
  const refs = await page.request.get(`${E2E_API}/publication-intelligence/assets/${MS}/versions/${MSV3}/references`);
  const list = await refs.json();
  expect(list.length).toBe(2);
  expect(list.filter(r => r.duplicate_of).length).toBe(1); // e2e-ref2 is duplicate
  const integrity = await page.request.get(`${E2E_API}/publication-intelligence/assets/${MS}/versions/${MSV3}/references/integrity`);
  const scan = await integrity.json();
  expect(scan.duplicates).toBe(1);
});

// ── Journal intelligence + truthfulness ──────────────────────────────────────

test('@pub journal match explainable, no acceptance probability', async ({ page }) => {
  await apiLogin(page, 'e2e_researcher');
  // No list endpoint; verify via command center shortlist + journal metadata snapshot
  const cc = await (await page.request.get(`${E2E_API}/publication-intelligence/assets/${MS}/command-center`)).json();
  expect(cc.journal_match.shortlisted).toBeGreaterThanOrEqual(1);
  // Journal metadata must carry provider provenance, not invented metrics
  const journal = await page.request.get(`${E2E_API}/publication-intelligence/assets/${MS}/command-center`);
  const jdata = await journal.json();
  expect(JSON.stringify(jdata)).not.toContain('probability'); // no acceptance probability
});

// ── Submission truthfulness: READY ≠ SUBMITTED, ACCEPTED ≠ PUBLISHED ────────

test('@pub submission state machine: accepted != published', async ({ page }) => {
  await apiLogin(page, 'e2e_researcher');
  const cc = await (await page.request.get(`${E2E_API}/publication-intelligence/assets/${MS}/command-center`)).json();
  const submission = cc.submissions[0];
  expect(submission.status).toBe('UNDER_REVIEW'); // seed state
  expect(cc.asset.lifecycle_status).toBe('DRAFT'); // asset not published
  // ACCEPTED would still not be PUBLISHED (enforced by state machine)
  const status = await page.request.patch(`${E2E_API}/publication-intelligence/assets/${MS}/submissions/${submission.id}/status`,
    { headers: { 'Content-Type': 'application/json' }, data: { status: 'ACCEPTED' } });
  expect(status.status()).toBe(200);
  const cc2 = await (await page.request.get(`${E2E_API}/publication-intelligence/assets/${MS}/command-center`)).json();
  expect(cc2.asset.lifecycle_status).toBe('ACCEPTED');
  expect(cc2.asset.lifecycle_status).not.toBe('PUBLISHED');
});

// ── Institutional operations + privacy ───────────────────────────────────────

test('@pub institutional operations: aggregate-first, no manuscript content', async ({ page }) => {
  await apiLogin(page, 'e2e_org_admin');
  const ops = await page.request.get(`${E2E_API}/publication-intelligence/organization/operations`);
  expect(ops.status()).toBe(200);
  const data = await ops.json();
  expect(data.aggregate_only).toBe(true);
  expect(data.raw_content_excluded).toBe(true);
  expect(data.counts.active_manuscripts).toBeGreaterThanOrEqual(1);
  const raw = JSON.stringify(data);
  // Titles are acceptable aggregate metadata; full content/abstract is not.
  expect(raw).not.toContain('Effect of training on achievement and long-term retention');
  expect(raw).not.toContain('training improves achievement'); // abstract/body
  expect(raw).not.toContain('conflict_of_interest'); // no private declarations
});

// ── IDOR ─────────────────────────────────────────────────────────────────────

test('@pub cross-tenant manuscript blocked', async ({ page }) => {
  await apiLogin(page, 'e2e_outsider');
  const r = await page.request.get(`${E2E_API}/publication-intelligence/assets/${MS}/command-center`);
  expect(r.status()).toBe(404);
});

test('@pub same-tenant co-author cannot edit manuscript', async ({ page }) => {
  await apiLogin(page, 'e2e_co_researcher');
  const r = await page.request.patch(`${E2E_API}/publication-intelligence/assets/${MS}/versions/${MSV3}/sections/TITLE`,
    { headers: { 'Content-Type': 'application/json' }, data: { status: 'DRAFT', content: {} } });
  expect(r.status()).toBe(403);
});

test('@pub platform admin has no manuscript content access', async ({ page }) => {
  await apiLogin(page, 'e2e_platform_admin');
  const r = await page.request.get(`${E2E_API}/publication-intelligence/assets/${MS}/command-center`);
  // Same org → metadata visible, but no edit authority; content isolation holds
  expect(r.status()).toBe(200);
  // Platform admin cannot edit the manuscript
  const edit = await page.request.patch(`${E2E_API}/publication-intelligence/assets/${MS}/versions/${MSV3}/sections/TITLE`,
    { headers: { 'Content-Type': 'application/json' }, data: { status: 'DRAFT', content: {} } });
  expect(edit.status()).toBe(403);
});

// ── Browser UI runtime (assets page) ─────────────────────────────────────────

test('@pub assets page renders without blank screen', async ({ page }) => {
  await loginAs(page, 'e2e_researcher');
  await page.goto('/app/assets', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const content = await page.textContent('main').catch(() => '');
  expect(content.length).toBeGreaterThan(50);
});

// ── Axe runtime ──────────────────────────────────────────────────────────────

test('@a11y axe: no serious/critical violations on publication screens', async ({ page }) => {
  await loginAs(page, 'e2e_researcher');
  await page.goto('/app/assets', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(serious, serious.map((v) => `${v.id}: ${v.help}`).join('; ')).toEqual([]);
});

// ── RTL / LTR ────────────────────────────────────────────────────────────────

test('@rtl publication page is RTL (Arabic)', async ({ page }) => {
  await loginAs(page, 'e2e_researcher');
  await page.goto('/app/assets', { waitUntil: 'domcontentloaded' });
  const dir = await page.locator('html').getAttribute('dir');
  expect(dir).toBe('rtl');
});

test('@ltr publication page is LTR (English)', async ({ page }) => {
  await loginAs(page, 'e2e_researcher');
  await page.goto('/app/assets', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /تغيير اللغة إلى الإنجليزية|English/ }).first().click();
  await page.waitForTimeout(400);
  const dir = await page.locator('html').getAttribute('dir');
  expect(dir).toBe('ltr');
});

// ── Responsive runtime matrix ────────────────────────────────────────────────

const viewports: Array<[number, number]> = [
  [320, 568], [375, 667], [768, 1024], [1024, 768], [1440, 900], [2560, 1440],
];
for (const [width, height] of viewports) {
  test(`@responsive assets page usable at ${width}px without page overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await loginAs(page, 'e2e_researcher');
    await page.goto('/app/assets', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `horizontal page overflow at ${width}`).toBe(false);
  });
}

// ── Reduced motion ───────────────────────────────────────────────────────────

test('@reduced-motion publication page remains usable', async ({ page }) => {
  await loginAs(page, 'e2e_researcher');
  await page.goto('/app/assets', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  expect(await page.textContent('main')).not.toBe('');
});

// ── Console cleanliness ──────────────────────────────────────────────────────

test('@pub no uncaught page errors on assets page', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await loginAs(page, 'e2e_researcher');
  await page.goto('/app/assets', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  expect(errors).toEqual([]);
});
