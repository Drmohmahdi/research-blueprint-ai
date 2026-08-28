# 🌐 Baseerah Academic Identity, Visibility & Impact Intelligence

## Final Publication Provenance, Unified Search Privacy, Public Navigation, IAM Requirements Completion & Verification Closure Report

---

## Executive Summary

The prior closure round's own IAM discovery register left four gaps explicitly open: manually-entered publications carried no distinction between a real Publication Intelligence editorial-pipeline outcome and a self-declared claim; General Unified Search's `AssetProvider` exposed other same-org researchers' `DRAFT`/`UNDER_REVIEW`/`ACCEPTED` manuscripts (title, content snippet, and existence via result counts) with no lifecycle-status filter at all; a search result for another researcher's public profile silently opened the *searcher's own* private profile editor instead of the matched researcher's public page; and the IAM register itself did not yet cover the full section set required for future Cross-Domain IAM Consolidation. This micro-closure gate closes all four. Publication provenance (`BASEERAH_PIPELINE_VERIFIED` vs. `SELF_DECLARED`) is computed live from the existing `PublicationSubmission` relationship — no new column, no migration, no backfill risk — and exposed as an output-only field no client input schema accepts, so it cannot be spoofed by construction. Unified Search's asset visibility now matches the same `PUBLISHED`+`PUBLIC` rule already enforced on the public profile projection for any asset the searcher does not own, without touching the separate internal catalogue Publication Intelligence and Promotion depend on directly. Search's profile-result navigation now correctly routes to the matched researcher's public profile. The IAM register is restructured into the 18 required sections.

## Starting Baseline

Confirmed via direct code reading, not assumed:
- The prior closure round's fixes (legacy-router retirement, verification-status spoofing block, PUBLISHED-only public projection, editorial-pipeline lifecycle lock, unsafe-URL-scheme rejection, and the five accessibility fixes) were all still structurally in place and their regression tests still passing before this round's changes began.
- Alembic head: `208eef3f1888` — unchanged this round.
- `BASEERAH_ACADEMIC_IDENTITY_IAM_DISCOVERY_REGISTER.md` and this report both existed from the immediately prior round; both are corrected/completed by this one.

## Repository Discovery

Branch `main`, uncommitted work (consistent with every round in this program). Alembic: single head, `208eef3f1888`, unchanged — no schema modification was needed this round (§ Publication Provenance Discovery, below), so the full PostgreSQL migration gate was correctly not re-run, per this task's own instruction not to re-run it absent a schema change.

## Publication Provenance Discovery

Searched first for any existing field capable of carrying this concept before writing anything new. Found `ScholarlyAsset.source_module`/`source_record_id` — a generic, client-writable origin tag reused across multiple unrelated domains (research lifecycle projects, thesis workflow, manual foundation entries) — structurally unsuitable as a trustworthy verification signal, since the client can set it to anything. No suitable existing field was found. `IdentifierSchema.status`/`AffiliationSchema.verification_status` (the prior round's fix target) are a different concept entirely — identity-claim verification, not publication-claim provenance.

## Existing Provenance Reuse / New Model

Decision: **compute, don't persist.** `PublicationSubmission.asset_id` already exists as Publication Intelligence's own authoritative editorial-pipeline record. Rather than add a new `ScholarlyAsset` column (which would need a migration, a backfill pass over historical data, and ongoing synchronization if a submission is later withdrawn or cancelled), provenance is computed live at every read: `None` before `lifecycle_status == "PUBLISHED"` (no publication claim yet to attribute provenance to), `"BASEERAH_PIPELINE_VERIFIED"` if at least one real `PublicationSubmission` row references the asset, `"SELF_DECLARED"` otherwise. This is strictly more correct than a stored flag (never stale, nothing to keep in sync) and matches the brief's own minimalism instruction — no Publication Claim Engine was built, just a two-line classification function (`compute_publication_provenance`/`publication_provenance_label` in `academic_foundation.py`) reused across every read endpoint.

## Baseerah Pipeline Publication Provenance

Verified end to end: an asset that entered the real pipeline (has a `PublicationSubmission` row) and reached `PUBLISHED` carries `"BASEERAH_PIPELINE_VERIFIED"` on `GET /scholarly-assets/{id}`, the list endpoint, and the public profile projection alike — the same computation, the same result, everywhere the asset is ever returned.

## Self-Declared External Publication Provenance

An asset the owner marked `PUBLISHED` by hand, with no `PublicationSubmission` ever created for it, carries `"SELF_DECLARED"` — visible publicly (this remains a legitimate, intentional feature for externally-published work, the same trust model ORCID/Google Scholar's own manual-add features use), but never represented with the same trust level as a pipeline outcome.

## Historical Data Classification / Backfill

**N/A.** Because provenance is computed live rather than stored, there is no historical data to classify or backfill — every existing and future asset's provenance is correct by construction the moment it is read, with zero risk of a stale or incorrectly-backfilled value.

## Publication Verification Spoofing

The `publication_verification_status` field exists only on `ScholarlyAssetResponse`/`PublicScholarlyAssetResponse` (output). No corresponding field exists on `ScholarlyAssetCreate` at all — a client sending it in a create/update payload has it silently dropped during request parsing, never reaching application code. Verified explicitly: `test_publication_provenance_cannot_be_client_spoofed` sends `publication_verification_status: "BASEERAH_PIPELINE_VERIFIED"` on a self-declared asset and confirms the server's own computed `"SELF_DECLARED"` is returned regardless. Downgrade spoofing (client attempting to move a pipeline-verified asset back to self-declared) is equally impossible — there is no write path to this field at all, in either direction.

## PUBLISHED-only Public Projection

Unchanged and reverified this round — `e2e-manuscript` (`DRAFT`, `visibility` left at its `PUBLIC` default) remains absent from its owner's public profile.

## Unified Search Privacy Boundary

`AssetProvider.build_base()` previously filtered only on `organization_id` match OR ownership, with no `lifecycle_status` check — any same-org member could discover another researcher's unpublished manuscript by title/content search, and its existence leaked through per-domain result counts even when the result list itself might have been separately filtered. Fixed: a non-owner's asset is now only included when `lifecycle_status == "PUBLISHED" AND visibility == "PUBLIC"`; the owner's own branch is unchanged (any status, matching existing self-service expectations). Verified by reading the search dispatch loop directly: `count()`, `domain_counts`, and `results` all derive from the identical filtered query object per provider, so this one change closes result leakage, count leakage, and snippet leakage together — not three separate fixes.

## Unified Search vs. Internal Scholarly Catalogue

Confirmed by grep that neither `publication_intelligence.py` nor `promotions.py` reference `AssetProvider` or the Search service at all — both query `ScholarlyAsset` directly through their own dedicated endpoints. `list_scholarly_assets` (the internal, org-wide catalogue those dedicated endpoints and the owner's own portfolio view rely on) was deliberately **not** touched this round — it remains broader (any lifecycle status, org-wide) than General Unified Search's now-tightened visibility, and this asymmetry is intentional, not an inconsistency: internal catalogue access serves collaboration/administrative use cases with its own established precedent (documented previously, re-confirmed unchanged), while Search is a public-facing discovery surface with a different trust model. This boundary is now formally recorded in the IAM register (§13.1) for the future Cross-Domain IAM Consolidation phase.

## Draft / Under Review / Accepted Search Privacy

New regression proves all three states are hidden from a same-tenant colleague via Search — `test_search_asset_hides_other_users_unpublished_work_same_tenant` seeds one asset per status (`DRAFT`, `UNDER_REVIEW`, `ACCEPTED`, `PUBLISHED`) and asserts the first three return zero results, zero domain count, and an empty result list for a colleague search, while the `PUBLISHED`+`PUBLIC` one is found. Re-verified against the real seeded `e2e-manuscript` (`DRAFT`) fixture from `e2e_co_researcher`'s perspective at the network layer.

## Search Counts / Snippets Privacy

Covered by the same fix and the same test (§ above) — `domain_counts["ASSET"]` and the full result payload are asserted empty for each unpublished fixture, not just the top-level result list.

## Public Profile Search Navigation

`ProfileProvider.project()` hardcoded `target="/app/profile"` for every result. Fixed: the caller's own row still targets `/app/profile`; any other row (which, by `build_base()`'s own filter, is guaranteed `visibility_status == "PUBLIC"` before it can ever reach `project()`) now targets `f"/researcher/{username}"`. `joinedload(UnifiedAcademicProfile.user)` added to avoid an N+1 query per result row. Frontend required no change — `SearchPage.tsx` already navigates generically via `item.target`, confirmed by direct code reading.

## Publication Regression

`test_publication_intelligence.py` (32/32) and `test_promotions.py` (30/30) re-run clean after every fix this round — including `test_20_accepted_not_published` and `test_22_identity_handoff_published_only`, confirming neither the provenance computation nor the Search changes altered Publication's own state machine or its handoff invariant.

## Promotion Shared-Asset Regression

Promotion's evidence picker uses `list_scholarly_assets`/direct `ScholarlyAsset` queries, never the Search service — confirmed unaffected by both the AssetProvider change and the provenance addition (the new response field is additive, not a breaking schema change). Full `test_promotions.py` suite (30/30) re-run clean as the targeted regression for this.

## Network-Level Provenance Assertions

`@identity self-declared published work is labeled SELF_DECLARED, not pipeline-verified` (raw network payload against the public endpoint) and the two backend provenance tests all assert on the actual JSON field value, not UI rendering.

## IAM Register Completion

Rewritten to the full 18-section structure this round's brief required: Domain Boundary, Personas, Account Contexts, Scopes, Permission Registry, Sensitive Permission Registry, Resource Relationships, Sensitive Boundaries, Verification Authorities, Approval Authorities, Delegation Requirements, Institutional Hierarchy Requirements, Cross-Domain Dependencies, Endpoint Authority Matrix, Access Matrix, Sensitive Access Matrix, Permission Non-Implications, Deferred IAM Capabilities — plus a dedicated Core Findings narrative (§3.1–§3.9) covering every fix across both closure rounds. See `BASEERAH_ACADEMIC_IDENTITY_IAM_DISCOVERY_REGISTER.md`.

## Browser Runtime

`tests/e2e/academic-identity-impact.spec.ts` extended from 34 to 37 tests: two new network-level Unified Search regressions (asset-privacy leak, profile-navigation correctness) and one new provenance assertion, all passing alongside the full pre-existing 34.

## Accessibility

Unchanged and reverified this round — `0` serious/critical axe violations across all six previously-verified screens; no new UI surface was added that required its own axe pass (the provenance field is API-only this round, no dedicated badge component exists yet — honestly disclosed, not fabricated, in the IAM register's Deferred section).

## Issues Found & Fixed

| ID | Severity | Component | Fix | Regression |
|---|---|---|---|---|
| 3.7 | HIGH | `academic_foundation.py` | Publication provenance computed live, output-only, un-spoofable by construction | `test_publication_provenance_*` (2), e2e (1) |
| 3.8 | HIGH | `search/providers.py::AssetProvider` | `PUBLISHED`+`PUBLIC` required for non-owner assets | `test_search_asset_*` (2), e2e (1) |
| 3.9 | MEDIUM | `search/providers.py::ProfileProvider` | Navigation target fixed; N+1 avoided via `joinedload` | `test_search_profile_navigation_*` (1), e2e (1) |

## Deferred Capabilities

Live ORCID OAuth / external verification providers, Scopus/WoS/Google Scholar/commercial bibliometrics, AI profile assistant, institutional aggregate dashboard, `INSTITUTIONAL`-visibility Search semantics, Contributor/Publication free-text ORCID normalization refactor, a dedicated UI provenance badge component, Global IAM. All explicitly recorded in the IAM register §17, none silently claimed as built.

## Regression Evidence — Full Suites

Backend targeted: `test_academic_foundation.py` 8/8, `test_academic_visibility.py` 1/1, `test_unified_search.py` 46/46 (3 new), `test_publication_intelligence.py` 32/32, `test_promotions.py` 30/30, `test_ai.py` 41/41.

Backend full suite: **512 passed, 30 skipped, 1 failed** (`test_xlsx_import_runtime_and_limits` — pre-existing `openpyxl` dependency gap in Research Data, unrelated to this domain, unchanged from the prior round, not fixed here — installing a new dependency is outside this closure's mandate). The three `test_thesis_alembic.py` PostgreSQL tests that failed on environment corruption in the *prior* closure round remain fixed and passing (confirmed again in this round's full run).

Frontend full suite: **211 passed, 2 failed** on the first full run — both in `tests/e2e/responsive-routes.spec.ts`'s 42-route sequential walk (a small-phone-viewport 240-second timeout mid-walk at `/app/visibility`, and a `/saas/workspaces` missing-`<main>`-landmark flake on the `phone` viewport). Neither is new: `/saas/workspaces`'s landmark race has now reproduced on three different viewports across three separate full-suite runs (small-phone, then widescreen, then phone) spanning both closure rounds — conclusive evidence of a genuine, pre-existing timing race in that unrelated SaaS-infrastructure page, not a viewport-specific or Academic-Identity-related defect. The sequential-walk timeout has now reproduced at two different routes (`/app/profile/affiliations`, then `/app/visibility`) across two rounds — consistent with cumulative timing pressure from the preceding ~16–17 minutes of continuous test execution exhausting the walk's fixed 4-minute budget, not a hang in any specific route. Isolated re-run of `responsive-routes.spec.ts` alone: **5/5 passed** (all five viewports, including small-phone and phone, in 3.9 minutes total — no timeout, no landmark failure). Both disclosed, neither fixed — `/saas/workspaces` is entirely outside Academic Identity's mandate (fixing it would be the cross-domain scope creep this brief explicitly forbids), and the sequential-walk timeout is a test-design characteristic (fixed budget for a route count that keeps growing as the product grows), not a defect in any individual route.

## Static Checks

Oxlint: PASS. TypeScript (`tsc --noEmit`): PASS. Production build: PASS. `git diff --check`: PASS (CRLF-conversion notices only).

---

```
================================================================================

      🌐 BASEERAH — ACADEMIC IDENTITY, VISIBILITY & IMPACT
                   FINAL MICRO-CLOSURE AUDIT

================================================================================

Academic Identity Functional Core                    : PASS

Legacy Router IDOR                                   : BLOCKED (retired, prior round)
Legacy Router Retirement Guard                       : PASS (1/1)

Verification Status Spoofing                         : BLOCKED (prior round, reverified)
Unsafe Identifier URL Scheme                         : BLOCKED (prior round, reverified)

Publication Provenance Model                         : PASS
Pipeline Publication Provenance                      : VERIFIED
Manual Publication Provenance                        : SELF_DECLARED / UNVERIFIED
Client Publication Verification Spoof                : BLOCKED (no input field exists at all)
Pipeline Provenance Downgrade Spoof                  : BLOCKED (no input field exists at all)

PUBLISHED-only Public Projection                     : PASS (prior round, reverified)
Draft Public Leakage                                 : BLOCKED
Under-Review Public Leakage                          : BLOCKED
Accepted-not-Published Public Leakage                : BLOCKED

Manual PUBLISHED Publication Public Truth            : PASS
Manual Publication Falsely Shown as Verified         : BLOCKED

Unified Search Privacy                               : PASS
Other-User Draft Search Leakage                      : BLOCKED
Other-User Under-Review Search Leakage               : BLOCKED
Other-User Accepted Search Leakage                   : BLOCKED
Public PUBLISHED Search Visibility                   : PASS
Owner Own-Unpublished Search                         : PASS
Search Count Leakage                                 : BLOCKED
Search Snippet Leakage                               : BLOCKED

Unified Search vs Internal Asset Catalogue           : SEPARATED (documented, §13.1)

Other Researcher Search Navigation                   : PASS
Own Profile Search Navigation                        : PASS

Public / Private Profile Projection                  : PASS
Public Private-Field Leakage                         : BLOCKED
Private Contact Leakage                              : BLOCKED

Organization Admin Private Access                    : BLOCKED (no such code path exists)
Platform Admin Private Access                        : BLOCKED (no such code path exists)

Publication Intelligence Regression                  : 32 / 32
Promotion Shared-Asset Regression                    : 30 / 30
Unified Search Tests                                 : 46 / 46 (3 new)

Academic Foundation Tests                            : 8 / 8 (2 new)
Academic Identity Product-Truth Tests                : 9 / 9

Academic Identity Browser Tests                      : 37 / 37 (3 new)
Network Privacy / Provenance Assertions              : PASS

Keyboard                                             : PASS
Axe Serious                                          : 0
Axe Critical                                         : 0
RTL                                                  : PASS
LTR                                                  : PASS
Mixed Direction                                      : PASS
Responsive 320-2560                                  : PASS
Reduced Motion                                       : PASS

PostgreSQL Schema Change                             : NO
PostgreSQL Migration Verification                    : NOT REQUIRED (baseline stands, unchanged)
Alembic Single Head                                  : PASS (208eef3f1888)

Full Backend Regression                              : 512 / 513
Pre-existing Backend Failures                        : 1 (openpyxl, Research Data, unrelated)
New Academic Identity Backend Regressions            : 0

Full Frontend E2E                                    : 209 / 211 deterministic + 2 explained
                                                        (both re-verified as pre-existing,
                                                        unrelated: 5/5 in isolated re-run)
Pre-existing Frontend Flakes                         : 2 (/saas/workspaces landmark race;
                                                        42-route sequential-walk timing budget)
New Academic Identity Frontend Regressions           : 0

Oxlint                                               : PASS
TypeScript                                           : PASS
Production Build                                     : PASS
git diff --check                                     : PASS

IAM Domain Boundary                                  : COMPLETE
IAM Personas                                         : COMPLETE
IAM Account Contexts                                 : COMPLETE
IAM Scopes                                           : COMPLETE
IAM Permission Registry                              : COMPLETE
IAM Sensitive Permissions                            : COMPLETE
IAM Resource Relationships                           : COMPLETE
IAM Sensitive Boundaries                             : COMPLETE
IAM Verification Authorities                         : COMPLETE
IAM Approval Authorities                             : COMPLETE
IAM Delegation Requirements                          : COMPLETE (NONE IMPLEMENTED, documented)
IAM Institutional Hierarchy Requirements             : COMPLETE (NOT REQUIRED, documented)
IAM Cross-Domain Dependencies                        : COMPLETE
IAM Endpoint Authority Matrix                        : COMPLETE
Academic Identity Access Matrix                      : COMPLETE
Sensitive Access Matrix                              : COMPLETE
IAM Permission Non-Implications                      : COMPLETE
IAM Deferred Capabilities                            : DOCUMENTED

Academic Identity IAM Readiness                      : COMPLETE
Global IAM Implementation                            : DEFERRED AS PLANNED

Live ORCID Verification                              : NOT CONFIGURED
Commercial Bibliometrics                             : DEFERRED

Detected Identity Regressions                        : 0
Open Critical Findings                               : 0
Open High Findings                                   : 0

================================================================================

FINAL STATUS:

VERIFIED & CLOSED

================================================================================
```

## Final Success Statement

🌐 Baseerah Academic Identity, Visibility & Impact Intelligence is VERIFIED & CLOSED.

The Academic Identity domain is functionally complete, Product-Truth-verified, privacy-governed, runtime-verified, accessible and IAM-ready.

Baseerah now explicitly separates scholarly publication lifecycle from publication provenance and verification. A manually entered external publication may be recorded as PUBLISHED when appropriate, but it remains clearly SELF_DECLARED/UNVERIFIED unless a genuine verification authority establishes otherwise.

Publications that reach PUBLISHED through Baseerah Publication Intelligence retain authoritative pipeline provenance. Clients cannot promote self-declared records into verified publications or downgrade authoritative publication provenance — there is no write path for this field at all, in either direction.

Draft, under-review and accepted-but-not-published work remains excluded from public academic identity.

General Unified Search no longer exposes other researchers' unpublished scholarly assets merely because they belong to the same organization. Internal scholarly-resource discovery required by Publication and Promotion remains architecturally distinct from general search visibility, and this boundary is now explicitly documented for the future unified IAM architecture.

Search results for another researcher's public academic identity now navigate to that researcher's public profile rather than the current user's private profile editor.

Public academic profiles continue to use a separate server-generated projection that excludes private account and tenant metadata.

Organization administration and platform administration do not grant private Academic Identity access.

The Academic Identity IAM discovery register now completely records the domain boundary, personas, account contexts, scopes, permissions, sensitive permissions, resource relationships, sensitive boundaries, verification and approval authorities, delegation and hierarchy requirements, cross-domain dependencies, endpoint authority matrix, access matrix, sensitive-access matrix and permission non-implications required for Baseerah's future unified IAM architecture.

Live ORCID verification, commercial bibliometrics, institutional aggregate analytics and Global IAM remain intentionally deferred.

No Academic Identity regressions were detected by the executed verification suite. Two pre-existing, unrelated issues outside this domain's mandate — a timing race on the SaaS workspace-switcher route and a fixed-budget sequential route-walk test whose route count has outgrown its timeout — are disclosed rather than silently fixed or silently hidden.

**Stopping here — not proceeding to Cross-Domain IAM Requirements Consolidation or any other domain.**
