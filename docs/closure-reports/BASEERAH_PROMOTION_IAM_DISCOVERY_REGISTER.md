# Baseerah Academic Promotion Intelligence — IAM Discovery Register

Verified directly against the running code in `backend/app/routers/promotions.py`, `backend/app/models.py`, `backend/app/services/search/providers.py`, `backend/app/services/ai/context_builder.py`, and `backend/app/services/tenant_context.py`, and against passing automated tests (`backend/app/tests/test_promotions.py`, `backend/app/tests/test_promotion_postgresql.py`, `backend/app/tests/test_unified_search.py`, `backend/app/tests/test_ai.py`). This register supersedes the prior version — this closure round reopened and corrected the authority model it originally documented (see §3), specifically the scope of what "read-only institutional oversight" actually means.

## 1. Personas & Account Contexts

Two independent role systems, as in every Baseerah domain:

- **`OrganizationMembership.role`** (per-organization): `RESEARCHER`, `SUPERVISOR`, `ORGANIZATION_ADMIN`, `OWNER`.
- **`User.role`** (platform-wide, independent of any org membership): read via `TenantContext.is_global_admin`. A user can be `is_global_admin=True` while holding only a `RESEARCHER` membership in the organization they act in.

Personas relevant to this domain, and the authority each actually carries (verified, not assumed):

| Persona | Org role | Platform role | Automatic committee authority |
|---|---|---|---|
| Applicant | any | any | none over their own case (self-review blocked) |
| Committee Member | any | any | **only** if an `ACTIVE` `PromotionCommitteeAssignment` exists for that exact application |
| Committee Administrator | `OWNER`/`ORGANIZATION_ADMIN` | — | authority to assign/revoke committee members; **not** committee authority itself, **not** private-dossier access |
| Organization OWNER/ORGANIZATION_ADMIN (not assigned) | `OWNER`/`ORGANIZATION_ADMIN` | any | **administrative metadata only** — sees that an application exists, its status, rank, and whether a committee/decision has been recorded; **never** the private academic dossier (evidence, evaluation detail, readiness/points, committee notes, decision rationale) |
| Platform SystemAdmin | any | `SystemAdmin` | **none whatsoever** — no private dossier, no administrative-metadata GET, no committee assignment authority, no evaluate/review/decide |

**Administrative Metadata vs. Private Academic Dossier** — the distinction this register's corrected model turns on:

- **Administrative Metadata** (visible to org OWNER/ORGANIZATION_ADMIN oversight): application id, applicant identifier, policy id/version, current/target rank, status, whether a committee is assigned and how many members, the decision *status* and *when* it was recorded.
- **Private Academic Dossier** (visible only to the applicant and assigned committee members): evidence selections, scholarly evidence detail, evaluation snapshot/criteria results, calculated points, readiness percentage, committee notes, decision rationale.

## 2. Permission Vocabulary (extracted from actual implementation)

```
promotion.application.create
promotion.application.view_own
promotion.application.edit_own (evidence add/remove while DRAFT/RETURNED_FOR_CHANGES)
promotion.application.submit

promotion.evidence.manage_own

promotion.evaluation.run_own
promotion.evaluation.view_own

promotion.policy.view
promotion.policy.manage

promotion.committee.assign        (sensitive — see §4)
promotion.committee.view          (sensitive)
promotion.committee.evaluate      (sensitive)
promotion.committee.decision.record (sensitive)

promotion.application.view_admin_metadata (read-only, org OWNER/ORGANIZATION_ADMIN only — administrative metadata, never the private dossier)
promotion.application.view_private (applicant own, or active committee member for that application only)

promotion.analytics.view_aggregate (search result visibility — see §11)
```

## 3. Core Authorization Finding — Reopened and Corrected Twice This Program

**First correction** (earlier this round): the original implementation granted academic committee decision authority to `OWNER`/`ORGANIZATION_ADMIN`/`SUPERVISOR` roles and to platform-wide `is_global_admin` status automatically, with no per-application relationship at all — fixed by introducing `PromotionCommitteeAssignment`, resource-scoping `evaluate`/`review`.

**Second correction** (this pass): the first correction's own `has_org_oversight_access` — while correctly excluding `is_global_admin` — still returned the **entire private academic dossier** (evidence, evaluation snapshot, readiness percentage, calculated points, human_review_notes) to any org `OWNER`/`ORGANIZATION_ADMIN`, merely gated as "read GET only, can't write." Read-only is not the same as safe: a generic administrator who has never been assigned to an applicant's committee should not be able to read that applicant's evidence portfolio or evaluation detail at all. **This is now split server-side**: `GET /applications/{id}` returns the full `PromotionApplicationResponse` only to the applicant or an active committee member; an oversight-only `OWNER`/`ORGANIZATION_ADMIN` gets a distinct, separately-defined `PromotionApplicationAdminMetadataResponse` containing only administrative workflow metadata — constructed as a genuinely different object server-side, not filtered client-side. The same boundary was found independently duplicated (and fixed identically) in the Unified Search provider's result projection and the AI context builder, both of which had also been treating "oversight role" as sufficient for full private-content access.

**Third correction** (this pass): `verify_committee_admin` (the authority to assign/revoke committee members) still accepted `is_global_admin`, mirroring `verify_policy_admin`'s precedent by analogy — but deciding who serves on a specific applicant's promotion committee is institutional academic governance, not platform configuration, so this bypass has been removed. Only a real org-level `OWNER`/`ORGANIZATION_ADMIN` may assign or revoke committee members now.

## 4. Committee Assignment Model

New table `promotion_committee_assignments` (migration `208eef3f1888`), one row per `(application_id, user_id)` pair (`uq_promotion_committee_assignment`), with `status` `ACTIVE`/`REVOKED`. This is a **per-application** relationship (mirrored on the existing `ThesisCommitteeMember`/`ThesisExaminerAssignment` pattern already used elsewhere in Baseerah) — there is no `PromotionCycle` concept in the current architecture, so per-application scoping is the correct, minimal, architecture-consistent choice; introducing a cycle-level concept was assessed and deliberately not done (would be new-feature scope, not a defect fix).

- **Assign** (`POST /applications/{id}/committee`) and **Revoke** (`DELETE /applications/{id}/committee/{user_id}`): gated by `verify_committee_admin` — `OWNER`/`ORGANIZATION_ADMIN` **only** (no platform-admin bypass — see §3). This is a deliberate, distinct capability from committee membership itself: **the ability to configure who serves on a committee does not itself confer academic decision authority, and does not confer private-dossier access** — an admin who assigns someone else to the committee gains nothing personally from that act (`test_org_admin_assignment_authority_does_not_grant_dossier_access`).
- The applicant can never be assigned to their own committee — blocked at assignment time (`422`) and, as defense-in-depth, at decision time too (`review_promotion_application` independently checks `app.user_id != context.user.id` even if a row somehow existed).
- Assignment/revocation to a cross-tenant target user, or on a cross-tenant application, resolves as `404` (tenant-scoped lookups, no existence leak).
- Duplicate active assignment is rejected (`409`), backed by a real unique constraint, verified race-safe on real PostgreSQL 16 (`test_pg_duplicate_committee_assignment_race_no_duplicate_row`).
- **Revocation is immediate and total**: verified separately that a revoked member loses `GET` (full dossier), `evaluate`, `review`/decide, Unified Search visibility, and AI context access — all in the same request cycle, no caching/staleness (`test_committee_assignment_revocation_removes_authority`, `test_committee_revocation_removes_evaluation_and_decision_authority_specifically`, `test_revoked_committee_member_loses_search_access`, `test_revoked_committee_member_loses_ai_context`).

## 5. Endpoint Authority Matrix (verified from code + passing tests)

| Endpoint | Authority required | Response shape |
|---|---|---|
| `GET /policies`, `POST /policies`, `PUT /policies/{id}`, `POST /policies/{id}/new-version` | `verify_policy_admin` — `OWNER`/`ORGANIZATION_ADMIN` or `is_global_admin` (unchanged; policy/bylaws configuration, not academic content or decision access) | full |
| `POST /applications` | any authenticated org member (creates their own) | full |
| `GET /applications/my` | the caller's own application only | full |
| `GET /applications/{id}` | applicant, active committee member (full); `OWNER`/`ORGANIZATION_ADMIN` oversight (metadata); else `403` | **full** for applicant/committee member; **`PromotionApplicationAdminMetadataResponse`** (metadata-only) for oversight — two genuinely distinct server-constructed objects |
| `POST /applications/{id}/evidence`, `DELETE .../evidence/{asset_id}` | applicant only, own application, non-terminal state | full |
| `POST /applications/{id}/submit` | applicant only, own application, valid prior state | full |
| `POST /applications/{id}/evaluate` | applicant (own) or active committee member for that application — **not** generic org/platform admin, not oversight-only | full evaluation result |
| `POST /applications/{id}/committee` (assign), `DELETE .../committee/{user_id}` (revoke) | `verify_committee_admin` — `OWNER`/`ORGANIZATION_ADMIN` only (no `is_global_admin`) | assignment record |
| `POST /applications/{id}/review` (record committee decision) | active committee member for that exact application **only** — no org-role or platform-admin bypass, applicant excluded even if assigned | full |

## 6. Non-Implications (explicitly verified by passing tests)

```
platform.admin        DOES NOT IMPLY promotion.application.view_private       (test_platform_admin_cannot_view_private_promotion_application)
platform.admin        DOES NOT IMPLY promotion.application.view_admin_metadata (platform admin gets 403, not even the metadata view)
platform.admin        DOES NOT IMPLY promotion.committee.evaluate             (test_platform_admin_cannot_evaluate_promotion_application)
platform.admin        DOES NOT IMPLY promotion.committee.decision.record      (test_platform_admin_cannot_record_committee_decision)
platform.admin        DOES NOT IMPLY promotion.committee.assign               (test_platform_admin_cannot_assign_promotion_committee)
organization.admin     DOES NOT IMPLY promotion.application.view_private      (test_organization_admin_retains_read_only_oversight_without_assignment — gets metadata only)
organization.owner     DOES NOT IMPLY promotion.application.view_private      (same test, OWNER persona)
organization.admin    DOES NOT IMPLY promotion.committee.evaluate             (test_organization_admin_without_committee_assignment_cannot_evaluate)
organization.admin    DOES NOT IMPLY promotion.committee.decision.record      (test_organization_admin_without_committee_assignment_cannot_review)
promotion.policy.manage       DOES NOT IMPLY promotion.committee.decision.record (verify_policy_admin and verify_committee_admin are separate gates from is_committee_member)
promotion.committee.assign    DOES NOT IMPLY promotion.application.view_private (test_org_admin_assignment_authority_does_not_grant_dossier_access)
promotion.committee.assign    DOES NOT IMPLY promotion.committee.evaluate/decision.record (an admin who assigns is not thereby a member — §4)
promotion.analytics.view_aggregate (search) DOES NOT IMPLY promotion.application.view_private (search projection strips readiness/points for oversight-role searchers — §7)
publication.evidence.view (ScholarlyAsset access via Publication) DOES NOT IMPLY promotion.committee.evaluate (no cross-domain authority leak — the FK is data-linkage only, see §9)
```

## 7. Search & AI Context Boundary (the same private-content boundary, enforced in two more consumers)

Reading every consumer of promotion authority — not just the router — surfaced the identical "oversight role = full private access" pattern independently duplicated in two more places, both fixed to match §3's corrected model:

- **Unified Search** (`PromotionProvider` in `search/providers.py`): `build_base()` still lets `OWNER`/`ORGANIZATION_ADMIN` see that a row exists (so the application is discoverable — title/status/rank are administrative metadata), but `project()` now only includes the numeric `readiness_percentage`/points in the result payload for the applicant themselves; an oversight-role searcher viewing someone else's application gets a status-only subtitle, never the readiness figure. A non-oversight searcher (plain researcher) only ever sees rows `build_base()` already scoped to their own application or an active committee assignment, so every row reaching `project()` for them is one they have full legitimate access to.
- **AI Context Builder** (`context_builder.py::_promotion_evidence`): the `OWNER`/`ORGANIZATION_ADMIN` oversight branch was removed entirely — AI evidence summarization now requires being the applicant or an active committee member, full stop. Oversight there is a metadata-only GET privilege, not private-content access, so it does not extend to AI context either.

Both changes reverified against their full pre-existing suites: `test_unified_search.py` (43/43), `test_ai.py` (41/41).

## 8. IDOR / Isolation (verified)

- **Cross-tenant**: application GET/evaluate/review/committee-assign all resolve `404` for a different organization (`test_cross_tenant_isolation_promotions`, `test_committee_assignment_cross_tenant_target_rejected`, `test_committee_assignment_cross_tenant_application_rejected`).
- **Same-tenant horizontal**: a committee member assigned to one application (or a plain researcher with no assignment at all) cannot act on a *different* application in the same organization they were never assigned to — `403` (`test_committee_member_cannot_review_unassigned_same_tenant_application`).
- **Self-review**: blocked both at assignment time and at decision time, defense-in-depth (`test_applicant_cannot_be_assigned_to_own_committee`, `test_applicant_cannot_review_own_application_even_if_directly_assigned`).
- **Mass assignment**: `PromotionApplicationCreate`/`PromotionEvidenceSelectRequest`/`HumanReviewDecisionRequest`/`PromotionCommitteeAssignRequest` schemas expose no client-settable `points`, `readiness_percentage`, `status`, `decision`-outcome-as-final, or `is_committee_member` field that bypasses server computation — all of those remain server-derived.

## 9. Cross-Domain Dependency (confirmed, FK-backed, unchanged)

`PromotionAssetSelection.scholarly_asset_id → core_scholarly_assets.id` — the same `ScholarlyAsset` model Publication Intelligence manages. This is data linkage (evidence content), not an authority grant — being able to view a `ScholarlyAsset` via Publication confers nothing toward Promotion committee authority, and vice versa. No relationship to Peer Review.

## 10. Evaluation Engine — Unchanged, Confirmed Non-AI, Deterministic

`promotion_evaluator.py` was not modified this round (no defect found in it). Whitelisted metrics/operators, no `eval()`/`exec()`. Readiness/points remain explicitly advisory (`PromotionEvaluationResult.disclaimer_ar/en`) and are never conflated with the human committee's final decision — the frontend renders them as separate concepts, and no code path derives a final `human_review_decision` from the evaluator's output.

## 11. Deferred / Out of Scope (explicitly, not silently)

- **Committee Chair** concept: not introduced — current architecture needs only a flat "member" tier; no product requirement observed for a distinct chair role.
- **Break-glass platform-admin override**: not introduced — none existed before, and the closure gate explicitly says not to invent one without a pre-existing mechanism.
- **PromotionCycle** (institution-wide review cycles distinct from a single application): not introduced — see §4.
- **Institutional aggregate Promotion Operations dashboard**: no such endpoint or UI exists in the product; not built new this round (would be new-feature scope). Organization-level insight remains limited to the administrative-metadata-only per-application GET oversight described in §5.
- **Global IAM**: intentionally deferred, as in every other domain closure this program. This register documents domain-local enforcement plus the cross-domain non-implications a future unified IAM system will need to preserve.
