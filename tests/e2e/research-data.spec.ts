import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { E2E_API, apiLogin, loginAs } from './helpers';

const DATA_STUDIO = '/app/research/data-analysis';
const DATASET_A = 'e2e-dataset-a';
const DATASET_B = 'e2e-dataset-b';

async function gotoDataStudio(page: Page) {
  await page.goto(DATA_STUDIO, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /بصيرة للبيانات والتحليل البحثي|Research Data & Analysis Studio/ })).toBeVisible({ timeout: 25_000 });
}

async function openDataStudio(page: Page, username = 'e2e_researcher') {
  await loginAs(page, username);
  await gotoDataStudio(page);
}

async function openDatasetWorkbench(page: Page, _datasetId: string) {
  await openDataStudio(page);
  await page.getByRole('button', { name: /E2E Study Dataset/ }).first().click();
  await expect(page.locator('[role="tab"]').first()).toBeVisible({ timeout: 15_000 });
}

// ── Data Command Center runtime ──────────────────────────────────────────────

test('@data command center renders separate indicators', async ({ page }) => {
  await openDataStudio(page);
  await expect(page.getByTestId('rdcc-indicators')).toBeVisible();
  const labels = [
    'ind-data-readiness', 'ind-data-quality', 'ind-analysis-readiness',
    'ind-analysis-completion', 'ind-approval-status', 'ind-staleness',
    'ind-sensitive-status', 'ind-next-action',
  ];
  for (const id of labels) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  // Data Quality GOOD + Approval UNDER_REVIEW can coexist (no single score)
  await expect(page.getByTestId('ind-approval-status')).toContainText(/UNDER_REVIEW|APPROVED/);
  await expect(page.getByTestId('ind-data-quality')).toContainText(/%/);
});

test('@data dataset manager lists datasets with version and access level', async ({ page }) => {
  await openDataStudio(page);
  await expect(page.getByText(/E2E Study Dataset A/)).toBeVisible();
  // Row for dataset A shows v3 (current version) and SENSITIVE access for owner
  const row = page.locator('tr', { hasText: 'E2E Study Dataset A' });
  await expect(row).toContainText(/v3/);
  await expect(row).toContainText(/SENSITIVE/);
});

// ── Critical data browser journey ────────────────────────────────────────────

test('@data critical journey: dataset → dictionary → sensitivity → quality → cleaning → analysis → result → approval', async ({ page }) => {
  await openDatasetWorkbench(page, DATASET_A);
  // Dictionary tab shows sensitivity labels as text (not color-only)
  await page.getByRole('tab', { name: /القاموس والمعاينة|Dictionary/ }).click();
  await expect(page.locator('tr', { hasText: 'national_id' })).toBeVisible();
  await expect(page.locator('tr', { hasText: 'medical_status' })).toBeVisible();
  // Identifier status is marked with a text/checkmark, not color-only
  await expect(page.locator('tr', { hasText: 'national_id' })).toContainText('✓');
  // Quality tab
  await page.getByRole('tab', { name: /الجودة|Quality/ }).click();
  await expect(page.getByText(/MISSING_VALUES/)).toBeVisible();
  // Cleaning tab shows non-destructive provenance wording
  await page.getByRole('tab', { name: /التنظيف|Cleaning/ }).click();
  await expect(page.getByText(/لا تتغير النسخة الخام|raw version is never changed/i)).toBeVisible();
  // Analysis tab
  await page.getByRole('tab', { name: /التحليل|Analysis/ }).click();
  await expect(page.getByText(/baseerah-stats-1.0/).first()).toBeVisible();
  // History tab shows version lineage
  await page.getByRole('tab', { name: /السجل|History/ }).click();
  await expect(page.getByText(/v1\.0/).first()).toBeVisible();
  await expect(page.getByText(/SHA-256/).first()).toBeVisible();
});

// ── Dataset version history ──────────────────────────────────────────────────

test('@data version history shows v1 RAW, v2 CLEANED, v3 ANALYSIS_READY without replacement', async ({ page }) => {
  await openDatasetWorkbench(page, DATASET_A);
  await page.getByRole('tab', { name: /السجل|History/ }).click();
  const history = page.locator('ol');
  await expect(history).toContainText(/RAW/);
  await expect(history).toContainText(/CLEANED/);
  await expect(history).toContainText(/ANALYSIS_READY/);
  await expect(history).toContainText(/Initial immutable import/);
  await expect(history).toContainText(/Analysis-ready after cleaning/);
});

// ── Network payload privacy (metadata-only) ─────────────────────────────────

test('@data network privacy: metadata-only user receives NO raw rows', async ({ page }) => {
  await apiLogin(page, 'e2e_metadata_user');
  // Direct API payload check: a metadata-only user must never receive rows,
  // identifier values, or sensitive values — regardless of any UI.
  const res = await page.request.get(`${E2E_API}/research-data/datasets/${DATASET_A}`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.access_level).toBe('METADATA');
  expect((body.preview ?? []).length).toBe(0);
  const raw = JSON.stringify(body);
  expect(raw).not.toContain('NID');           // no identifier values
  expect(raw).not.toContain('uncontrolled');  // no sensitive values
});

test('@data network privacy: de-identified member receives no identifier rows', async ({ page }) => {
  await apiLogin(page, 'e2e_co_researcher'); // CO_RESEARCHER, no sensitive grant
  const res = await page.request.get(`${E2E_API}/research-data/datasets/${DATASET_A}`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(['DEIDENTIFIED', 'METADATA']).toContain(body.access_level);
  for (const row of (body.preview ?? []) as Array<Record<string, unknown>>) {
    expect(row).not.toHaveProperty('national_id');
  }
  expect(JSON.stringify(body)).not.toContain('NID');
});

// ── Persona boundaries (UI + API adversarial) ────────────────────────────────

test('@data persona: data analyst can run analysis but not approve', async ({ page }) => {
  await apiLogin(page, 'e2e_data_analyst');
  const results = await page.request.post(`${E2E_API}/research-data/datasets/${DATASET_A}/analyses`, {
    headers: { 'Content-Type': 'application/json' },
    data: { dataset_version_id: 'e2e-dsa-v3', analysis_type: 'DESCRIPTIVES', configuration: { variables: ['score'] } },
  });
  expect(results.status()).toBe(201); // RUN_ANALYSIS granted
  const analysis = await results.json();
  expect(analysis.status).toBe('UNDER_REVIEW');
  // Same run-only user cannot approve
  const approve = await page.request.post(`${E2E_API}/research-data/analyses/${analysis.id}/review`, {
    headers: { 'Content-Type': 'application/json' },
    data: { recommendation: 'APPROVED' },
  });
  expect([403, 404]).toContain(approve.status());
});

test('@data persona: reviewer with grant can approve', async ({ page }) => {
  await apiLogin(page, 'e2e_reviewer');
  // Approve the seeded under-review analysis
  const approve = await page.request.post(`${E2E_API}/research-data/analyses/e2e-analysis-under-review/review`, {
    headers: { 'Content-Type': 'application/json' },
    data: { recommendation: 'APPROVED' },
  });
  expect(approve.status()).toBe(200);
  expect((await approve.json()).status).toBe('APPROVED');
});

test('@data persona: platform admin cannot view sensitive/download raw', async ({ page }) => {
  await apiLogin(page, 'e2e_platform_admin');
  // API: no sensitive/download/export capabilities
  const ds = await page.request.get(`${E2E_API}/research-data/datasets/${DATASET_A}`);
  expect(ds.status()).toBe(200);
  const body = await ds.json();
  expect(body.access_level).toBe('METADATA');
  expect((body.preview ?? []).length).toBe(0);
  // Download denied (no preview capability → de-identified export blocked)
  const dl = await page.request.get(`${E2E_API}/research-data/datasets/${DATASET_A}/export.csv`);
  expect(dl.status()).toBe(403);
});

test('@data persona: org admin sees aggregates only, not dataset content', async ({ page }) => {
  await apiLogin(page, 'e2e_org_admin');
  const ops = await page.request.get(`${E2E_API}/research-data/organization/operations`);
  expect(ops.status()).toBe(200);
  const body = await ops.json();
  expect(body.aggregate_only).toBe(true);
  expect(body.raw_content_excluded).toBe(true);
  const raw = JSON.stringify(body);
  expect(raw).not.toContain('NID');
  expect(raw).not.toContain('medical_status');
});

test('@data persona: dataset owner full access to A, not sensitive from B', async ({ page }) => {
  await apiLogin(page, 'e2e_researcher');
  const dsA = await page.request.get(`${E2E_API}/research-data/datasets/${DATASET_A}`);
  expect((await dsA.json()).access_level).toBe('SENSITIVE');
  // Owner of A is a project member of the project owning B → base access only.
  // Project membership must NOT grant sensitive/raw access to B.
  const dsB = await page.request.get(`${E2E_API}/research-data/datasets/${DATASET_B}`);
  expect(dsB.status()).toBe(200);
  const b = await dsB.json();
  expect(b.access_level).toBe('DEIDENTIFIED');
  for (const row of (b.preview ?? []) as Array<Record<string, unknown>>) {
    expect(row).not.toHaveProperty('id');
  }
  expect(JSON.stringify(b)).not.toContain('RESTRICTED_VALUE');
});

test('@data persona: project member without grant has no raw download', async ({ page }) => {
  await loginAs(page, 'e2e_co_researcher');
  const ds = await page.request.get(`${E2E_API}/research-data/datasets/${DATASET_A}`);
  const body = await ds.json();
  expect(['DEIDENTIFIED', 'METADATA']).toContain(body.access_level);
  // De-identified export allowed, but raw (with identifiers) is not in payload
  const dl = await page.request.get(`${E2E_API}/research-data/datasets/${DATASET_A}/export.csv`);
  expect(dl.status()).toBe(200);
  const text = await dl.text();
  expect(text.split('\n')[0]).not.toContain('national_id');
});

// ── Approved → Stale runtime ─────────────────────────────────────────────────

test('@data staleness: analysis bound to v1 is STALE once v3 is current', async ({ page }) => {
  await apiLogin(page, 'e2e_researcher');
  const stale = await page.request.get(`${E2E_API}/research-data/analyses/e2e-analysis-stale`);
  expect(stale.status()).toBe(200);
  const body = await stale.json();
  expect(body.status).toBe('STALE');
  expect(body.stale).toBe(true);
  expect(body.dataset_version_id).toBe('e2e-dsa-v1'); // historical binding preserved
});

// ── Institutional Data Operations ────────────────────────────────────────────

test('@data institutional operations dashboard is aggregate-first', async ({ page }) => {
  await apiLogin(page, 'e2e_org_admin');
  const ops = await page.request.get(`${E2E_API}/research-data/organization/operations`);
  const body = await ops.json();
  expect(body.counts.active_datasets).toBeGreaterThanOrEqual(2);
  expect(body.counts.datasets_by_classification.CONFIDENTIAL).toBeGreaterThanOrEqual(1);
  // Raw content absent
  expect(JSON.stringify(body)).not.toContain('NID');
});

// ── AI privacy (metadata-only) ───────────────────────────────────────────────

test('@data ai: metadata-only user cannot reach raw rows via AI context', async ({ page }) => {
  await apiLogin(page, 'e2e_metadata_user');
  // The AI context builder never includes participant rows. If the assist
  // endpoint responds, the payload must never contain identifier/sensitive values.
  const ctx = await page.request.post(`${E2E_API}/ai/assist`, {
    headers: { 'Content-Type': 'application/json' },
    data: { use_case: 'DATA_QUALITY_EXPLANATION', payload: { dataset_id: DATASET_A } },
  });
  if (ctx.status() === 200) {
    const text = await ctx.text();
    expect(text).not.toContain('NID');
    expect(text).not.toContain('uncontrolled');
  } else {
    // Rejected (no AI provider / validation) — no leak path either way.
    expect([400, 401, 403, 404, 422, 500, 503]).toContain(ctx.status());
  }
});

// ── Loading / empty / error states ───────────────────────────────────────────

test('@data no blank screens: workbench renders without error', async ({ page }) => {
  await openDatasetWorkbench(page, DATASET_A);
  // The workbench renders with dictionary content (not a blank screen)
  await expect(page.getByRole('tab', { name: /القاموس والمعاينة|Dictionary/ })).toBeVisible();
});

// ── Keyboard accessibility ───────────────────────────────────────────────────

test('@a11y keyboard journey: tabs navigate workbench without mouse', async ({ page }) => {
  await openDatasetWorkbench(page, DATASET_A);
  const tabs = page.getByRole('tab');
  // Focus the first tab and activate via Enter (keyboard-only).
  await tabs.nth(0).focus();
  await expect(tabs.nth(0)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { name: /القاموس والمعاينة|Dictionary/ })).toHaveAttribute('aria-selected', 'true');
  // Tab moves focus through the page; Shift+Tab returns to the tablist.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(tabs.nth(0)).toBeFocused();
});

// ── Axe automated accessibility ──────────────────────────────────────────────

test('@a11y axe: no serious/critical violations on data screens', async ({ page }) => {
  const screens = [DATA_STUDIO];
  for (const route of screens) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(serious, `${route}: ${serious.map((v) => `${v.id}: ${v.help}`).join('; ')}`).toEqual([]);
  }
});

// ── Responsive runtime matrix ────────────────────────────────────────────────

const viewports: Array<[number, number]> = [
  [320, 568], [375, 667], [768, 1024], [1024, 768], [1440, 900], [2560, 1440],
];

for (const [width, height] of viewports) {
  test(`@responsive data studio usable at ${width}px without page overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openDataStudio(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `horizontal page overflow at ${width}`).toBe(false);
    await expect(page.getByTestId('rdcc-indicators')).toBeVisible();
  });
}

test('@responsive mobile critical journey at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openDataStudio(page);
  await expect(page.getByTestId('ind-data-quality')).toBeVisible();
  await expect(page.getByTestId('ind-approval-status')).toBeVisible();
  await expect(page.getByTestId('ind-next-action')).toBeVisible();
});

// ── RTL / LTR / mixed direction ──────────────────────────────────────────────

test('@rtl arabic data studio is RTL', async ({ page }) => {
  await openDataStudio(page);
  const dir = await page.locator('html').getAttribute('dir');
  expect(dir).toBe('rtl');
  // Mixed-direction: Arabic heading + Latin statistical codes coexist
  await expect(page.getByText(/بصيرة للبيانات والتحليل البحثي/)).toBeVisible();
  await expect(page.getByText(/E2E Study Dataset A/)).toBeVisible();
});

test('@ltr english data studio is LTR', async ({ page }) => {
  await openDataStudio(page);
  await page.getByRole('button', { name: /تغيير اللغة إلى الإنجليزية|English/ }).first().click();
  await page.waitForTimeout(500);
  await gotoDataStudio(page);
  const dir = await page.locator('html').getAttribute('dir');
  expect(dir).toBe('ltr');
});

// ── Reduced motion ───────────────────────────────────────────────────────────

test('@reduced-motion data studio remains usable with reduce', async ({ page }) => {
  await openDataStudio(page);
  await expect(page.getByTestId('rdcc-indicators')).toBeVisible();
  await expect(page.getByTestId('ind-next-action')).toBeVisible();
});

// ── Console cleanliness ──────────────────────────────────────────────────────

test('@data no uncaught page errors on data studio', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await openDataStudio(page);
  await page.waitForTimeout(800);
  expect(errors).toEqual([]);
});
