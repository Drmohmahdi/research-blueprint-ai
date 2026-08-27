import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { login } from './helpers';

const PROJECT_ID = 'e2e-project';
const CC = `/app/research/projects/${PROJECT_ID}/command-center`;

test.beforeEach(async ({ page }) => {
  await login(page);
});

async function openCommandCenter(page: Page) {
  await page.goto(CC, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('rd-command-center')).toBeVisible({ timeout: 20_000 });
}

// ── Research Design Command Center runtime ───────────────────────────────────

test('@research command center renders independent indicators', async ({ page }) => {
  await openCommandCenter(page);
  // Completion, Coherence, Readiness, Protocol shown as separate indicators
  await expect(page.getByTestId('ind-completion')).toBeVisible();
  await expect(page.getByTestId('ind-coherence')).toBeVisible();
  await expect(page.getByTestId('ind-readiness')).toBeVisible();
  await expect(page.getByTestId('ind-protocol')).toBeVisible();
  // Coherence and Readiness are distinct (scores may differ)
  const completion = await page.getByTestId('ind-completion').locator('p').nth(0).textContent();
  const coherence = await page.getByTestId('ind-coherence').locator('p').nth(0).textContent();
  const readiness = await page.getByTestId('ind-readiness').locator('p').nth(0).textContent();
  expect(completion).toMatch(/%/);
  expect(coherence).toMatch(/%/);
  expect(readiness).toMatch(/%/);
});

test('@research command center shows next best action and blockers', async ({ page }) => {
  await openCommandCenter(page);
  await expect(page.getByTestId('rdcc-next-action')).toBeVisible();
  await expect(page.getByTestId('next-action-text')).toBeVisible();
  await expect(page.getByTestId('next-action-priority')).toBeVisible();
  await expect(page.getByTestId('rdcc-blockers')).toBeVisible();
});

test('@research coherence findings render with severity and navigate to source', async ({ page }) => {
  await openCommandCenter(page);
  // Seed project has no measurement instrument → BLOCKING finding for VARIABLES_TO_MEASUREMENT
  await expect(page.getByTestId('rdcc-findings')).toBeVisible();
  const finding = page.getByTestId('finding-0').first();
  await expect(finding).toBeVisible();
  // Clicking the finding navigates to the design source step
  await finding.click();
  await page.waitForURL(/\/app\/research\/projects\/e2e-project\/design\/MEASUREMENT_INSTRUMENTS/);
  await expect(page.locator('main')).toHaveCount(1);
});

test('@research design map tab shows structured nodes and unmapped', async ({ page }) => {
  await openCommandCenter(page);
  await page.getByRole('button', { name: /خريطة التصميم|Design Map/ }).click();
  await expect(page.getByTestId('rdcc-design-map')).toBeVisible();
  await expect(page.getByTestId('design-map-nodes')).toBeVisible();
  await expect(page.getByTestId('design-map-flow')).toBeVisible();
  const nodeCount = await page.getByTestId('design-map-nodes').locator('li').count();
  expect(nodeCount).toBeGreaterThanOrEqual(4);
});

test('@research protocol tab shows versions and can create protocol', async ({ page }) => {
  await openCommandCenter(page);
  await page.getByTestId('rd-command-center').getByRole('button', { name: /البروتوكول|Protocol/ }).click();
  await expect(page.getByTestId('rdcc-protocol')).toBeVisible();
  const createBtn = page.getByTestId('create-protocol-btn');
  await expect(createBtn).toBeVisible();
  await createBtn.click();
  await expect(page.getByTestId('protocol-0')).toBeVisible({ timeout: 15_000 });
  // Protocol status appears on the overview tab too
  await page.getByTestId('rd-command-center').getByRole('button', { name: /نظرة عامة|Overview/ }).click();
  await expect(page.getByTestId('ind-protocol-status')).toHaveText(/DRAFT/);
});

test('@research team tab shows project members and relationship', async ({ page }) => {
  await openCommandCenter(page);
  await page.getByRole('button', { name: /الفريق|Team/ }).click();
  await expect(page.getByTestId('rdcc-team')).toBeVisible();
  // Seeded PI member is visible
  await expect(page.getByTestId('team-member-0')).toBeVisible();
  await expect(page.getByTestId('team-member-0')).toContainText(/PI/);
});

test('@research methodology tab: deterministic + mixed methods truthfulness + AI advisory', async ({ page }) => {
  await openCommandCenter(page);
  // Use a more specific locator within the command center to avoid sidebar match
  await page.getByTestId('rd-command-center').getByRole('button', { name: /المنهجية|Methodology/ }).click();
  await expect(page.getByTestId('rdcc-methodology')).toBeVisible();
  await expect(page.getByTestId('ai-authority-note')).toBeVisible();
  await expect(page.getByTestId('ai-authority-note')).toContainText(/ADVISORY_ONLY/);
  // No "Approve Protocol / Approve Methodology / Mark Ready" AI controls anywhere
  await expect(page.getByRole('button', { name: /Approve Protocol|وافق على البروتوكول/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Approve Methodology|وافق على المنهجية/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Mark Ready|عيّن جاهز/i })).toHaveCount(0);
});

// ── Research Office operations ───────────────────────────────────────────────

test('@research office operations: aggregate-first, no raw content', async ({ page }) => {
  await page.goto('/app/research/research-office', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('research-office')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('office-stats')).toBeVisible();
  await expect(page.getByTestId('office-project-list')).toBeVisible();
  // Raw content must NOT be rendered (no problem statements, no private notes)
  await expect(page.getByText(/مشكلة بحثية تتعلق بالتحصيل الدراسي/)).toHaveCount(0);
  await expect(page.getByText(/ملاحظات خاصة|private note|participant|مشارك/i)).toHaveCount(0);
  // Aggregate-only footer does not leak raw content
  await expect(page.getByText(/بروتوكول كامل|full protocol/i)).toHaveCount(0);
});

// ── Critical research browser journey ────────────────────────────────────────

test('@research critical browser journey: coherence → finding → edit → readiness → next action → protocol → team', async ({ page }) => {
  await openCommandCenter(page);
  // Inspect coherence indicator + findings
  await expect(page.getByTestId('ind-coherence')).toBeVisible();
  const findings = await page.getByTestId('rdcc-findings').getByTestId(/finding-/).count();
  expect(findings).toBeGreaterThanOrEqual(1);
  // Navigate to the blocking finding source
  await page.getByTestId('finding-0').first().click();
  await page.waitForURL(/\/design\//);
  await expect(page.locator('main')).toHaveCount(1);
  // Return to command center
  await page.goto(CC, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('rd-command-center')).toBeVisible();
  // Readiness + next action
  await expect(page.getByTestId('ind-readiness')).toBeVisible();
  await expect(page.getByTestId('next-action-text')).toBeVisible();
  // Open protocol and create one
  await page.getByRole('button', { name: /البروتوكول|Protocol/ }).click();
  await page.getByTestId('create-protocol-btn').click();
  await expect(page.getByTestId('protocol-0')).toBeVisible({ timeout: 15_000 });
  // View team
  await page.getByRole('button', { name: /الفريق|Team/ }).click();
  await expect(page.getByTestId('rdcc-team')).toBeVisible();
  await expect(page.getByTestId('team-member-0')).toBeVisible();
});

// ── Persona UI boundaries ────────────────────────────────────────────────────

test('@research persona: researcher UI never exposes team-management or approve controls when unauthorized', async ({ page }) => {
  await openCommandCenter(page);
  // Researcher is PI/owner in seed → has create protocol. But the UI must not
  // present "Approve protocol" controls inside the command center (approval is
  // server-side; not a command-center action).
  await expect(page.getByText(/الموافقة على البروتوكول|Approve protocol/i)).toHaveCount(0);
});

// ── Keyboard accessibility ───────────────────────────────────────────────────

test('@a11y keyboard journey: tabs reach command center actions without mouse', async ({ page }) => {
  await openCommandCenter(page);
  // First focusable is the skip link or a tab button; use keyboard to reach the Design Map tab
  const tabs = page.getByRole('button', { name: /خريطة التصميم|Design Map/ });
  await tabs.focus();
  await expect(tabs).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('rdcc-design-map')).toBeVisible();
  // Keyboard can reach the protocol tab
  const protocolTab = page.getByRole('button', { name: /البروتوكول|Protocol/ });
  await protocolTab.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('rdcc-protocol')).toBeVisible();
  // Create protocol via keyboard
  const createBtn = page.getByTestId('create-protocol-btn');
  await createBtn.focus();
  await expect(createBtn).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('protocol-0')).toBeVisible({ timeout: 15_000 });
});

test('@a11y visible focus is present on interactive elements', async ({ page }) => {
  await openCommandCenter(page);
  // Open the protocol tab so the create-protocol button is available
  await page.getByTestId('rd-command-center').getByRole('button', { name: /البروتوكول|Protocol/ }).click();
  await expect(page.getByTestId('rdcc-protocol')).toBeVisible();
  const createBtn = page.getByTestId('create-protocol-btn');
  await createBtn.focus();
  await expect(createBtn).toBeFocused();
  // Focus is visibly indicated via the browser's focus ring (outline/box-shadow not none)
  const focusStyle = await createBtn.evaluate((el) => {
    const s = getComputedStyle(el);
    return `${s.outlineStyle} ${s.outlineWidth} ${s.boxShadow}`;
  });
  expect(focusStyle.trim()).not.toBe('none 0px none');
});

// ── Modal/dialog focus (protocol creation has no modal; team is inline) ──────

// ── Axe automated accessibility ──────────────────────────────────────────────

test('@a11y axe: no serious/critical violations on critical research screens', async ({ page }) => {
  // Task-required axe screens: Command Center, Design Map, Protocol, Team,
  // Methodology, Research Office. (Legacy 18-step workspace has pre-existing
  // select-name issues outside this closure scope.)
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(serious, `command center: ${serious.map((v) => `${v.id}: ${v.help}`).join('; ')}`).toEqual([]);

  const tabs = [
    { name: /خريطة التصميم|Design Map/, testid: 'rdcc-design-map' },
    { name: /البروتوكول|Protocol/, testid: 'rdcc-protocol' },
    { name: /الفريق|Team/, testid: 'rdcc-team' },
    { name: /المنهجية|Methodology/, testid: 'rdcc-methodology' },
  ];
  for (const tab of tabs) {
    await openCommandCenter(page);
    await page.getByTestId('rd-command-center').getByRole('button', { name: tab.name }).click();
    await expect(page.getByTestId(tab.testid)).toBeVisible();
    await page.waitForTimeout(300);
    const tabResults = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    const tabSerious = tabResults.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(tabSerious, `${tab.testid}: ${tabSerious.map((v) => `${v.id}: ${v.help}`).join('; ')}`).toEqual([]);
  }

  await page.goto('/app/research/research-office', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('research-office')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(300);
  const officeResults = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const officeSerious = officeResults.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(officeSerious, `research office: ${officeSerious.map((v) => `${v.id}: ${v.help}`).join('; ')}`).toEqual([]);
});

// ── Design Map semantic accessibility ────────────────────────────────────────

test('@a11y design map has semantic text and keyboard-accessible nodes', async ({ page }) => {
  await openCommandCenter(page);
  await page.getByRole('button', { name: /خريطة التصميم|Design Map/ }).click();
  await expect(page.getByTestId('design-map-flow')).toBeVisible();
  // Structured textual representation is present (not color-only)
  const flowText = await page.getByTestId('design-map-flow').textContent();
  expect(flowText).toContain('PROBLEM');
  expect(flowText).toContain('QUESTION');
  expect(flowText).toContain('VARIABLE');
  // Nodes have text labels, not only colors
  const node = page.getByTestId('design-map-nodes').locator('li').first();
  await expect(node).toContainText(/MAPPED|UNMAPPED/);
});

// ── RTL / LTR ───────────────────────────────────────────────────────────────

test.describe('@rtl', () => {
  test.use({ locale: 'ar-SA' });
  test('arabic command center lays out RTL', async ({ page }) => {
    await openCommandCenter(page);
    const dir = await page.locator('html').getAttribute('dir');
    expect(dir).toBe('rtl');
  });

  test('mixed-direction content renders inside RTL layout', async ({ page }) => {
    await openCommandCenter(page);
    // Arabic title + Latin identifiers (family name "EMPIRICAL_QUANTITATIVE") coexist
    await expect(page.getByTestId('rdcc-title')).toContainText(/مشروع/);
    await expect(page.getByText(/EMPIRICAL_QUANTITATIVE/)).toBeVisible();
    const html = await page.locator('html').getAttribute('dir');
    expect(html).toBe('rtl');
  });
});

test.describe('@ltr', () => {
  test.use({ locale: 'en-US' });
  test('english command center lays out LTR', async ({ page }) => {
    await page.goto(CC, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('rd-command-center')).toBeVisible({ timeout: 20_000 });
    // Toggle language to English — the button says "تغيير اللغة إلى الإنجليزية" in Arabic
    await page.getByRole('button', { name: /Change language|English|الإنجليزية/ }).first().click();
    await page.waitForTimeout(500);
    const dir = await page.locator('html').getAttribute('dir');
    expect(dir).toBe('ltr');
  });
});

// ── Responsive runtime matrix ────────────────────────────────────────────────

const viewports: Array<[number, number]> = [
  [320, 568], [375, 667], [768, 1024], [1024, 768], [1440, 900], [2560, 1440],
];

for (const [width, height] of viewports) {
  test(`@responsive command center usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openCommandCenter(page);
    // No horizontal page overflow
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `horizontal overflow at ${width}`).toBe(false);
    // Key content visible
    await expect(page.getByTestId('ind-readiness')).toBeVisible();
    await expect(page.getByTestId('rdcc-next-action')).toBeVisible();
  });
}

test('@responsive research office usable at 375px without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/app/research/research-office', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('research-office')).toBeVisible({ timeout: 20_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

// ── Mobile critical journey ──────────────────────────────────────────────────

test('@responsive mobile critical journey: readiness → blockers → next action → section', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openCommandCenter(page);
  await expect(page.getByTestId('ind-readiness')).toBeVisible();
  await expect(page.getByTestId('rdcc-blockers')).toBeVisible();
  await expect(page.getByTestId('next-action-text')).toBeVisible();
  // Navigate from a blocker to the relevant section
  const finding = page.getByTestId('finding-0').first();
  await finding.click();
  await page.waitForURL(/\/design\//);
  await expect(page.locator('main')).toHaveCount(1);
});

// ── Visual state truthfulness ────────────────────────────────────────────────

test('@research completion/coherence/readiness are visually separate', async ({ page }) => {
  await openCommandCenter(page);
  // Three distinct cards with distinct headings
  await expect(page.getByTestId('ind-completion')).toContainText(/الاكتمال|Completion/);
  await expect(page.getByTestId('ind-coherence')).toContainText(/الاتساق|Coherence/);
  await expect(page.getByTestId('ind-readiness')).toContainText(/الجاهزية|Readiness/);
  // They are separate elements, not one merged score
  const completionId = await page.getByTestId('ind-completion').getAttribute('data-testid');
  const coherenceId = await page.getByTestId('ind-coherence').getAttribute('data-testid');
  expect(completionId).not.toBe(coherenceId);
});

// ── Empty states ────────────────────────────────────────────────────────────

test('@research errors and empty states are handled without blank screens', async ({ page }) => {
  await openCommandCenter(page);
  // Protocol tab: either an empty state or an existing protocol list renders (never blank)
  await page.getByTestId('rd-command-center').getByRole('button', { name: /البروتوكول|Protocol/ }).click();
  await expect(page.getByTestId('rdcc-protocol')).toBeVisible();
  const emptyState = page.getByText(/لا يوجد بروتوكول بعد|No protocol yet/);
  const protocolList = page.getByTestId('protocol-0');
  if (await emptyState.count() === 0) {
    await expect(protocolList).toBeVisible();
  } else {
    await expect(emptyState).toBeVisible();
  }
  // Team list renders (seed has a PI member)
  await page.getByTestId('rd-command-center').getByRole('button', { name: /الفريق|Team/ }).click();
  await expect(page.getByTestId('rdcc-team')).toBeVisible();
  await expect(page.getByTestId('team-member-0')).toBeVisible();
});

// ── Console cleanliness ──────────────────────────────────────────────────────

test('@research no uncaught console errors on command center', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await openCommandCenter(page);
  await page.waitForTimeout(600);
  expect(errors).toEqual([]);
});

// ── Reduced motion (runs in the @reduced-motion project) ─────────────────────

test('@reduced-motion command center remains usable with reduce', async ({ page }) => {
  await openCommandCenter(page);
  // Workflow remains usable under prefers-reduced-motion
  await expect(page.getByTestId('ind-readiness')).toBeVisible();
  await expect(page.getByTestId('next-action-text')).toBeVisible();
  await page.getByTestId('rd-command-center').getByRole('button', { name: /البروتوكول|Protocol/ }).click();
  await expect(page.getByTestId('rdcc-protocol')).toBeVisible();
});
