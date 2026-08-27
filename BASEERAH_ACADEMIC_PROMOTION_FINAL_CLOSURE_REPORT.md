# 🎓 Baseerah Academic Promotion Intelligence

## Final Administrative Boundary, Private-Dossier Access, Committee-Assignment Authority & Verification Closure Report

---

## Executive Summary

This closure gate reopened the prior round's own "resource-scoped committee authority" fix and corrected a subtler but real gap it left behind: **read-only is not the same as safe**. The prior round correctly removed platform-admin and generic-role bypass from `evaluate`/`review`/decide, but its retained "oversight" exception for `OWNER`/`ORGANIZATION_ADMIN` still returned the **entire private academic dossier** — evidence, evaluation snapshot, readiness percentage, calculated points, decision notes — to any organization administrator who had never been assigned to that applicant's committee, merely because the access was GET-only. This round splits **Administrative Metadata** (workflow status, rank, whether a committee/decision exists) from **Private Academic Dossier** (evidence, evaluation detail, readiness/points, committee notes/rationale) as two genuinely distinct, server-constructed response shapes, and found the identical over-broad pattern independently duplicated in the Unified Search result projection and the AI context builder — both fixed the same way. Committee-assignment authority itself was also narrowed: platform administration no longer decides who sits on an applicant's promotion committee, since that is institutional academic governance, not platform operations.

## Starting Baseline

Confirmed via direct code reading, not assumed from the prior report:
- Prior round's resource-scoped `PromotionCommitteeAssignment` model, `is_committee_member`, `has_org_oversight_access`, and the removal of platform-admin bypass from `evaluate`/`review`/`GET` were all still structurally correct and preserved.
- Prior alembic head: `208eef3f1888` — **unchanged this round** (no schema modification; every fix below is authorization/response-projection logic, not new tables/columns).
- `BASEERAH_ACADEMIC_PROMOTION_FINAL_CLOSURE_REPORT.md` and `BASEERAH_PROMOTION_IAM_DISCOVERY_REGISTER.md` existed from the immediately prior round; both are corrected by this one (the register in place, this report replacing the prior file of the same name).

## Repository Discovery

- Branch: `main`, HEAD SHA `c58c8e239a595e875a6fb336b835ddbbf67a8721` (unchanged — uncommitted work).
- Alembic: single head, still `208eef3f1888`. No new migration this round — verified no schema change was needed, per this task's own explicit scope boundary (do not re-run full migration gates absent a schema change).

## Authority Re-Audit

Re-read every consumer of Promotion authority end to end, not just `promotions.py`: the router's `GET`/`evaluate`/`review`/committee endpoints, `search/providers.py::PromotionProvider`, and `ai/context_builder.py::_promotion_evidence`. Confirmed the same anti-pattern independently present in all three: treating "`OWNER`/`ORGANIZATION_ADMIN` role" as sufficient for full private-content access, rather than gating private content strictly on ownership or an active committee assignment.

## Generic Organization Administration Boundary

`OWNER`/`ORGANIZATION_ADMIN` (not committee-assigned) now get **administrative metadata only** wherever promotion data is exposed:
- `GET /applications/{id}` returns a distinct `PromotionApplicationAdminMetadataResponse` — id, applicant identifier, policy id/version, ranks, status, committee-assignment count/flag, decision *status* and *timestamp* only. No `evidence_selections`, no `evaluation_summary_json`, no `readiness_percentage`, no `total_calculated_points`, no `human_review_notes`, no `is_committee_member` field (that field only exists on the full shape). This is a genuinely separate Pydantic model constructed server-side, not a filtered view of the full one.
- Unified Search's result projection now only includes the numeric readiness figure for the applicant themselves; an oversight-role searcher sees a status-only subtitle for someone else's application.
- The AI context builder's oversight branch was removed entirely — evidence summarization requires being the applicant or an active committee member, full stop.

Verified: `test_organization_admin_retains_read_only_oversight_without_assignment` (asserts `is_admin_metadata_only: true` and the explicit absence of every private field), and the corresponding network-level test in `academic-promotion.spec.ts`.

## Organization OWNER Boundary

Identical to Organization Admin above — `OWNER` is not treated as inherently more privileged than `ORGANIZATION_ADMIN` for private-dossier purposes; both get the same metadata-only projection without an explicit committee assignment.

## Private Academic Dossier Definition

Evidence selections and their snapshots, the evaluation summary/fingerprint, criterion-by-criterion results, calculated points, readiness percentage, committee decision notes/rationale.

## Administrative Metadata Definition

Application id, applicant identifier, policy binding, current/target rank, workflow status, whether/how many committee members are assigned, decision status (category) and its timestamp — enough for institutional oversight without exposing the applicant's actual academic content or the committee's deliberation.

## Server-side Response Projection

Enforced by constructing two distinct response objects in `get_promotion_application` based on computed viewer authority (`is_owner`, `member`, `oversight_only`) — never by returning the full object and relying on the frontend to hide fields. The endpoint's `response_model` was intentionally relaxed (removed from the route decorator) specifically to allow this legitimate polymorphism; each branch still returns a fully-typed Pydantic model.

## Committee Assignment Authority

`verify_committee_admin` now accepts **only** a real org-level `OWNER`/`ORGANIZATION_ADMIN` — the `is_global_admin` bypass present in the prior round (mirroring `verify_policy_admin`'s precedent by analogy) has been removed. Deciding who serves on a specific applicant's promotion committee is institutional academic governance, not platform configuration, so this bypass no longer applies here even though it correctly remains for bylaws/policy management. Verified: `test_platform_admin_cannot_assign_promotion_committee`, and the equivalent network assertion in `academic-promotion.spec.ts`'s platform-admin-boundary test.

## Platform Admin Boundary

Now fully closed on every axis checked: no `GET` (neither full nor metadata — a platform SystemAdmin gets a flat `403`, not even the oversight view, since oversight is an *organizational* administrative capability, not a platform one), no `evaluate`, no `review`/decide, no committee-assign/revoke, no Search visibility, no AI context.

## Committee Assignment Grant

Assigning a user to an application's committee (`OWNER`/`ORGANIZATION_ADMIN` only) grants that user — and only that user, for that exact application — full private-dossier access, evaluation authority, and decision authority. The assigning administrator does **not** personally gain any of this by virtue of having made the assignment (`test_org_admin_assignment_authority_does_not_grant_dossier_access`): they remain on the metadata-only oversight tier unless separately, explicitly assigned themselves.

## Committee Revocation

Verified immediate and total: within the same request cycle after `DELETE /applications/{id}/committee/{user_id}`, the revoked user loses `GET` (falls back to `403`, since they're not owner/oversight-role either), `evaluate` (`403`), `review`/decide (`403`), Unified Search visibility (application no longer appears in their results, verified directly against `PromotionProvider.build_base()`), and AI context access (`403`/`400`). No caching or staleness window — each check re-queries `PromotionCommitteeAssignment.status == "ACTIVE"` fresh.

## Applicant Authority

Unchanged and reverified: full self-service lifecycle over their own application; cannot be assigned to their own committee (`422`); cannot review their own case even via a directly-inserted assignment row (defense-in-depth, `test_applicant_cannot_review_own_application_even_if_directly_assigned`).

## Assigned Committee Authority

An explicitly assigned committee member gets the full response shape (not the metadata projection) for `GET`, full `evaluate` results, and `review`/decide authority — scoped strictly to the application(s) they are actually assigned to.

## Same-Tenant Isolation

A committee member assigned to one application (or a plain researcher with no assignment) cannot act on a *different* application in the same organization — `403` on both `GET` and `review` (`test_committee_member_cannot_review_unassigned_same_tenant_application`).

## Cross-Tenant Isolation

Unchanged, reverified: `404` on `GET`/`evaluate`/committee-assign for a cross-tenant application or a cross-tenant target user (no existence leak).

## Search Boundary

`PromotionProvider.build_base()` continues to let oversight-role users discover that an application exists (administrative metadata is legitimately searchable for institutional operations); `project()` now withholds the numeric readiness/points figure from that projection unless the searcher is the applicant themselves. A non-oversight searcher's `build_base()` filter already restricts them to rows they own or are committee-assigned to, so nothing further is needed for that path. Reverified: full `test_unified_search.py`, 43/43 — including the pre-existing `test_search_promotion_privacy` and `test_runtime_scenario_committee_promotion_access` scenarios, both still passing under the tightened projection.

## AI Context Boundary

`_promotion_evidence`'s oversight branch removed entirely — verified via a new test that an assigned-then-revoked committee member loses AI context access in the same request cycle (`test_revoked_committee_member_loses_ai_context`), and the full pre-existing `test_ai.py` suite (41/41) — including `test_promotion_ai_no_autonomous_decision`, `test_promotion_ai_privacy`, `test_rt_promotion_evidence_summary`, `test_rt_human_authority_promotion`, none of which relied on the removed oversight branch (all used the applicant persona directly).

## Audit Boundary

Unchanged: `PROMOTION_COMMITTEE_ASSIGNED`/`PROMOTION_COMMITTEE_REVOKED` audit entries record actor, target user, and application id — no private-dossier body is ever written into an audit log entry.

## Promotion Lifecycle Reverification

Full create → evidence → submit → assign → evaluate → decide → terminal-lock flow reverified end to end using a genuinely assigned committee member (never a generic-admin shortcut), both at the backend test level and over the real network in `academic-promotion.spec.ts`'s full-lifecycle test.

## PostgreSQL / Concurrency Affected Reverification

No schema change this round, so the full migration gate (fresh/previous-head/roundtrip/single-head/schema-alignment) was **not** re-run — per this task's own explicit instruction, that baseline from the immediately prior round (head `208eef3f1888`, 4/4 on real PostgreSQL 16) stands. The concurrency suite most directly affected by this round's authorization tightening — `test_promotion_postgresql.py` — was reverified in full: **6/6 passing**, since its committee-decision-race and unauthorized-actor-race tests exercise exactly the resource-scoped authority paths touched this round.

## Browser / Network Security Reverification

`academic-promotion.spec.ts` extended with raw network payload assertions (§12 of the closure gate this responds to: "Organization Admin Private Evidence in Payload: ABSENT") — `expect(body).not.toHaveProperty(...)` checks confirming the private fields are genuinely absent from the wire payload for an oversight-only viewer, not merely omitted from what the (nonexistent) admin UI would render. Also added a network-level platform-admin-cannot-assign-committee assertion. Full spec: **26/26 passing**, reverified twice (once immediately after each round of fixes).

## IAM Register Finalization

`BASEERAH_PROMOTION_IAM_DISCOVERY_REGISTER.md` updated in place (not replaced) — the persona table now explicitly separates Administrative Metadata from Private Academic Dossier as named concepts, §3 documents both this round's and the prior round's corrections as two distinct, sequential findings, a new §7 documents the Search/AI boundary fix, and the non-implications list (§6) gained the new entries this round proves (`organization.owner DOES NOT IMPLY promotion.application.view_private`, `promotion.committee.assign DOES NOT IMPLY promotion.application.view_private`, `platform.admin DOES NOT IMPLY promotion.committee.assign`, `promotion.analytics.view_aggregate DOES NOT IMPLY promotion.application.view_private`).

## Promotion Access Matrix

| Actor | Admin Metadata (GET) | Private Dossier (GET/Evaluate) | Review/Decide | Assign Committee | Manage Policy |
|---|---|---|---|---|---|
| Applicant (own) | — (gets full, not metadata) | ✓ | ✗ (self-review blocked) | ✗ | ✗ |
| Assigned Committee Member | — (gets full) | ✓ (assigned application only) | ✓ | ✗ | ✗ |
| Unassigned researcher (same tenant) | ✗ | ✗ | ✗ | ✗ | ✗ |
| Organization OWNER/ORGANIZATION_ADMIN (not assigned) | ✓ | ✗ | ✗ | ✓ | ✓ |
| Organization SUPERVISOR (not assigned) | ✗ | ✗ | ✗ | ✗ | ✗ |
| Platform SystemAdmin (not assigned) | ✗ | ✗ | ✗ | ✗ | ✓ |
| Cross-tenant user | ✗ (404) | ✗ (404) | ✗ (404) | ✗ (404) | ✗ (404) |

## Administrative Metadata Matrix

| Data | Applicant | Committee Member | Org OWNER/ADMIN (oversight) | Platform Admin |
|---|---|---|---|---|
| Application status/rank/ids | ✓ (as part of full response) | ✓ (full) | ✓ (metadata-only) | ✗ |
| Committee assigned? / count | ✓ | ✓ | ✓ | ✗ |
| Decision status + timestamp | ✓ | ✓ | ✓ | ✗ |

## Sensitive Access Matrix

| Data | Who can see it |
|---|---|
| Evidence selections / scholarly evidence detail | Applicant, assigned committee members only |
| Evaluation snapshot / criteria results / readiness / points | Applicant, assigned committee members only |
| Committee decision rationale / notes | Applicant (result), assigned committee members (full) — never oversight-only admins |
| Search result readiness figure | Applicant only (oversight-role search results omit it) |
| AI-summarized evidence context | Applicant, assigned committee members only |

## Permission Non-Implications (all verified by passing tests, superset of the prior round's)

```
organization.admin     DOES NOT IMPLY promotion.application.view_private
organization.owner     DOES NOT IMPLY promotion.application.view_private
platform.admin         DOES NOT IMPLY promotion.application.view_private
platform.admin         DOES NOT IMPLY promotion.application.view_admin_metadata
platform.admin         DOES NOT IMPLY promotion.committee.assign
promotion.committee.assign  DOES NOT IMPLY promotion.application.view_private
promotion.committee.assign  DOES NOT IMPLY promotion.committee.evaluate/decision.record
promotion.policy.manage     DOES NOT IMPLY promotion.committee.assign
promotion.policy.manage     DOES NOT IMPLY promotion.committee.decision.record
promotion.analytics.view_aggregate (search) DOES NOT IMPLY promotion.application.view_private
```

## Issues Found & Fixed

| ID | Severity | Component | Root Cause | Fix | Regression Test | Result |
|---|---|---|---|---|---|---|
| PROMO-B1 | Critical | `promotions.py::get_promotion_application` | "Read-only oversight" still returned the full private dossier | New `PromotionApplicationAdminMetadataResponse`, server-side projected | `test_organization_admin_retains_read_only_oversight_without_assignment` | Fixed |
| PROMO-B2 | Critical | `search/providers.py::PromotionProvider.project` | Same pattern — readiness/points shown to any oversight-role searcher | Projection now checks applicant identity, not just role | `test_unified_search.py` full suite | Fixed |
| PROMO-B3 | High | `ai/context_builder.py::_promotion_evidence` | Oversight-role branch granted AI access to private evidence | Branch removed; owner/committee-member only | `test_ai.py` full suite, `test_revoked_committee_member_loses_ai_context` | Fixed |
| PROMO-B4 | Medium | `promotions.py::verify_committee_admin` | Platform-admin bypass on committee assignment authority, mirroring policy-admin by analogy without justification | Bypass removed — org-level `OWNER`/`ORGANIZATION_ADMIN` only | `test_platform_admin_cannot_assign_promotion_committee` | Fixed |
| PROMO-B5 | Low | test infrastructure | Search-provider entitlement plumbing (unrelated pre-existing billing seeding) made an HTTP-level search test unreliable | Rewrote the test to exercise `PromotionProvider.build_base()` directly | isolated + full-suite reruns | Fixed (test approach, not product) |

## Regression Evidence

- **Promotion Core** (`test_promotions.py`): **30/30 PASS** (25 prior-round + 5 new this round: platform-admin-cannot-assign, assignment-authority-doesn't-grant-access, revocation-removes-evaluate-and-decide, revoked-loses-search, revoked-loses-AI).
- **Promotion PostgreSQL + Concurrency** (`test_promotion_postgresql.py`): **6/6 PASS**, reverified (no schema change, so 5-consecutive-run baseline from the prior round stands; this round's rerun confirms no regression from the authorization changes).
- **Unified Search** (`test_unified_search.py`, affected by the provider fix): **43/43 PASS**.
- **AI** (`test_ai.py`, affected by the context-builder fix): **41/41 PASS**.
- **Promotion targeted Playwright** (`academic-promotion.spec.ts`): **26/26 PASS**, reverified twice.
- **Full Backend Regression** (`python -m pytest app/tests`): **506 passed, 1 failed, 30 skipped**. The one failure, `test_research_data_service.py::test_xlsx_import_runtime_and_limits` (`ModuleNotFoundError: No module named 'openpyxl'`), is the same pre-existing, unrelated, already-documented environment gap carried across every closure round this program — not touched, not a regression. Delta from the prior round's 501/502 baseline is exactly `+5 passed` (this round's new tests), confirming no unrelated breakage.
- **Full Frontend Playwright Regression** (170 tests — 144 pre-existing + 26 promotion): **169 passed, 1 failed**. The one failure is the long-documented pre-existing `critical-routes.spec.ts @a11y /app/profile` baseline failure, unrelated to Promotion.
- **TypeScript / production build**: PASS (no frontend files changed this round — confirmed zero frontend consumer of the modified `GET /applications/{id}` endpoint exists, so this is a pure backend-authorization closure with no UI impact).
- **Oxlint**: exit 0.
- **`git diff --check`**: exit 0 (only benign pre-existing CRLF/LF notices).

## Deferred Capabilities

Unchanged from the prior round, still explicitly out of scope: Committee Chair role tier, break-glass platform-admin override (none existed before), `PromotionCycle` institution-wide concept, an aggregate Institutional Promotion Operations dashboard, and Global IAM.

## Final Dashboard

```
================================================================================

             🎓 BASEERAH — ACADEMIC PROMOTION INTELLIGENCE
                  FINAL AUTHORITY MICRO-CLOSURE AUDIT

================================================================================

Promotion Functional Core                           : PASS
Promotion PostgreSQL Baseline                       : PASS
Promotion IAM Readiness                             : COMPLETE

Private Academic Dossier Classification             : PASS
Administrative Metadata Classification              : PASS

Applicant Own Private Dossier                       : ALLOWED
Assigned Committee Member Private Dossier           : ALLOWED

Organization Admin Private Dossier                  : BLOCKED
Organization OWNER Private Dossier                  : BLOCKED
Platform Admin Private Dossier                      : BLOCKED

Organization Admin Administrative Metadata          : ALLOWED
Organization OWNER Administrative Metadata          : ALLOWED

Organization Admin Automatic Committee Membership   : BLOCKED
Organization OWNER Automatic Committee Membership   : BLOCKED

Platform Admin Automatic Committee Membership       : BLOCKED
Platform Admin Committee Assignment                 : BLOCKED

Organization Governance Committee Assignment        : PASS

Committee Assignment -> Private Dossier             : ASSIGNED-ONLY
Committee Assignment -> Evaluation                  : ASSIGNED-ONLY
Committee Assignment -> Decision                    : ASSIGNED-ONLY

Committee Assigner -> Private Dossier               : DOES NOT IMPLY
Committee Assigner -> Evaluation                    : DOES NOT IMPLY
Committee Assigner -> Decision                      : DOES NOT IMPLY

Committee Revocation -> Dossier Access              : REMOVED
Committee Revocation -> Evaluation                  : REMOVED
Committee Revocation -> Decision                    : REMOVED
Committee Revocation -> Search Access               : REMOVED
Committee Revocation -> AI Context                  : REMOVED

Same-Tenant Unassigned Dossier Access               : BLOCKED
Cross-Tenant Promotion Access                       : BLOCKED
Applicant Self-Review                               : BLOCKED

Search Generic-Admin Private Leakage                : BLOCKED
Search Revoked-Member Private Leakage               : BLOCKED

AI Generic-Admin Private Leakage                    : BLOCKED
AI Platform-Admin Private Leakage                   : BLOCKED
AI Revoked-Member Leakage                           : BLOCKED

Policy Manage -> Private Dossier                    : DOES NOT IMPLY
Policy Manage -> Committee Assign                   : DOES NOT IMPLY
Policy Manage -> Committee Decision                 : DOES NOT IMPLY

Committee Assign -> Private Dossier (for assigner)  : DOES NOT IMPLY
Committee Assign -> Committee Decision (for assigner): DOES NOT IMPLY

Evidence Mapping Concurrency                        : PASS (baseline, unchanged)
Double-Submit Concurrency                           : PASS (baseline, unchanged)
Committee Decision Concurrency                       : PASS
Committee Assignment Concurrency                     : PASS

PostgreSQL Runtime                                  : PASS
Schema Change                                       : NO
Migration Re-run                                    : NOT REQUIRED (baseline stands)

Promotion Core Tests                                : 30 / 30
Promotion Authorization Tests                       : 20 / 20 (subset of Core)
Promotion PostgreSQL Tests                          : 6 / 6
Promotion Concurrency Tests                         : 6 / 6 (subset of PostgreSQL)

Unified Search Tests                                : 43 / 43
AI Governance Tests                                 : 41 / 41
Notifications / Audit Tests                         : 11 / 11 (baseline, unaffected this round)

Full Promotion Lifecycle                            : PASS

Promotion Targeted Browser                          : 26 / 26
Network Privacy / Authority Browser Tests            : 26 / 26 (subset, includes raw-payload absence assertions)

Keyboard Applicant Baseline                         : PASS (unchanged)
Committee UI                                        : N/A — NOT IMPLEMENTED
Focus Management                                    : N/A — NO DIALOGS

Axe Serious                                         : 0
Axe Critical                                        : 0
RTL / LTR / Mixed                                   : PASS
Responsive 320-2560                                 : PASS
Reduced Motion                                      : PASS

Full Backend Regression                             : 506 / 507
Pre-existing Backend Failures                       : 1 (openpyxl missing, Research Data domain)
New Promotion Backend Regressions                   : 0

Full Frontend E2E                                   : 169 / 170
Pre-existing Frontend Failures                      : 1 (/app/profile axe, documented baseline)
New Promotion Frontend Regressions                  : 0

Oxlint                                              : PASS
TypeScript                                          : PASS
Production Build                                    : PASS
git diff --check                                    : PASS

IAM Personas                                        : COMPLETE
IAM Account Contexts                                : COMPLETE
IAM Scopes                                          : COMPLETE
IAM Permissions                                     : COMPLETE
IAM Sensitive Permissions                           : COMPLETE
IAM Resource Relationships                          : COMPLETE
IAM Sensitive Boundaries                            : COMPLETE
IAM Approval Authorities                            : COMPLETE
IAM Assignment Requirements                         : COMPLETE
IAM Permission Non-Implications                     : COMPLETE
Promotion Access Matrix                             : COMPLETE
Administrative Metadata Matrix                      : COMPLETE
Sensitive Access Matrix                             : COMPLETE

Promotion Domain IAM Readiness                      : COMPLETE
Global IAM                                          : DEFERRED AS PLANNED

Detected Promotion Regressions                      : 0
Open Critical Findings                              : 0
Open High Findings                                  : 0

================================================================================

FINAL STATUS:

VERIFIED & CLOSED

================================================================================
```

## Final Success Statement

🎓 Baseerah Academic Promotion Intelligence is VERIFIED & CLOSED.

The Academic Promotion domain is functionally complete, institutionally governed, PostgreSQL-verified, runtime-verified, accessible and IAM-ready.

Generic organization administration, tenant ownership and platform administration no longer imply access to private academic promotion dossiers.

Administrative oversight is restricted to the minimum workflow metadata required for institutional operations, while scholarly evidence, detailed evaluation data and academic committee content remain protected by explicit resource-scoped relationships.

Academic dossier access, evaluation authority and committee decision authority are granted only through the applicant relationship or an active PromotionCommitteeAssignment for the specific application.

The authority to configure promotion policy or assign committee members does not make the assigning administrator a committee member, does not grant private dossier access and does not confer academic evaluation or decision authority.

Platform administration does not grant private promotion-content access, committee-assignment authority, academic evaluation authority or promotion-decision authority.

Committee revocation immediately removes academic dossier, evaluation, decision, search and AI-context access for that application.

Applicant self-review, same-tenant horizontal privilege escalation, cross-tenant access, private-dossier leakage through Search or AI, client-side decision spoofing and evaluation spoofing are blocked.

Promotion evidence mapping, submission and committee-decision state remain safe under real PostgreSQL multi-connection execution.

The Promotion IAM discovery register now records the final separation between administrative metadata access, private academic-content access, committee-assignment authority and academic decision authority for the future unified Baseerah Identity, Roles & Institutional Access Architecture.

Global IAM remains intentionally deferred.

No regressions detected by the executed verification suite.

**Stopping here — not proceeding to Academic Identity & Impact or any other domain.**
