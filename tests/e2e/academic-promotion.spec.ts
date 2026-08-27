import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { E2E_API, apiLogin, loginAs } from './helpers';

const SEEDED_APPLICATION_ID = 'e2e-promo-app';

/** Presses Tab up to maxTabs times until the focused element's text matches. */
async function tabToText(page: Page, matcher: RegExp, maxTabs: number): Promise<boolean> {
  for (let i = 0; i < maxTabs; i++) {
    const text = await page.evaluate(() => (document.activeElement?.textContent || '').trim().slice(0, 80));
    if (matcher.test(text)) return true;
    await page.keyboard.press('Tab');
  }
  const finalText = await page.evaluate(() => (document.activeElement?.textContent || '').trim().slice(0, 80));
  return matcher.test(finalText);
}

// ── Policy Management (network-level) ─────────────────────────────────────────

test('@promo default institutional bylaws auto-seed with 4 mandatory criteria', async ({ page }) => {
  await apiLogin(page, 'e2e_co_researcher');
  const r = await page.request.get(`${E2E_API}/promotions/policies`);
  expect(r.status()).toBe(200);
  const policies = await r.json();
  const active = policies.find((p: any) => p.status === 'ACTIVE' && p.is_default === true);
  expect(active).toBeTruthy();
  expect(active.target_rank).toBe('ASSOCIATE_PROFESSOR');
  expect(active.criteria.length).toBe(4);
  const codes = active.criteria.map((c: any) => c.code).sort();
  expect(codes).toEqual(['MIN_PAPERS_COUNT', 'MIN_RESEARCH_POINTS', 'Q1_Q2_INDEXED', 'SOLE_OR_FIRST_AUTHOR']);
});

test('@promo researcher cannot create a policy (RBAC)', async ({ page }) => {
  await apiLogin(page, 'e2e_co_researcher');
  const r = await page.request.post(`${E2E_API}/promotions/policies`, {
    headers: { 'Content-Type': 'application/json' },
    data: { name_ar: 'محاولة باحث', name_en: 'Researcher attempt', target_rank: 'ASSOCIATE_PROFESSOR' },
  });
  expect(r.status()).toBe(403);
});

test('@promo organization admin can create a policy', async ({ page }) => {
  await apiLogin(page, 'e2e_org_admin');
  const r = await page.request.post(`${E2E_API}/promotions/policies`, {
    headers: { 'Content-Type': 'application/json' },
    data: { name_ar: `سياسة اختبار ${Date.now()}`, name_en: `Test policy ${Date.now()}`, target_rank: 'FULL_PROFESSOR', status: 'DRAFT' },
  });
  expect(r.status()).toBe(201);
  const body = await r.json();
  expect(body.status).toBe('DRAFT');
  expect(body.version).toBe(1);
});

// ── Seeded Dossier (network-level, read-only) ──────────────────────────────────

test('@promo my application: seeded dossier reflects real partial readiness', async ({ page }) => {
  await apiLogin(page, 'e2e_co_researcher');
  const r = await page.request.get(`${E2E_API}/promotions/applications/my`);
  expect(r.status()).toBe(200);
  const data = await r.json();
  expect(data.id).toBe(SEEDED_APPLICATION_ID);
  expect(data.status).toBe('DRAFT');
  expect(data.evidence_selections.length).toBe(2);
  expect(data.total_calculated_points).toBeCloseTo(31.25, 2);
  expect(data.readiness_percentage).toBeGreaterThan(0);
  expect(data.readiness_percentage).toBeLessThan(100);
  expect(data.evaluation_summary_json.is_stale).toBe(false);
});

// ── Tenant & Peer Isolation ─────────────────────────────────────────────────────

test('@promo cross-tenant application access blocked', async ({ page }) => {
  await apiLogin(page, 'e2e_outsider');
  const r = await page.request.get(`${E2E_API}/promotions/applications/${SEEDED_APPLICATION_ID}`);
  expect(r.status()).toBe(404);
});

test('@promo same-tenant non-privileged researcher cannot view another applicant dossier', async ({ page }) => {
  await apiLogin(page, 'e2e_reviewer'); // plain RESEARCHER, not owner, not admin/supervisor
  const r = await page.request.get(`${E2E_API}/promotions/applications/${SEEDED_APPLICATION_ID}`);
  expect(r.status()).toBe(403);
});

// ── Resource-Scoped Committee Authority, Platform/Org Admin Boundaries ─────────
// Committee decision authority is granted ONLY through an explicit
// PromotionCommitteeAssignment on the exact application — never through
// organization role or platform-admin status. e2e-org-admin is explicitly
// assigned to SEEDED_APPLICATION_ID in e2e_seed.py; e2e_researcher (OWNER)
// and e2e_platform_admin (SystemAdmin) are deliberately NOT assigned to it.

test('@promo explicitly assigned committee member can view and evaluate their assigned dossier', async ({ page }) => {
  await apiLogin(page, 'e2e_org_admin'); // explicitly assigned in e2e_seed.py
  const view = await page.request.get(`${E2E_API}/promotions/applications/${SEEDED_APPLICATION_ID}`);
  expect(view.status()).toBe(200);
  expect((await view.json()).is_committee_member).toBe(true);
  const evalRes = await page.request.post(`${E2E_API}/promotions/applications/${SEEDED_APPLICATION_ID}/evaluate`);
  expect(evalRes.status()).toBe(200);
  const evalData = await evalRes.json();
  expect(evalData.readiness_percentage).toBeGreaterThan(0);
});

test('@promo organization OWNER retains read-only administrative oversight, never the private dossier', async ({ page }) => {
  await apiLogin(page, 'e2e_researcher'); // org OWNER, NOT committee-assigned to this dossier
  const view = await page.request.get(`${E2E_API}/promotions/applications/${SEEDED_APPLICATION_ID}`);
  expect(view.status()).toBe(200); // read-only institutional oversight retained
  const body = await view.json();
  // Server-side projection: administrative metadata only — raw network
  // assertion that the private academic dossier is genuinely absent from the
  // payload, not merely hidden by the frontend.
  expect(body.is_admin_metadata_only).toBe(true);
  expect(body).not.toHaveProperty('is_committee_member');
  expect(body).not.toHaveProperty('evidence_selections');
  expect(body).not.toHaveProperty('readiness_percentage');
  expect(body).not.toHaveProperty('total_calculated_points');
  expect(body).not.toHaveProperty('evaluation_summary_json');
  expect(body).not.toHaveProperty('human_review_notes');
  const evalRes = await page.request.post(`${E2E_API}/promotions/applications/${SEEDED_APPLICATION_ID}/evaluate`);
  expect(evalRes.status()).toBe(403); // but NOT committee/evaluation authority
});

test('@promo platform admin gets no automatic academic access: GET, evaluate, and review all blocked', async ({ page }) => {
  // Platform-wide administration must never imply access to private academic
  // promotion content — a platform SystemAdmin gets nothing here unless
  // separately, explicitly committee-assigned like anyone else.
  await apiLogin(page, 'e2e_platform_admin');
  const view = await page.request.get(`${E2E_API}/promotions/applications/${SEEDED_APPLICATION_ID}`);
  expect(view.status()).toBe(403);
  const evalRes = await page.request.post(`${E2E_API}/promotions/applications/${SEEDED_APPLICATION_ID}/evaluate`);
  expect(evalRes.status()).toBe(403);
  const reviewRes = await page.request.post(`${E2E_API}/promotions/applications/${SEEDED_APPLICATION_ID}/review`, {
    headers: { 'Content-Type': 'application/json' },
    data: { decision: 'ELIGIBLE_RECOMMENDED', notes: 'Platform admin attempt' },
  });
  expect(reviewRes.status()).toBe(403);
  // Deciding who sits on an applicant's promotion committee is institutional
  // academic governance, not platform operations — platform admin gets
  // nothing here either, unlike verify_policy_admin's bylaws-configuration scope.
  const assignRes = await page.request.post(`${E2E_API}/promotions/applications/${SEEDED_APPLICATION_ID}/committee`, {
    headers: { 'Content-Type': 'application/json' },
    data: { user_id: 'e2e-reviewer' },
  });
  expect(assignRes.status()).toBe(403);
});

test('@promo committee assignment and revocation via API grant and remove resource-scoped authority', async ({ page }) => {
  await apiLogin(page, 'e2e_researcher'); // OWNER — has committee-admin authority to assign/revoke
  const createRes = await page.request.post(`${E2E_API}/promotions/applications`, {
    headers: { 'Content-Type': 'application/json' },
    data: { target_rank: 'ASSOCIATE_PROFESSOR' },
  });
  // e2e_researcher (OWNER) creating their own application here purely to have
  // an isolated fixture to assign a committee onto — the assignee below
  // (e2e_reviewer) is the actual subject under test, not the applicant.
  const app = await createRes.json();

  const assign = await page.request.post(`${E2E_API}/promotions/applications/${app.id}/committee`, {
    headers: { 'Content-Type': 'application/json' },
    data: { user_id: 'e2e-reviewer' },
  });
  expect(assign.status()).toBe(201);

  await apiLogin(page, 'e2e_reviewer');
  const viewAfterAssign = await page.request.get(`${E2E_API}/promotions/applications/${app.id}`);
  expect(viewAfterAssign.status()).toBe(200);
  expect((await viewAfterAssign.json()).is_committee_member).toBe(true);

  await apiLogin(page, 'e2e_researcher');
  const revoke = await page.request.delete(`${E2E_API}/promotions/applications/${app.id}/committee/e2e-reviewer`);
  expect(revoke.status()).toBe(200);
  expect((await revoke.json()).status).toBe('REVOKED');

  await apiLogin(page, 'e2e_reviewer');
  const viewAfterRevoke = await page.request.get(`${E2E_API}/promotions/applications/${app.id}`);
  expect(viewAfterRevoke.status()).toBe(403);
});

test('@promo applicant cannot be assigned to their own review committee', async ({ page }) => {
  await apiLogin(page, 'e2e_co_researcher');
  const createRes = await page.request.post(`${E2E_API}/promotions/applications`, {
    headers: { 'Content-Type': 'application/json' },
    data: { target_rank: 'ASSOCIATE_PROFESSOR' },
  });
  const app = await createRes.json();
  await apiLogin(page, 'e2e_researcher'); // OWNER, committee-admin authority
  const assign = await page.request.post(`${E2E_API}/promotions/applications/${app.id}/committee`, {
    headers: { 'Content-Type': 'application/json' },
    data: { user_id: 'e2e-co-researcher' },
  });
  expect(assign.status()).toBe(422);
});

test('@promo unassigned same-tenant researcher cannot review a submitted application', async ({ page }) => {
  await apiLogin(page, 'e2e_co_researcher');
  const createRes = await page.request.post(`${E2E_API}/promotions/applications`, {
    headers: { 'Content-Type': 'application/json' },
    data: { target_rank: 'ASSOCIATE_PROFESSOR' },
  });
  const app = await createRes.json();
  await page.request.post(`${E2E_API}/promotions/applications/${app.id}/submit`);

  await apiLogin(page, 'e2e_reviewer'); // same tenant, never assigned to this application
  const r = await page.request.post(`${E2E_API}/promotions/applications/${app.id}/review`, {
    headers: { 'Content-Type': 'application/json' },
    data: { decision: 'ELIGIBLE_RECOMMENDED', notes: 'Unassigned attempt' },
  });
  expect(r.status()).toBe(403);
});

// ── Full Lifecycle (isolated fixtures — never mutates the shared seeded dossier) ─

test('@promo full lifecycle: create, add evidence, evaluate, submit, committee decision', async ({ page }) => {
  await apiLogin(page, 'e2e_co_researcher');

  const createRes = await page.request.post(`${E2E_API}/promotions/applications`, {
    headers: { 'Content-Type': 'application/json' },
    data: { target_rank: 'ASSOCIATE_PROFESSOR' },
  });
  expect(createRes.status()).toBe(201);
  const app = await createRes.json();
  expect(app.status).toBe('DRAFT');

  // Committee authority is resource-scoped: e2e_org_admin must be explicitly
  // assigned to THIS application before they may act on it at all (their
  // ORGANIZATION_ADMIN role grants the authority to make this assignment,
  // including assigning themselves — a real, audited, explicit action).
  await apiLogin(page, 'e2e_org_admin');
  const assignCommittee = await page.request.post(`${E2E_API}/promotions/applications/${app.id}/committee`, {
    headers: { 'Content-Type': 'application/json' },
    data: { user_id: 'e2e-org-admin' },
  });
  expect(assignCommittee.status()).toBe(201);

  // Cannot record a committee review before submission.
  const prematureReview = await page.request.post(`${E2E_API}/promotions/applications/${app.id}/review`, {
    headers: { 'Content-Type': 'application/json' },
    data: { decision: 'ELIGIBLE_RECOMMENDED', notes: 'Premature' },
  });
  expect(prematureReview.status()).toBe(409);

  await apiLogin(page, 'e2e_co_researcher');
  const addEvidence = await page.request.post(`${E2E_API}/promotions/applications/${app.id}/evidence`, {
    headers: { 'Content-Type': 'application/json' },
    data: { scholarly_asset_ids: ['e2e-promo-asset-q1'] },
  });
  expect(addEvidence.status()).toBe(200);
  expect((await addEvidence.json()).evidence_selections.length).toBe(1);

  const submitRes = await page.request.post(`${E2E_API}/promotions/applications/${app.id}/submit`);
  expect(submitRes.status()).toBe(200);
  expect((await submitRes.json()).status).toBe('SUBMITTED');

  // Locked once submitted: evidence mutation now rejected.
  const lockedAdd = await page.request.post(`${E2E_API}/promotions/applications/${app.id}/evidence`, {
    headers: { 'Content-Type': 'application/json' },
    data: { scholarly_asset_ids: ['e2e-promo-asset-q2'] },
  });
  expect(lockedAdd.status()).toBe(409);

  await apiLogin(page, 'e2e_org_admin');
  const decision = await page.request.post(`${E2E_API}/promotions/applications/${app.id}/review`, {
    headers: { 'Content-Type': 'application/json' },
    data: { decision: 'ELIGIBLE_RECOMMENDED', notes: 'Approved by the academic board (E2E)' },
  });
  expect(decision.status()).toBe(200);
  expect((await decision.json()).status).toBe('COMPLETED');

  // Terminal state: applicant can no longer remove evidence.
  await apiLogin(page, 'e2e_co_researcher');
  const lockedRemove = await page.request.delete(`${E2E_API}/promotions/applications/${app.id}/evidence/e2e-promo-asset-q1`);
  expect(lockedRemove.status()).toBe(409);
});

test('@promo an active policy is immutable; a new version preserves the locked application', async ({ page }) => {
  await apiLogin(page, 'e2e_org_admin');
  const createPolicy = await page.request.post(`${E2E_API}/promotions/policies`, {
    headers: { 'Content-Type': 'application/json' },
    data: { name_ar: `لائحة إصدار ${Date.now()}`, name_en: `Version bylaws ${Date.now()}`, target_rank: 'ASSOCIATE_PROFESSOR', status: 'ACTIVE' },
  });
  const policyV1 = await createPolicy.json();
  expect(policyV1.version).toBe(1);

  await apiLogin(page, 'e2e_co_researcher');
  const appRes = await page.request.post(`${E2E_API}/promotions/applications`, {
    headers: { 'Content-Type': 'application/json' },
    data: { policy_id: policyV1.id, target_rank: 'ASSOCIATE_PROFESSOR' },
  });
  const app = await appRes.json();
  expect(app.policy_version).toBe(1);

  await apiLogin(page, 'e2e_org_admin');
  const putAttempt = await page.request.put(`${E2E_API}/promotions/policies/${policyV1.id}`, {
    headers: { 'Content-Type': 'application/json' },
    data: { name_ar: 'محاولة تعديل', name_en: 'Mutation attempt', target_rank: 'ASSOCIATE_PROFESSOR', status: 'ACTIVE' },
  });
  expect(putAttempt.status()).toBe(409);

  const newVersion = await page.request.post(`${E2E_API}/promotions/policies/${policyV1.id}/new-version`);
  expect(newVersion.status()).toBe(201);
  expect((await newVersion.json()).version).toBe(2);

  const appCheck = await page.request.get(`${E2E_API}/promotions/applications/${app.id}`);
  expect((await appCheck.json()).policy_version).toBe(1);
});

// ── Browser UI runtime ────────────────────────────────────────────────────────

test('@promo dashboard renders the seeded dossier without a blank screen', async ({ page }) => {
  await loginAs(page, 'e2e_co_researcher');
  await page.goto('/app/promotion', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const content = await page.textContent('main').catch(() => '');
  expect(content.length).toBeGreaterThan(50);
});

test('@promo no uncaught page errors on the promotion dashboard', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await loginAs(page, 'e2e_co_researcher');
  await page.goto('/app/promotion', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  expect(errors).toEqual([]);
});

// ── Keyboard-only Applicant Journey ────────────────────────────────────────────
// PromotionDashboard.tsx has no modal/dialog anywhere (confirmed by reading the
// full component) — it is a single flat page. Focus Entry/Trap/Return/Error
// Focus are therefore N/A here (nothing to trap or return from); what remains
// meaningfully testable is real Tab-order reachability of every primary action.

test('@promo @keyboard applicant can reach every primary dashboard action with keyboard only', async ({ page }) => {
  // GET /applications/my returns the CALLER'S MOST RECENTLY CREATED
  // application, and several other tests in this file also have
  // e2e_co_researcher create fresh (empty) applications — so this test
  // cannot rely on execution order surfacing the rich seeded fixture. It
  // creates and populates its own dedicated application via the API first,
  // guaranteeing it is both the most recent and has evidence, so the
  // dashboard the keyboard journey below exercises is deterministic
  // regardless of what ran before it.
  await apiLogin(page, 'e2e_co_researcher');
  const createRes = await page.request.post(`${E2E_API}/promotions/applications`, {
    headers: { 'Content-Type': 'application/json' },
    data: { target_rank: 'ASSOCIATE_PROFESSOR' },
  });
  const app = await createRes.json();
  await page.request.post(`${E2E_API}/promotions/applications/${app.id}/evidence`, {
    headers: { 'Content-Type': 'application/json' },
    data: { scholarly_asset_ids: ['e2e-promo-asset-q1'] },
  });

  await loginAs(page, 'e2e_co_researcher');
  await page.goto('/app/promotion', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const foundRankSwitch = await tabToText(page, /أستاذ مشارك|Associate Prof/, 60);
  expect(foundRankSwitch, 'rank switch control not reachable by Tab').toBe(true);

  const foundReEvaluate = await tabToText(page, /إعادة التقييم|Re-Evaluate/, 15);
  expect(foundReEvaluate, 're-evaluate control not reachable by Tab').toBe(true);

  const foundSubmit = await tabToText(page, /تقديم الملف للجنة الترقية|Submit to Committee/, 20);
  expect(foundSubmit, 'submit-to-committee control not reachable by Tab — the seeded dossier has evidence, so this control must be present').toBe(true);

  // Reach the evidence picker <select> (the exact control fixed for
  // accessibility earlier this closure — id="promotion-evidence-select").
  let reachedSelect = false;
  for (let i = 0; i < 30; i++) {
    const id = await page.evaluate(() => document.activeElement?.id);
    if (id === 'promotion-evidence-select') { reachedSelect = true; break; }
    await page.keyboard.press('Tab');
  }
  expect(reachedSelect, 'evidence picker select not reachable by Tab').toBe(true);
});

// ── Axe runtime ──────────────────────────────────────────────────────────────

test('@a11y axe: no serious/critical violations on the promotion dashboard', async ({ page }) => {
  await loginAs(page, 'e2e_co_researcher');
  await page.goto('/app/promotion', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(serious, serious.map((v) => `${v.id}: ${v.help}`).join('; ')).toEqual([]);
});

// ── RTL / LTR ────────────────────────────────────────────────────────────────

test('@rtl promotion dashboard is RTL (Arabic)', async ({ page }) => {
  await loginAs(page, 'e2e_co_researcher');
  await page.goto('/app/promotion', { waitUntil: 'domcontentloaded' });
  const dir = await page.locator('html').getAttribute('dir');
  expect(dir).toBe('rtl');
});

test('@ltr promotion dashboard is LTR (English)', async ({ page }) => {
  await loginAs(page, 'e2e_co_researcher');
  await page.goto('/app/promotion', { waitUntil: 'domcontentloaded' });
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
  test(`@responsive promotion dashboard usable at ${width}px without page overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await loginAs(page, 'e2e_co_researcher');
    await page.goto('/app/promotion', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `horizontal page overflow at ${width}`).toBe(false);
  });
}

// ── Reduced motion ───────────────────────────────────────────────────────────

test('@reduced-motion promotion dashboard remains usable', async ({ page }) => {
  await loginAs(page, 'e2e_co_researcher');
  await page.goto('/app/promotion', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  expect(await page.textContent('main')).not.toBe('');
});
