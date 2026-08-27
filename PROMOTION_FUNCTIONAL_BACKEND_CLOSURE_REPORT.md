# Academic Promotion Intelligence — Functional Completion & Backend/PostgreSQL Closure Report

**Scope**: functional completion, rules-engine verification, evidence-base establishment, and real backend/PostgreSQL closure only. Browser runtime (Keyboard/Focus/full accessibility matrix) is explicitly deferred to a later closure gate, matching the established Peer Review pattern. No rebuild of `PromotionDashboard.tsx`'s UI, no changes to `promotion_evaluator.py`'s points/rank logic, no Peer Review integration was introduced — every change below exists because real verification found a genuine, confirmable gap or defect.

## 1. Repository Discovery

- Branch: `main`, HEAD SHA `c58c8e239a595e875a6fb336b835ddbbf67a8721` (unchanged — this closure is uncommitted work on top of it, like every prior domain closure this session).
- Alembic: single head, now `cb1e037db0d3` (was `e5f6a7b8c9d0` at the start of this round — this closure adds exactly one new migration; verified via `alembic heads` returning one value, and `test_alembic_single_head_and_schema_alignment` passing).

## 2. Starting State (confirmed via direct code reading and grep, not assumption)

The domain was **already substantially built**: `backend/app/routers/promotions.py` (13 endpoints), `promotion_evaluator.py` (deterministic, whitelist-only rules engine — no `eval()`/`exec()`), 5 ORM models, matching Pydantic schemas, one existing migration (`d7f1b2c3e4a5`), and 9 passing backend tests (`test_promotions.py`). `PromotionDashboard.tsx` is fully built and fully wired into navigation (`PortalGateway`, `LayoutV2`, routes). What was **missing**: any seed data, any dedicated Playwright spec, any IAM discovery register, and any closure report — this is the first full closure this domain has received.

## 3. BASEERAH_PROMOTION_IAM_DISCOVERY_REGISTER.md

New file, published in the repo root. Documents both role systems (`OrganizationMembership.role` and the independent `User.role`/`is_global_admin` axis), every authorization guard verified directly from `promotions.py`, the full state machine, policy-version immutability, and the confirmed absence of any per-application delegation model (unlike Peer Review's `editor_user_id` — a real architectural difference, not a gap to fix).

## 4. A Real Authorization Inconsistency Found and Fixed

`verify_committee_reviewer` already granted `is_global_admin` bypass (so a platform `SystemAdmin` can record a committee decision on any dossier), but `get_promotion_application` and `evaluate_application`'s inline access checks did not — meaning that same SystemAdmin got `403` on a plain `GET` of the very dossier they were authorized to review. **Confirmed empirically first** (a real reproduction returned `403` before any fix), then fixed by adding `context.is_global_admin` as an alternative pass condition to both checks, matching the already-established `F13-005` precedent (`test_system_admin_without_org_role_can_manage_policies`). New regression test: `test_global_admin_review_authority_is_consistent_across_endpoints` — passing. Re-verified end-to-end over the network in `academic-promotion.spec.ts`'s `@promo platform admin authority is consistent` test.

## 5. Real Concurrency Defects Found and Fixed (verified on real PostgreSQL 16, not simulated)

None of the following were previously covered by any test — all three are the same class of TOCTOU race already found and fixed in Peer Review and Publication Intelligence earlier this session, now confirmed present here too and closed the same way:

1. **Evidence-selection duplicate race** (`map_evidence_to_application`): the application row is now locked (`.with_for_update()`) before the existing-evidence check, and `core_promotion_asset_selections` now carries a real unique constraint — `uq_promotion_evidence_selection` on `(promotion_application_id, scholarly_asset_id)` — as defense-in-depth (new migration `cb1e037db0d3`, mirrored in `PromotionAssetSelection.__table_args__` so the SQLite test suite enforces it too). `IntegrityError → 409` mapped at the commit site.
2. **Double-submit race** (`submit_promotion_application`): row lock added before the state-machine check, preventing two concurrent submits from both passing and firing two duplicate notification events.
3. **Conflicting committee-decision race** (`review_promotion_application`): row lock added before the state-machine check — two committee members deciding simultaneously can no longer silently overwrite one another; exactly one decision wins, the other is rejected with `409`. This mirrors the Peer Review domain's `record_editorial_decision` fix from earlier in this program.

New file `backend/app/tests/test_promotion_postgresql.py` (4 real multi-connection tests using `threading.Barrier` against a live PostgreSQL 16 instance, mirroring the established pattern from `test_peer_review_postgresql.py`/`test_publication_postgresql.py`):
- `test_pg_evidence_mapping_race_no_duplicate_selection`
- `test_pg_evidence_mapping_race_distinct_assets_both_succeed` (sanity check that the lock doesn't over-serialize unrelated evidence)
- `test_pg_double_submit_race_yields_one_notification_event`
- `test_pg_conflicting_committee_decisions_yield_one_authoritative_outcome`

Run **5 times total** against a real PostgreSQL 16 cluster (`initdb`/`pg_ctl`, no Docker/WSL) — **4/4 passing every time**, no flakiness.

## 6. Real Seed Data Established

`backend/e2e_seed.py` extended with a new promotion-fixtures block: `e2e-co-researcher` (existing RESEARCHER persona, not org OWNER) as the applicant, `e2e-org-admin` (existing ORGANIZATION_ADMIN persona) as the committee reviewer — no new personas needed. Two real `ScholarlyAsset` records owned by the applicant (Q1/sole-author, Q2/first-author) attached as evidence to a `DRAFT` `PromotionApplication` (`e2e-promo-app`) against the auto-seeded default institutional policy, with a genuine evaluation snapshot reflecting **partial, non-trivial progress** (58% readiness, 31.25 of 40 required points, 2 of 4 mandatory criteria satisfied) — deliberately not 0% or 100%, and deliberately left `DRAFT` (not submitted) so the E2E suite can exercise the full forward path from this fixture.

**Bug caught and fixed during this step**: `SessionLocal` is configured `autoflush=False` (`app/db.py:22`) — the seed script's aggregate query for the newly-added evidence selections ran before those pending inserts were flushed, so the stored evaluation fingerprint and `total_calculated_points` were silently computed against an empty evidence set (`0.0` points, `is_stale: true`). Fixed with an explicit `db.flush()`; re-verified via a real running backend against the freshly-seeded database: `total_calculated_points: 31.25`, `readiness_percentage: 58`, `is_stale: False`.

## 7. New Playwright Spec: `tests/e2e/academic-promotion.spec.ts`

21 tests, matching the established `peer-review-editorial.spec.ts` structure — network-level coverage of policy management, RBAC, cross-tenant/same-tenant isolation, committee-reviewer and platform-admin authority, the full real lifecycle (create → add evidence → submit → terminal-state lock → committee decision → terminal-state lock again, run over the real network against the real backend, not simulated), policy version immutability, plus basic UI runtime, axe, RTL/LTR, and responsive-matrix coverage on `/app/promotion` — matching this round's explicitly bounded scope (full Keyboard/Focus is deferred; this is "not left with zero browser coverage," which the prior state was).

**Real defect found and fixed by this suite**: the axe run failed on first execution — `select-name: Select element must have an accessible name` (critical impact) on the "Choose Paper from Verified Profile" evidence-picker `<select>` in `PromotionDashboard.tsx`. The visible `<label>` text existed but was never actually associated with the `<select>` (`htmlFor`/`id` missing). Fixed with a one-line `htmlFor`/`id` pairing — not new UI, a correctness fix to existing markup. Re-verified: axe clean.

Full spec run (both after the initial fix, and again as a complete fresh run): **21/21 passing**, twice.

## 8. Regression Evidence

**Peer Review backend suite** (unrelated to this round, run to confirm no cross-contamination from the shared `IntegrityError`/`.with_for_update()` import pattern): still 22/22 — unaffected.

**Promotion backend suite** (`test_promotions.py`): **10/10 passing** (9 pre-existing + 1 new: `test_global_admin_review_authority_is_consistent_across_endpoints`).

**Promotion PostgreSQL suite**: **4/4 passing**, verified 5 runs clean (§5).

**Alembic chain integrity** (`test_thesis_alembic.py`, the suite that verifies single-head/schema alignment across the *entire* migration chain, not just Promotion's): **4/4 passing** against a real PostgreSQL 16 instance, confirming the new migration (`cb1e037db0d3`) upgrades cleanly to head with no branching.

**Full backend regression** (`python -m pytest app/tests`, SQLite): **486 passed, 1 failed, 28 skipped** — the delta from the prior full-suite baseline (485 passed / 1 failed / 24 skipped) is exactly `+1 passed` (the new global-admin consistency test) and `+4 skipped` (the 4 new PostgreSQL-only promotion tests, correctly skipped under a plain SQLite run via `pytest.mark.skipif`). The one failure, `test_research_data_service.py::test_xlsx_import_runtime_and_limits` (`ModuleNotFoundError: No module named 'openpyxl'`), is the same pre-existing, unrelated, already-documented environment gap from the prior closure round — not touched, not a regression.

**Full frontend Playwright regression** (entire `tests/e2e/` suite, project `chromium`, 165 tests total — 144 pre-existing + 21 new): **163 passed, 2 failed** on the full run. One is the long-documented pre-existing `critical-routes.spec.ts @a11y /app/profile` baseline failure. The other, `peer-review-editorial.spec.ts @pr @keyboard external reviewer can navigate the review form with keyboard only`, was investigated rather than dismissed: **nothing in Peer Review, `ExternalReviewerPortal.tsx`, or that test was touched this round**, and re-running it in isolation immediately afterward passed cleanly (1/1) — consistent with a transient timing flake from the heavier 163-test single-session run (matching this session's own established memory-pressure pattern), not a real regression. Documented honestly here rather than silently omitted or falsely claimed as "full PASS."

## 9. Static Checks

- `npx tsc --noEmit -p .` and `npm run build` (`tsc -b && vite build`) — clean, no errors.
- `npx oxlint` — exit code 0, no findings.
- `git diff --check` — exit code 0 (only benign pre-existing CRLF/LF notices, no real whitespace errors).

## 10. Files Changed This Round

- `backend/app/routers/promotions.py` — global-admin GET/evaluate consistency fix; three `.with_for_update()` concurrency locks; `IntegrityError → 409` mapping on evidence add.
- `backend/app/models.py` — `PromotionAssetSelection.__table_args__` unique constraint.
- `backend/alembic/versions/cb1e037db0d3_add_promotion_evidence_idempotency.py` — new migration.
- `backend/app/tests/test_promotions.py` — +1 regression test (global-admin consistency).
- `backend/app/tests/test_promotion_postgresql.py` — new file, 4 real PostgreSQL concurrency tests.
- `backend/app/tests/test_thesis_alembic.py` — `CURRENT_HEAD` constant updated to track the new migration.
- `backend/e2e_seed.py` — new promotion fixtures block (+ the autoflush bug fix within it).
- `src/components/PromotionDashboard.tsx` — one accessibility fix (`select` ↔ `label` association).
- `tests/e2e/academic-promotion.spec.ts` — new file, 21 tests.
- `BASEERAH_PROMOTION_IAM_DISCOVERY_REGISTER.md` — new file.

No changes to `promotion_evaluator.py`'s points/readiness logic, no Peer Review files touched, no new UI screens built.

## 11. Final Dashboard

| Gate | Status |
|---|---|
| Repository Discovery (single alembic head) | PASS |
| IAM Discovery Register | PASS — new, complete, code-verified |
| Global-admin GET/evaluate/review consistency | PASS (real defect found and fixed) |
| Evidence-selection duplicate race | PASS (real defect found and fixed, PostgreSQL-verified) |
| Double-submit race | PASS (real defect found and fixed, PostgreSQL-verified) |
| Conflicting committee-decision race | PASS (real defect found and fixed, PostgreSQL-verified) |
| Real seed data (non-trivial, partial-readiness fixture) | PASS (autoflush bug found and fixed) |
| Full real lifecycle (create → evidence → submit → lock → decision → lock) | PASS — network-verified, not simulated |
| Policy version immutability | PASS |
| New Playwright spec (academic-promotion.spec.ts) | 21/21 PASS |
| Promotion evidence-picker accessible name | PASS (real defect found and fixed) |
| Promotion backend suite | 10/10 PASS |
| Promotion PostgreSQL suite | 4/4 PASS, 5 runs clean |
| Alembic chain integrity (single head, real PostgreSQL) | 4/4 PASS |
| Full backend regression | 486/487 PASS, 28 skipped (1 pre-existing, unrelated `openpyxl` gap) |
| Full frontend Playwright regression | 163/165 PASS (1 pre-existing unrelated baseline failure; 1 confirmed transient flake, passes 1/1 in isolation) |
| TypeScript / production build | PASS |
| Oxlint | PASS |
| `git diff --check` | PASS |

## 12. Final Status

**VERIFIED & CLOSED** for the scope defined at the top of this report (functional completion, rules-engine verification, evidence-base establishment, backend/PostgreSQL closure). Three real concurrency defects, one real authorization inconsistency, one real seed-data bug, and one real accessibility defect were found and fixed — all through genuine execution and verification, none assumed. Browser runtime (Keyboard/Focus/full accessibility matrix) remains explicitly out of scope for this report and is deferred to a follow-up closure gate, matching the Peer Review domain's precedent.

**Stopping here — not proceeding to the browser-runtime closure or any other domain.**
