# Baseerah Academic Identity, Visibility & Impact Intelligence — IAM Discovery Register

Verified directly against the running code in `backend/app/routers/academic_foundation.py`, `backend/app/routers/academic_visibility.py` (retired), `backend/app/models.py`, `backend/app/schemas.py`, `backend/app/services/search/providers.py`, `backend/app/services/ai/context_builder.py` and `use_cases.py`, `backend/app/main.py`, and against passing automated tests (`backend/app/tests/test_academic_foundation.py`, `backend/app/tests/test_academic_visibility.py`, `backend/app/tests/test_unified_search.py`, `tests/e2e/academic-identity-impact.spec.ts`). **v2 — this micro-closure round.** Supersedes v1: closes the four gaps v1 itself documented as open (publication provenance, Unified Search asset-privacy leak, Search navigation bug, and this register's own incomplete section coverage against the Cross-Domain IAM Consolidation template).

---

## 1. Domain Boundary

Two active tables carry this domain: `UnifiedAcademicProfile` (`core_unified_academic_profiles`) with child `AcademicIdentifier` and `AcademicAffiliation`, and `ScholarlyAsset` (`core_scholarly_assets`) — the **same table** Publication Intelligence uses as its manuscript record and Promotion uses as its evidence catalogue. Academic Identity does not own a separate copy of publication data; it *is* a view over the same `ScholarlyAsset` rows, distinguished at read time by `lifecycle_status`/`visibility` (public projection, §4) and now also by a live-computed **publication provenance** (§3.7) that separates *lifecycle* from *trustworthiness of the publication claim*.

A **legacy, parallel system** (`AcademicIdentityProfile`/`AcademicChannel`, router `academic_visibility.py`) existed alongside the active one, fully superseded and backfilled by migration `8322d39fc0aa`, and is **retired** — un-mounted from `main.py`, 404 on every path, guarded by a permanent regression test. Model classes and router file remain on disk for historical reference only.

**General Unified Search vs. Internal Scholarly-Asset Catalogue** — an explicit architectural distinction this round formalized (§3.8, §13): `GET /academic-foundation/scholarly-assets` (used by the owner's own portfolio editor, and independently by Publication Intelligence's and Promotion's own dedicated endpoints, which query `ScholarlyAsset` directly and never call into the Search service) remains org-wide-readable for same-tenant collaboration, unchanged this round. The **General Unified Search** service (`GET /api/search`, `AssetProvider`) is a *different* discovery surface with stricter, publication-status-aware visibility rules — see §3.8.

---

## Core Findings — This Micro-Closure Round (§3.1–§3.9)

### 3.1 CRITICAL — Live cross-user/cross-tenant IDOR (fixed by un-mounting)

`academic_visibility.py`'s `GET /profile/{user_id}` and `POST /profile` both trusted a fully client-supplied target-user identifier with no check against `context.user.id` and no tenant scoping at all. Fixed by un-mounting the router entirely from `main.py`. Regression: `test_legacy_academic_visibility_router_is_not_mounted`, re-verified at network level via `@identity legacy academic-visibility IDOR router stays retired`.

### 3.2 HIGH — Verification-status spoofing

`IdentifierSchema.status`, `AffiliationSchema.verification_status`, `ScholarlyAssetContributorSchema.verified_status` were client-settable. Fixed: all three server-forced to `"UNVERIFIED"` on every write; identifier `verified_at`/`last_checked_at` forced to `None`. Regression: `test_verification_status_cannot_be_client_declared_verified`.

### 3.3 HIGH — PUBLISHED-only public projection was not enforced

`GET /public/{username}` filtered on `visibility == "PUBLIC"` only, independent of `lifecycle_status`. Fixed: the public query now also requires `lifecycle_status == "PUBLISHED"`. Regression: `test_public_profile_hides_unpublished_assets_even_when_visibility_public`.

### 3.4 HIGH — Self-declared portfolio editing could bypass the real editorial pipeline

`update_scholarly_asset` let the owner hand-set `lifecycle_status` on any asset they own, even one already in Publication Intelligence's real pipeline. Fixed: once any `PublicationSubmission` exists for an asset, `lifecycle_status` becomes pipeline-owned and client input is silently ignored for that field. Regression: `test_lifecycle_status_locked_once_real_submission_pipeline_exists`.

### 3.5 MEDIUM — Stored XSS via unvalidated `profile_url` scheme

Fixed at the schema boundary (`IdentifierSchema.profile_url` field validator) — only `http://`/`https://` accepted, `422` otherwise. Regression: `test_identifier_profile_url_rejects_unsafe_scheme`.

### 3.6 Accessibility — `/app/profile` and `/app/visibility*` exemption re-examined and closed

Six prior closure reports' "pre-existing baseline, out of scope" call for `/app/profile` was re-examined and found to no longer apply. A live axe run found and this round fixed: 21 unassociated `<label>`/form-control pairs, two icon-only "remove" buttons with no accessible name, the public profile's icon-only DOI link with no accessible name, and a decorative `readOnly` checklist checkbox on `/app/visibility` with no accessible name. Verified `0` serious/critical axe violations across all six relevant screens.

### 3.7 HIGH — No publication provenance distinction (this round's primary fix)

Every `PUBLISHED` scholarly asset looked equally trustworthy regardless of whether it came from Publication Intelligence's real editorial pipeline or was simply self-declared by the owner (a legitimate feature for externally-published work, but not equivalent trust). **Discovery first**: `source_module`/`source_record_id` already existed on `ScholarlyAsset` but are generic, client-writable origin tags used across multiple domains (research lifecycle, thesis workflow) — unsuitable for a trustworthy verification signal. No suitable existing field was found. **Decision**: rather than persist a new column (which would need migration + backfill + ongoing synchronization risk if a submission is later withdrawn), publication provenance is **computed live** at every read from the existing `PublicationSubmission.asset_id` relationship — `compute_publication_provenance()`/`publication_provenance_label()` in `academic_foundation.py`. Result: `None` before `PUBLISHED`; `"BASEERAH_PIPELINE_VERIFIED"` if a real `PublicationSubmission` exists for the asset; `"SELF_DECLARED"` otherwise. The new `publication_verification_status` response field exists on `ScholarlyAssetResponse`/`PublicScholarlyAssetResponse` only — **no corresponding input field exists anywhere**, so a client cannot spoof, promote, or downgrade it by construction, not merely by a server-side override rule. No historical backfill was needed (nothing is stored). Regression: `test_publication_provenance_self_declared_vs_pipeline_verified`, `test_publication_provenance_cannot_be_client_spoofed`; e2e `@identity self-declared published work is labeled SELF_DECLARED, not pipeline-verified`.

### 3.8 HIGH — Unified Search exposed other researchers' unpublished work to same-org peers

`AssetProvider.build_base()` filtered only on `organization_id` match OR ownership — with no `lifecycle_status` check, any same-org member could discover (via title/content search, and via domain result counts) another researcher's `DRAFT`/`UNDER_REVIEW`/`ACCEPTED` manuscript through General Unified Search, despite the public profile projection (§3.3) correctly hiding the same content. This is explicitly **not** the same surface as `list_scholarly_assets` (the internal, org-wide catalogue Publication Intelligence and Promotion depend on directly — neither references the Search service at all, confirmed by grep, so neither was touched — §13.1). Fixed: `AssetProvider.build_base()` now requires `lifecycle_status == "PUBLISHED" AND visibility == "PUBLIC"` for any asset not owned by the searcher; the owner branch is unchanged (an owner can still find their own unpublished work). Because `count()`/facets/snippets all derive from the same filtered query object (verified by reading the search dispatch loop directly, not assumed), this single fix closes result leakage, count leakage, and snippet leakage simultaneously. Regression: `test_search_asset_hides_other_users_unpublished_work_same_tenant` (results, `domain_counts`, and full result list all asserted empty), `test_search_asset_owner_can_still_find_own_unpublished_work`; e2e `@identity Unified Search hides a same-org colleague's unpublished manuscript`.

### 3.9 MEDIUM — Search navigation opened the searcher's own profile editor instead of the matched researcher's public profile

`ProfileProvider.project()` hardcoded `target="/app/profile"` regardless of whose profile matched — clicking another user's public search result silently opened the searcher's own private editor instead. Fixed: `target` is now `"/app/profile"` only when the row belongs to the caller; otherwise `f"/researcher/{username}"`, safe because a non-self row only ever reaches `project()` after `build_base()` has already proven `visibility_status == "PUBLIC"`. `joinedload(UnifiedAcademicProfile.user)` added to `build_base()` to avoid an N+1 lazy-load per result row. Regression: `test_search_profile_navigation_targets_public_profile_for_other_user`; e2e `@identity Unified Search navigates to a colleague's public profile, not the searcher's own editor`.

---

## 2. Personas

| Persona | What they can do |
|---|---|
| Profile Owner (any authenticated user) | Full CRUD on their own profile/identifiers/affiliations/scholarly assets — scoped to `context.user.id` by construction, no target-user parameter exists anywhere in this router |
| Public Visitor (unauthenticated) | `GET /public/{username}` and `/public/{username}/photo` only — a genuinely separate, server-constructed, metadata-safe projection (§4) |
| Same-Organization Researcher | Can discover another member's `PUBLIC`-visibility profile and `PUBLISHED`+`PUBLIC` scholarly assets via Unified Search (§3.8); cannot discover their unpublished work; cannot read private profile fields through any code path |
| Organization Admin | **No dedicated authority in this router at all** — no admin/oversight GET, no cross-user edit, no institutional dashboard endpoint exists yet (§9) |
| Platform Operator | Same as Organization Admin — no code path grants platform-wide staff any private Academic Identity access |

No Research Office / Executive Viewer persona exists in this domain's code today; not fabricated here. If institutional delegation is introduced later, see §11.

---

## 3. Account Contexts

```
INDIVIDUAL           — a user acting on their own profile/assets (the only context every
                        write endpoint in this router actually operates under)
ORGANIZATION_MEMBER   — a user acting within an active organization context (X-Organization-ID),
                        gates the Unified-Search-visible slice of another member's PUBLISHED work
PUBLIC_VISITOR        — unauthenticated, gated to /public/{username} and its photo endpoint only
PLATFORM_OPERATOR     — exists platform-wide (User.role / is_global_admin) but carries no special
                        authority anywhere in this domain (§9)
```

---

## 4. Scopes

```
OWN_PROFILE                 — UnifiedAcademicProfile where user_id == caller
PUBLIC_PROFILE               — UnifiedAcademicProfile where visibility_status == PUBLIC
OWN_SCHOLARLY_ASSETS         — ScholarlyAsset where owner_user_id == caller (any lifecycle_status)
PUBLIC_SCHOLARLY_ASSETS       — ScholarlyAsset where lifecycle_status == PUBLISHED AND visibility == PUBLIC
ORGANIZATION_ASSET_CATALOGUE — ScholarlyAsset where organization_id == caller's org (internal
                                catalogue use only — list_scholarly_assets; NOT the scope Unified
                                Search operates under, see §13)
```

---

## 5. Permission Registry

```
academic_identity.profile.view_own
academic_identity.profile.edit_own
academic_identity.profile.view_public

academic_identity.identifier.manage_own
academic_identity.affiliation.manage_own

academic_identity.asset.create_own
academic_identity.asset.edit_own
academic_identity.asset.view_own
academic_identity.asset.view_public
academic_identity.asset.view_org_catalogue   (internal catalogue scope — §13)

academic_identity.visibility.manage_own
```

This is requirements discovery, not a permission-engine migration — the existing code enforces every one of these implicitly through direct `context.user.id`/visibility/lifecycle checks, not through a named-permission lookup table.

---

## 6. Sensitive Permission Registry

```
academic_identity.profile.view_private     — RESERVED: no code path grants this to anyone but the
                                              owner; not implemented as a grantable permission because
                                              nothing needs to grant it (§9)
academic_identity.identifier.verify        — NOT IMPLEMENTED: no live verification authority exists (§10)
academic_identity.affiliation.verify       — NOT IMPLEMENTED: same
academic_identity.publication.verify       — PARTIALLY IMPLEMENTED: server-computed, not a grantable
                                              permission — see §10's BASEERAH_PIPELINE_VERIFIED authority
academic_identity.metric.verify            — NOT APPLICABLE: no bibliometric/citation feature exists
                                              in this domain at all (§17)
```

---

## 7. Resource Relationships

```
owner_of_profile              — UnifiedAcademicProfile.user_id == User.id  (1:1, unique constraint)
owner_of_scholarly_asset      — ScholarlyAsset.owner_user_id == User.id   (1:many)
author_of_scholarly_asset     — ScholarlyAssetContributor.user_id == User.id (optional, may be
                                 an external_name-only contributor with no platform account)
public_profile_of             — computed at read time: User.username -> UnifiedAcademicProfile
                                 (join, not a stored FK — see /public/{username})
member_of_organization        — OrganizationMembership.user_id == User.id, .organization_id == Organization.id
                                 (gates the same-tenant slice of Unified Search visibility, §3.8)
publication_pipeline_link     — PublicationSubmission.asset_id == ScholarlyAsset.id (existence of
                                 at least one row is what makes an asset's lifecycle_status
                                 pipeline-owned, §3.4, and its provenance BASEERAH_PIPELINE_VERIFIED, §3.7)
```

---

## 8. Sensitive Boundaries

```
Private profile fields (institutional_email, phone, internal user_id, organization_id, visibility_status itself)
Unverified identifiers (never representable as verified — §3.2)
Unverified affiliations (same)
Unpublished scholarly assets (DRAFT/UNDER_REVIEW/ACCEPTED — never public, §3.3; never Search-discoverable
                              to non-owners, §3.8)
Self-declared publication claims (never representable as pipeline-verified — §3.7)
Publication provenance internals (submission IDs, reviewer data, editorial notes — never exposed even
                                   though the provenance LABEL itself is safe to expose, §3.7)
```

---

## 9. Verification Authorities

This section is the direct answer to "who is authoritative for what," verified by absence as much as by presence:

```
Live Identifier Verification Authority:        NONE  (no ORCID OAuth or equivalent exists anywhere
                                                        in this codebase — verification_method values
                                                        are SELF_DECLARED/MANUAL only)
Live Affiliation Verification Authority:       NONE
External Publication Verification Authority:   NONE  (no Scopus/WoS/Google Scholar/Crossref integration)

Baseerah Publication Pipeline Authority:       AUTHORITATIVE, but ONLY for assets that actually have
                                                a PublicationSubmission row (§3.4, §3.7) — this is a
                                                real, existing, server-computed authority (Publication
                                                Intelligence's own editorial state machine), not a new
                                                verification system built for this closure.

Organization Admin:                            NO verification authority in this domain (§9.1)
Platform Admin:                                NO verification authority in this domain (§9.1)
```

### 9.1 Platform / Organization Admin Boundary

No admin/oversight endpoint of any kind exists in `academic_foundation.py` — every endpoint is either strictly self-scoped (`context.user.id`, no target-user parameter accepted from the client anywhere) or strictly public-and-visibility-gated. `platform.admin`/`organization.admin DOES NOT IMPLY academic_identity.profile.view_private` (§16) holds trivially, by the complete absence of any such code path — not merely by a passing test. `AcademicVisibilityDashboard.tsx`/`AcademicVisibilityReports.tsx` are self-service tools operating only via `apiGetMyProfile`/`apiListScholarlyAssets`; no institutional-aggregate dashboard exists yet (§17).

---

## 10. Approval Authorities

```
Profile visibility (PUBLIC/INSTITUTIONAL/PRIVATE):  owner only, self-service, no approval step
Identifier / affiliation data:                      owner only, self-service; verification status is
                                                     ALWAYS server-forced UNVERIFIED regardless of any
                                                     approval, since no approval authority exists (§3.2)
Publication claim / provenance:                     NOT an owner-settable approval — provenance is
                                                     computed, never approved or declared (§3.7);
                                                     lifecycle_status specifically becomes
                                                     pipeline-owned (no owner self-approval at all)
                                                     once Publication Intelligence's own submission
                                                     workflow has taken over an asset (§3.4)
```

---

## 11. Delegation Requirements

`NONE IMPLEMENTED.` No code path lets one user act as another in this domain. A future requirement worth naming for the unified IAM architecture — not built, not assumed, not a blocker for this closure: **Research Office acting on behalf of a researcher** (e.g., bulk-correcting an affiliation record) would need an explicit, audited delegation grant, distinct from `organization.admin`, which this domain deliberately does not treat as implying any Academic Identity authority (§9.1).

---

## 12. Institutional Hierarchy Requirements

`NOT REQUIRED FOR CURRENT DOMAIN ENFORCEMENT.` No endpoint in this domain branches on department/college/university hierarchy — `university`/`college`/`department` are free-text profile fields, not an enforced organizational tree. Future dependency worth naming: if an institutional aggregate dashboard (§17) is ever built, it would need a real hierarchy model to scope "my department's researchers" correctly — does not exist today.

---

## 13. Cross-Domain IAM Dependencies (Non-Implications)

```
platform.admin                          DOES NOT IMPLY academic_identity.profile.view_private   (§9.1, no such code path exists at all)
organization.admin                      DOES NOT IMPLY academic_identity.profile.view_private   (§9.1, no such code path exists at all)
publication.manuscript.edit             DOES NOT IMPLY academic_identity.profile.edit           (disjoint routers/authorization; ScholarlyAsset ownership is the only shared axis, and that is owner-scoped in both)
publication.submission.status=ACCEPTED  DOES NOT IMPLY academic_identity.publication.visible    (§3.3 — PUBLISHED-only public projection)
publication.pipeline.PUBLISHED          DOES NOT IMPLY academic_identity.profile.edit           (pipeline authority is scoped strictly to the one ScholarlyAsset row, never to the owning profile)
promotion.committee.evaluate            DOES NOT IMPLY academic_identity.profile.view_private   (Promotion's committee authority operates on PromotionApplication only; no cross-reference into UnifiedAcademicProfile exists in promotions.py)
academic_identity.identifier.manage_own DOES NOT IMPLY academic_identity.identifier.verify      (§3.2 — status is always server-forced UNVERIFIED)
academic_identity.affiliation.manage_own DOES NOT IMPLY academic_identity.affiliation.verify    (§3.2, same rule)
academic_identity.asset.create_own      DOES NOT IMPLY academic_identity.publication.verify     (a self-declared PUBLISHED asset is never automatically BASEERAH_PIPELINE_VERIFIED, §3.7)
academic_identity.profile.edit_own      DOES NOT IMPLY academic_identity.publication.publish    (lifecycle_status is pipeline-locked once real submission exists — §3.4)
academic_identity.asset.lifecycle_status=PUBLISHED DOES NOT IMPLY academic_identity.publication.verification=VERIFIED  (§3.7 — the entire point of the provenance model added this round)
```

### 13.1 General Unified Search vs. Internal Scholarly-Asset Catalogue (formal boundary statement)

`ScholarlyAsset`'s internal catalogue (`list_scholarly_assets`, used by the owner's own portfolio view) currently has broader same-tenant visibility (any `lifecycle_status`, org-wide) than General Unified Search now provides (§3.8 — `PUBLISHED`+`PUBLIC` only for non-owners). **This is a deliberate, documented cross-domain architectural boundary**, not an inconsistency to reconcile: the internal catalogue serves collaboration/administrative use cases (Publication Intelligence and Promotion's evidence picker both depend on it directly, unchanged this round — §3.8's own scope explicitly excluded touching it), while General Unified Search is a discovery surface with a public-facing trust model. Future Cross-Domain IAM Consolidation should treat these as two distinct scopes (§4: `ORGANIZATION_ASSET_CATALOGUE` vs. `PUBLIC_SCHOLARLY_ASSETS`), not attempt to unify them into one permission.

---

## 14. Endpoint Authority Matrix

| Endpoint | Authority | Response shape |
|---|---|---|
| `GET /profile/me` | any authenticated user, self only (auto-creates empty profile) | full |
| `POST /profile/upsert` | any authenticated user, self only; identifiers/affiliations verification fields server-forced (§3.2) | full |
| `GET /public/{username}` | unauthenticated; requires `visibility_status == "PUBLIC"` | `PublicProfileResponse` — distinct, metadata-safe; assets carry `publication_verification_status` (§3.7) |
| `GET /public/{username}/photo` | unauthenticated; same visibility gate; `storage_key` is DB-sourced, not client-supplied (no path traversal) | file stream |
| `POST /scholarly-assets`, `PUT /scholarly-assets/{id}` | owner only (`403` otherwise); `lifecycle_status` pipeline-locked once submitted (§3.4); contributor `verified_status` server-forced (§3.2); `publication_verification_status` is output-only, no input field exists for it anywhere (§3.7) | full, provenance included |
| `GET /scholarly-assets` (list, internal catalogue) | org-wide (`organization_id` match) OR owner — **consistent, deliberate precedent** for the internal catalogue specifically, not a new defect (§13.1); provenance included per row | full (org members), full (owner) |
| `GET /scholarly-assets/{id}`, `DELETE /scholarly-assets/{id}` | org-or-owner read; owner-only write | full / 403 |
| `GET /api/search?domains=ASSET` (Unified Search) | owner sees own assets at any status; non-owner sees only `PUBLISHED`+`PUBLIC` same-org assets (§3.8, tightened this round) | `SearchResultItem` projection, no provenance field (out of this fix's scope) |
| `GET /api/search?domains=PROFILE` (Unified Search) | owner sees own row at any visibility; non-owner sees only `PUBLIC` same-org profiles; `target` now correctly routes to the matched user's public profile for non-self results (§3.9) | `SearchResultItem` projection |
| `GET/POST /api/academic-visibility/*` (legacy) | **retired — 404 unconditionally** (§3.1) | n/a |

---

## 15. Academic Identity Access Matrix

| Viewer \ Resource | Own Private Profile | Other's Private Profile | Public Profile | Own Unpublished Assets | Other's Unpublished Assets | Public Published Assets | Identifiers/Affiliations (own) |
|---|---|---|---|---|---|---|---|
| Profile Owner | FULL | — | — | FULL | — | — | FULL |
| Same-Tenant Researcher | — | BLOCKED | VIEW (if PUBLIC) | — | BLOCKED (§3.8) | VIEW | — |
| Public Visitor | — | BLOCKED | VIEW (if PUBLIC) | — | BLOCKED | VIEW | — |
| Organization Admin | — | BLOCKED (§9.1) | VIEW (if PUBLIC) | — | BLOCKED | VIEW | — |
| Platform Admin | — | BLOCKED (§9.1) | VIEW (if PUBLIC) | — | BLOCKED | VIEW | — |
| Cross-Tenant User | — | BLOCKED | BLOCKED (Search); VIEW via direct public URL only (public projection is username-scoped, not tenant-scoped by design — same as any public web page) | — | BLOCKED | BLOCKED (Search, §3.8); VIEW via direct public URL | — |

---

## 16. Sensitive Access Matrix

| Field / Claim | Owner | Same-Tenant Peer | Public Visitor | Org/Platform Admin |
|---|---|---|---|---|
| Institutional email | VIEW | BLOCKED | BLOCKED | BLOCKED |
| Phone | VIEW | BLOCKED | BLOCKED | BLOCKED |
| Internal user/org IDs | VIEW (own) | BLOCKED | BLOCKED | BLOCKED |
| Unpublished manuscript content | VIEW (own) | BLOCKED (§3.8) | BLOCKED | BLOCKED |
| Under-review manuscript content | VIEW (own) | BLOCKED (§3.8) | BLOCKED | BLOCKED |
| Accepted-not-published content | VIEW (own) | BLOCKED (§3.8) | BLOCKED | BLOCKED |
| Self-declared publication provenance label | VIEW | VIEW (via public projection only) | VIEW | VIEW (via public projection only) |
| Pipeline-verified publication provenance label | VIEW | VIEW (via public projection only) | VIEW | VIEW (via public projection only) |
| Identifier verification status | VIEW | VIEW (public-safe subset) | VIEW (public-safe subset) | VIEW (public-safe subset) |
| Affiliation verification status | VIEW | VIEW (public-safe subset) | VIEW (public-safe subset) | VIEW (public-safe subset) |

Provenance/verification-status *labels* are intentionally not treated as sensitive (they carry no PII and their entire purpose is public-facing honesty about trust level) — what is sensitive and blocked everywhere except the owner is the underlying *content* (manuscript text, private contact fields), never the label.

---

## 17. Deferred / Not Built (explicitly out of scope, not silently claimed)

- Live ORCID OAuth or any other external identifier-verification integration.
- Scopus / Web of Science / Google Scholar / commercial bibliometrics integration.
- AI-assisted profile drafting/summarization — `services/ai/context_builder.py` and `use_cases.py` grepped in full this round again: zero references to any Academic Identity model, unchanged.
- Institutional aggregate dashboard for org/platform admins (§9.1, §12).
- Search does not surface `INSTITUTIONAL`-visibility profiles to same-org peers — safe-by-default functional gap, not a leak, unchanged this round (out of this micro-closure's four-item mandate).
- `ScholarlyAssetContributor.orcid`/`affiliation_text` and `PublicationManuscriptAuthorship`'s equivalent fields remain free-text duplicates rather than references into `AcademicIdentifier`/`AcademicAffiliation` — a real cross-domain integration gap, deliberately not rewired to avoid touching Publication Intelligence's own models.
- No uniqueness constraint on `AcademicIdentifier.identifier_value` — acceptable while every identifier is server-forced `UNVERIFIED` (§3.2): nothing verified to protect yet.
- A dedicated UI "verified" badge — the API now carries truthful provenance (§3.7), but no Design System badge component was built to display it, since no prior UI surface claimed verification status for scholarly assets at all (§16's own note: nothing was falsely claiming verification before, so there is no UI regression to fix — this is a net-new, honest signal available to any future UI work, not a corrected lie).
- Global IAM.

## 17.1 Pre-Existing, Unrelated Flakes Observed During Regression (Not This Domain's Mandate)

`tests/e2e/responsive-routes.spec.ts`'s `/saas/workspaces` route intermittently fails its "renders a `<main>` landmark" assertion (observed on different viewports across separate runs — a timing race in that unrelated SaaS-infrastructure page's own load sequence, not a viewport-specific bug). `openpyxl` is missing from the backend venv, failing one unrelated Research Data test. Neither is touched by this domain's changes; both remain disclosed rather than silently fixed or silently hidden.

---

## 18. Test Coverage Summary

Backend (`test_academic_foundation.py`, 8 tests; `test_academic_visibility.py`, 1 test; `test_unified_search.py`, 46 tests including 3 new this round) — verification spoofing block, unsafe-URL-scheme rejection, PUBLISHED-only public projection, pipeline lifecycle lock, publication provenance (self-declared vs. pipeline-verified, and un-spoofable by construction), Unified Search asset-privacy (same-tenant colleague cannot discover unpublished work; owner unaffected), Unified Search profile-navigation correctness, tenant isolation, full CRUD lifecycle, legacy-router retirement. No schema/migration change was required this round — publication provenance is computed live from the existing `PublicationSubmission` relationship rather than persisted, deliberately avoiding backfill/staleness risk (§3.7) — so alembic head remains unchanged (`208eef3f1888`) and the full PostgreSQL migration gate was correctly not re-run, consistent with not re-running it absent a schema change.

E2E (`tests/e2e/academic-identity-impact.spec.ts`, 37 tests, all passing): Researcher Workspace Journey, Public Profile Journey, network-level privacy payload assertions, IDOR/spoofing regression, publication provenance assertion, Unified Search asset-privacy and navigation-correctness assertions (both new this round), keyboard-only reachability, axe (0 serious/critical across general/identifiers/affiliations tabs, the public page, and both Visibility-module screens), RTL/LTR (app + public), responsive 320–2560px, reduced-motion.
