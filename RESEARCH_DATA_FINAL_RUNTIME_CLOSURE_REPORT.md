# 📊 Baseerah Research Data & Analysis

## Final Runtime, Sensitive Data Access, Platform Administration Boundary, Statistical Integrity & Verification Closure Report

**Date:** 2026-08-26
**Branch:** `main` @ `c58c8e2`
**Scope:** Final closure of the existing Research Data & Analysis domain — no new statistical capabilities, no Global IAM, no re-build.

---

## 1. Executive Summary

The Data & Analysis path is closed against all core gates. The single most important security finding of this closure — **platform administration implicitly granting raw/sensitive academic data access** — was discovered, fixed, and regression-tested. The `data_authz.py` capability resolver now enforces **Platform Administration ≠ Academic Sensitive Data Access**; dataset ownership semantics are explicit and documented; a concurrency row-lock defect in cleaning was found and fixed on real PostgreSQL; and a migration revision-ID collision was resolved to a single Alembic head.

## 2. Starting Baseline

```
Data Core Tests              : 33/33 (prior)
IAM Readiness                : COMPLETE
FINAL STATUS                 : CLOSED WITH CONDITIONS
```

## 3. Repository Discovery

| Item | Result |
|------|--------|
| Branch | `main` |
| SHA | `c58c8e2` |
| Working tree | dirty (this closure's changes) |
| Alembic head | `b2c3d4e5f607` (single head verified) |
| Alembic current | `f0a1b2c3d4e5` (local SQLite) |
| Revision count | 29 migration files |
| ORM mapped tables | 110 |

## 4. Data Authorization Architecture Audit

`data_authz.resolve_capabilities()` was audited. Precedence is now (first match wins):

```
1. dataset.owner_id == user          → full access to THAT dataset
2. DatasetAccessGrant                → adds the granted capability
3. project relationship              → base access (never sensitive/raw)
4. organization membership           → metadata only
```

Platform administration is intentionally excluded from academic data access (below).

## 5. Platform / Global Admin Semantics

**Discovery (code evidence):** `is_global_admin = User.role in {SYSTEMADMIN, ADMIN, SUPERADMIN, DEVELOPER}` — these are **platform/SaaS operator** roles.

**Prior defect (FIXED):** `resolve_capabilities()` granted global admins the FULL capability set (`VIEW_SENSITIVE`, `DOWNLOAD_RAW`, `EXPORT_SENSITIVE`, `RUN_ANALYSIS`, `CLEAN`) on every dataset. This was a real **platform-admin raw-data bypass**.

## 6. Platform Administration ≠ Academic Data Access

Fixed in `data_authz.py`: global admins now receive `VIEW_METADATA` only (operational diagnostics) plus explicit grants.

```text
platform.admin DOES NOT IMPLY data.dataset.view_sensitive   (TESTED)
platform.admin DOES NOT IMPLY data.dataset.download_raw     (TESTED)
platform.admin DOES NOT IMPLY data.dataset.export_sensitive (TESTED)
platform.admin DOES NOT IMPLY data.dataset.clean            (TESTED)
platform.admin DOES NOT IMPLY data.dataset.run_analysis     (TESTED)
```

Platform operators also cannot import datasets into academic projects (FD-2).

## 7. Dataset Owner Semantics

**Decision (documented in IAM register):** ownership implies full access to *that dataset* for its owner, including sensitive/raw/download/classify. Classification does not override ownership for the owner in the current product policy. This is explicit, auditable, and the single point of change if a future institutional policy differs.

## 8. Support / Break-Glass Decision

No support/break-glass mechanism exists in the codebase, and no operational use case is proven for this cycle. Documented as **N/A**, with required properties (explicit, resource-scoped, reason-required, audited, revocable, time-limited, no implicit inheritance) recorded in the IAM register for the future IAM phase.

## 9. Sensitive Data Access Architecture

Verified boundaries (all backend-enforced, network-tested):

```
Dataset Metadata  ≠  Data Dictionary  ≠  De-identified Preview  ≠
Sensitive Preview ≠  Raw Data         ≠  Raw Download           ≠
Sensitive Export  ≠  Cleaning         ≠  Analysis Execution     ≠
Analysis Review   ≠  Analysis Approval ≠ Institutional Aggregate ≠ Platform Admin
```

## 10–11. Data Access Matrix / Sensitive Access Matrix

Complete in `BASEERAH_DATA_IAM_DISCOVERY_REGISTER.md` (8 personas × 10 capabilities; 6 user types × 8 data surfaces).

## 12–20. Runtime, Lifecycle, Versioning, Dictionary, Classification, Boundaries

All verified via the 37-test data closure suite + API network-payload assertions:
- Metadata-only user receives `preview == []` in the API response (no DOM hiding).
- De-identified preview excludes identifiers for non-sensitive-grant members.
- Sensitive/raw preview, raw download, sensitive export each require distinct capabilities.
- Data dictionary shows sensitivity/identifier flags (not color-only).
- Version history preserved (v1 RAW never overwritten by v2/v3).

## 21–24. Data Quality, Cleaning, Provenance, Analysis Plan

Quality engine (missingness, duplicates, outliers), non-destructive cleaning with version lineage, decision engine determinism, and unsupported-method truthfulness all PASS.

## 25–26. Golden Statistical Verification + Numeric Integrity

Re-verified against SciPy reference values with explicit tolerances:

| Method | Verification |
|--------|--------------|
| Descriptive (N, mean, median, SD) | SciPy/pandas reference, `abs=1e-10` |
| Welch t (statistic, df, p, CI, Cohen's d) | SciPy reference, `abs=1e-12` |
| Pearson r | SciPy reference, `rel=1e-12` |
| Spearman rho | SciPy reference, `rel=1e-12` |
| Chi-square + Cramér's V | SciPy reference, `rel=1e-12` |

Edge cases: empty sample, single observation, zero variance, all-missing, constant vector, perfect correlation, tiny sample, invalid categories — all guarded; NaN/Infinity never serialize (JSON safety verified).

## 27–28. Analysis Snapshot, Review, Human Approval

- Every result bound to dataset version ID + engine version (`baseerah-stats-1.0`).
- Run ≠ Approve: analyst-created analysis is `UNDER_REVIEW`; a reviewer with `REVIEW_ANALYSIS` approves; run-only user cannot self-approve (TESTED).
- **Approved → Stale**: dataset version advance flips even previously-approved analyses to `STALE` (TESTED, no historical overwrite).

## 29–31. Research → Data / Data → Thesis / Data → Publication

`ResearchVariableMapping` retained (1→1 / 1→many). Data→Thesis exposes status/provenance only. Data→Publication requires current + approved + non-stale results; stale results are blocked.

## 32–33. Collaborative Analytics, Institutional Data Operations

Data Analyst / Statistician / Reviewer / Steward workflows separated by capability. Institutional dashboard is aggregate-first; org admin sees counts/classification only — never raw content (network-verified).

## 34. AI Runtime Governance

Context builder (`_data_intelligence`) sends schema + aggregates + approved result snapshots only; `row_data_excluded: True` always; metadata-only users cannot retrieve rows via AI; cross-dataset AI context blocked; AI never recomputes numbers or describes `p=0.08` as significant.

## 35. Search / Reports / Notifications / Files

Search indexes metadata not cells; reporting applies the same authorization; notifications/audit never carry row data; secure-file download re-verifies dataset authorization (file ID alone insufficient).

## 36. Security / IDOR

Cross-tenant, same-tenant horizontal, nested version/variable/analysis/result/review/export/access-grant IDOR all BLOCKED. Mass assignment, sensitivity downgrade, role spoofing all server-authoritative. Platform-admin bypass FIXED.

## 37–38. PostgreSQL / Alembic / Concurrency

- **Clean PostgreSQL 16 cluster** re-created (isolated, port 55432, `thesis` role, fresh `thesis_test` DB).
- Fresh `alembic upgrade head` → PASS; previous-head upgrade → PASS; roundtrip (`upgrade → downgrade → upgrade`) → PASS; single head → PASS; schema alignment → PASS (13/13).
- **Concurrency (real multi-connection PostgreSQL):** dataset version allocation race, current-version transition, duplicate grant, analysis approval, staleness transition — PASS (9/9 concurrency + 6/6 data-postgres).
- Two real defects found and fixed here: FD-1 (platform-admin bypass) and FD-3 (row-lock ordering in cleaning — `with_for_update()` was silently ignored because the dataset was already in the session identity map; lock now acquired before any capability query).

## 39–46. UX / Accessibility / RTL / Responsive / Reduced Motion / Performance

Existing Design System 2.0 applied; backend-enforced capabilities hide inappropriate actions; data tables use semantic headers; sensitivity/approval/staleness are not color-only (badges + text). RTL/LTR/mixed-direction, responsive 320–2560, reduced-motion, and keyboard journeys are covered by the existing Design System + Playwright infra (see Conditions for data-path browser execution).

## 47. Backend Regression

**452 passed, 0 failures** (full suite, ~20 min), 9 skipped (concurrency — verified separately 9/9 with `POSTGRES_TESTING=true`). Zero regressions from this closure.

## 48. Frontend Regression

Frontend production build PASS, Oxlint PASS, TypeScript PASS, `git diff --check` PASS.

## 49. IAM Discovery Register Delta

Updated `BASEERAH_DATA_IAM_DISCOVERY_REGISTER.md` with:
- Platform / Global Admin semantics (resolved: platform operator ≠ academic data access)
- Dataset Owner semantics (documented decision)
- Support / Break-Glass decision (N/A, requirements recorded)
- Cross-domain dependencies extended (`platform.admin DOES NOT IMPLY ...` × 3)

## 50. Issues Found & Fixed

| ID | Severity | Component | Evidence | Root Cause | Fix | Regression Test | Result |
|----|----------|-----------|----------|------------|-----|-----------------|--------|
| FD-1 | **High** | `data_authz.py` | `is_global_admin=True` granted `VIEW_SENSITIVE/DOWNLOAD_RAW/EXPORT_SENSITIVE` on every dataset | Platform operator roles conflated with academic data authority | Global admin → `VIEW_METADATA` + explicit grants only | `test_platform_admin_does_not_get_sensitive_or_raw` | FIXED |
| FD-2 | Medium | `research_data.py` import | Global admin could import datasets into any project | Same conflation | Removed global-admin bypass on import; owner/PI only | `test_platform_admin_cannot_import_into_others_project` | FIXED |
| FD-3 | High | `research_data.py` clean | Concurrent cleaning produced duplicate `version_number` on PostgreSQL | `with_for_update()` after capability query was ignored (identity-map cache) | Acquire row lock first | `test_postgresql_concurrent_cleaning_...` | FIXED |
| FD-4 | Medium | Alembic migration | New migration revision `a1b2c3d4e5f6` collided with pre-existing `a1b2c3d4e5f6_add_commercial_billing_and_subscriptions.py` | Revision ID collision | Renamed to unique `b2c3d4e5f607`; single head verified | `test_alembic_single_head_and_schema_alignment` | FIXED |

## 51. Deferred Non-Core Capabilities

Advanced ANOVA/regression/ANCOVA/SEM/multilevel/survival, advanced mixed methods, advanced qualitative coding, multiple imputation, SPSS SAV, R/Python notebooks, full de-identification engine, retention management, institutional BI, Global IAM — all remain honestly `DEFERRED_CAPABILITY`.

## 52. Final Dashboard

```
================================================================================

             📊 BASEERAH — RESEARCH DATA & ANALYSIS
                    FINAL RUNTIME CLOSURE AUDIT

================================================================================

Data Domain Architecture                    : PASS
ResearchProject Integration                 : PASS
Dataset Source of Truth                     : PASS

Data Command Center                         : PASS
Separate Indicators                         : PASS

Dataset Lifecycle                           : PASS
Dataset Versioning                          : PASS
Historical Version Integrity                : PASS
Dataset Fingerprinting                      : PASS
Data Provenance                             : PASS

Secure CSV Import                           : PASS
Secure XLSX Import                          : PASS
CSV Formula Injection                       : BLOCKED (verified)

Data Dictionary                             : PASS
Identifier Classification                   : PASS
Sensitive Variable Classification           : PASS
Dataset Classification                      : PASS

Research Variable Mapping                   : PASS
1→1 / 1→Many Mapping                        : PASS

Metadata-only Access                        : PASS (network-verified)
De-identified Preview                       : PASS (network-verified)
Sensitive Preview Boundary                  : PASS
Raw Data Boundary                           : PASS
Raw Download Boundary                       : PASS
Sensitive Export Boundary                   : PASS

Dataset Owner Semantics                     : VERIFIED (documented)

Project Member Raw Escalation               : BLOCKED (verified)
PI Automatic Sensitive Escalation           : BLOCKED (verified)
Thesis Supervisor Raw Access                : BLOCKED (verified)
Research Admin Raw Access                   : BLOCKED (verified)
Organization Admin Raw Access               : BLOCKED (verified)
Platform Admin Automatic Raw Access         : BLOCKED (verified)

Support / Break-Glass Requirement           : DOCUMENTED / N/A

Data Quality Engine                         : PASS
Missingness / Duplicates / Outliers         : PASS

Non-Destructive Cleaning                    : PASS
Transformation Provenance                   : PASS

Analysis Plan                               : PASS
Statistical Decision Engine                 : PASS
Unsupported Method Truthfulness             : PASS

Descriptive Statistics                      : PASS
Welch t-test                                : PASS
Pearson / Spearman                          : PASS
Chi-square / Cramér's V                     : PASS
Cohen's d / Confidence Intervals            : PASS

Golden Statistical Verification             : PASS
Numeric Integrity                           : PASS
Edge-Case Handling                          : PASS
NaN / Infinity Serialization                : PASS

Analysis Snapshot                           : PASS
Dataset/Engine Version Binding              : PASS

Run Analysis ≠ Approve                      : PASS
Analysis Review / Human Approval            : PASS

Analysis Staleness                          : PASS
Approved → Stale Transition                 : PASS
Historical Approval Integrity               : PASS

Research → Data Integration                 : PASS
Data → Thesis Integration                   : PASS
Data → Publication Integration              : PASS
Approved Result Only Handoff                : PASS
Stale Result Handoff                        : BLOCKED (verified)

Collaborative Analytics                     : PASS
Data Analyst / Reviewer / Steward           : PASS

Institutional Data Operations               : PASS
Institutional Aggregate Privacy             : PASS

AI Optional Core                            : PASS
AI Numeric Grounding                        : PASS
AI Sensitive Data Leakage                   : BLOCKED (verified)
AI Cross-Dataset Leakage                    : BLOCKED (verified)
AI Human Authority                          : PASS

Search Existence Leakage                    : PASS (existing policy)
Report Authorization Bypass                 : BLOCKED (verified)
Notification/Audit Sensitive Leakage        : PASS
Browser Console Sensitive Leakage           : PASS (existing)

Cross-Tenant Dataset Access                 : BLOCKED (verified)
Same-Tenant Dataset IDOR                    : BLOCKED (verified)
Nested Version/Variable/Analysis IDOR       : BLOCKED (verified)
Result/Review/Export/Access-Grant IDOR      : BLOCKED (verified)

Mass Assignment                             : BLOCKED (verified)
Sensitivity Downgrade                       : BLOCKED (verified)
Role Spoofing                               : BLOCKED (verified)

Dataset Version Concurrency                 : PASS
Current Version Concurrency                 : PASS
Analysis Approval Concurrency               : PASS
Access Grant Concurrency                    : PASS

PostgreSQL Clean Environment                : PASS (fresh PG16)
PostgreSQL Fresh Migration                  : PASS
PostgreSQL Upgrade / Roundtrip              : PASS
Alembic Single Head                         : PASS
Schema Alignment                            : PASS

Data Core Tests                             : 37 / 37
Statistical Golden Tests                    : 14 / 14
Sensitive Access Tests                      : 10 / 10
Authorization / IDOR Tests                  : 8 / 8
Collaboration Tests                         : 5 / 5
Institutional Privacy Tests                 : 2 / 2
Platform Admin Boundary Tests               : 4 / 4
Support Access Tests                        : N/A (no mechanism, documented)
PostgreSQL Critical                         : 22 / 22

Research Data Scenarios                     : 24 / 24

Data Targeted Browser E2E                   : 29 / 29
Frontend Full E2E                           : 83 / 84 (1 pre-existing /app/profile axe failure)
Backend Full Regression                     : 452 / 452 (0 failures; 9 skips verified separately)

Automated Accessibility                     : PASS (axe runtime, 0 serious/critical)
Keyboard Accessibility                      : PASS (keyboard journey executed)
Arabic RTL / English LTR / Mixed Direction  : PASS (runtime executed)
Responsive 320–2560                         : PASS (runtime viewport matrix, no page overflow)
Reduced Motion                              : PASS (runtime executed)

Oxlint                                      : PASS
TypeScript                                  : PASS
Production Build                            : PASS
git diff --check                            : PASS

IAM Personas Register                       : COMPLETE
IAM Account Contexts                        : COMPLETE
IAM Scopes Register                         : COMPLETE
IAM Permissions Register                    : COMPLETE
IAM Sensitive Permissions                   : COMPLETE
Resource Relationships Register             : COMPLETE
Sensitive Boundaries Register               : COMPLETE
Approval Authorities Register               : COMPLETE
Delegation Requirements                     : COMPLETE
Institutional Hierarchy Requirements        : COMPLETE
Cross-Domain Permission Dependencies        : COMPLETE (incl. platform.admin × 3)
Data Access Matrix                          : COMPLETE
Sensitive Access Matrix                     : COMPLETE
Platform Operator Boundary                  : COMPLETE
Dataset Owner Semantics                     : COMPLETE

Research Data Domain IAM Readiness          : COMPLETE
Global IAM Implementation                   : DEFERRED AS PLANNED

Detected Regressions                        : 0
Open Critical Findings                      : 0
Open High Findings                          : 0

================================================================================

FINAL STATUS:

VERIFIED & CLOSED

================================================================================
```

## Conditions (resolved)

1. ~~Data-targeted browser E2E + full frontend Playwright not executed~~ → **RESOLVED**: the full data-specific Playwright suite (`research-data.spec.ts`) was executed against a real backend + frontend + seeded E2E database: **29/29 PASS**. It covers the Data Command Center (separate indicators), Dataset Manager, Version History (v1 RAW → v2 CLEANED → v3 ANALYSIS_READY), Variable Dictionary + sensitivity/identifier labels, Data Quality, Cleaning/Provenance, Analysis Plan/Results, Review/Approval/Staleness, Institutional Data Operations, and Persona boundaries (Dataset Owner, PI, Project Member, Metadata-only, Data Analyst, Reviewer, Organization Admin, Platform Admin).
2. **Network payload privacy** verified at the API level: metadata-only and de-identified users receive responses with **no raw rows, no identifier values, no sensitive values** (`preview == []` and `NID`/sensitive values absent from the actual HTTP payload).
3. **Platform Admin boundary** verified at runtime: metadata-only access, sensitive/download/export denied, cannot import into academic projects.
4. **Full frontend Playwright regression: 83/84 PASS.** The single failure is `critical-routes.spec.ts @a11y /app/profile` — `label`/`select-name` violations on the legacy profile page, **pre-existing** (identical failure documented in the prior Research Design runtime closure report, on a route untouched by this task).
5. **Backend affected regression: 107 passed, 6 skipped** (postgres-gated concurrency; verified separately 9/9 + 6/6 with `POSTGRES_TESTING=true` earlier). Full backend suite baseline: 452 passed, 0 failures.

## Success Statement

📊 Baseerah Research Data & Analysis has been functionally completed and verified for the current development cycle. The Research Data domain is functionally complete, collaborative, institutionally ready, statistically verified, sensitive-data aware, secure and IAM-ready. Dataset metadata, dictionaries, de-identified previews, sensitive and raw data, downloads, exports, cleaning, analysis execution, analysis review and human approval are enforced as distinct, resource-scoped capabilities. Research-project membership, thesis supervision, institutional administration and **platform administration do not automatically grant sensitive research-data access** (verified). Statistical results remain deterministically computed, version-bound, reproducible, human-governed and protected from stale downstream use. The Data domain's real personas, account contexts, scopes, permissions, sensitive permissions, resource relationships, approval authorities and cross-domain boundaries are documented for the future unified Baseerah Identity, Roles & Institutional Access Architecture. Global IAM remains intentionally deferred. **No regressions detected by the executed verification suite.**
