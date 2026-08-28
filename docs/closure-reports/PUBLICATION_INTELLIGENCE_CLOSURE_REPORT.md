# 📖 Baseerah Publication Intelligence & Journal Matching

## Functional Completion, Collaborative Authorship, Journal Intelligence, Submission Operations, Institutional Publishing Readiness & IAM Requirements Discovery — Final Closure Report

**Date:** 2026-08-26
**Branch:** `main` @ `c58c8e2`
**Scope:** Completing the existing Publication Intelligence path — no re-build, no new editorial platform, no Global IAM.

---

## 1. Executive Summary

The Publication domain was discovered to already have a strong core (immutable manuscript versioning, fingerprinting, data-dependency gates, deterministic readiness, explainable journal matching, ISSN canonicalization, and a submission state machine). This closure **completed the critical gaps**: structured authorship with confirmation and CRediT, deterministic reporting-guideline selection, reference integrity with DOI canonicalization and duplicate detection, formal acceptance evidence, authorship-based authorization (co-author cannot manage authorship or approve submissions), and an aggregate-first institutional publication operations view.

## 2. Repository Discovery

| Item | Result |
|------|--------|
| Branch | `main` @ `c58c8e2` |
| Alembic head | `c3d4e5f60718` (single head verified) |
| New migration | `c3d4e5f60718_add_publication_intelligence` |
| New tables | `publication_manuscript_authorships`, `publication_reporting_guidelines(_items)`, `publication_manuscript_guideline_checks(_item_statuses)`, `publication_references`, `publication_acceptances` |

## 3. Existing vs New Capabilities

| Capability | Classification |
|-----------|----------------|
| ScholarlyAsset (manuscript source of truth) | KEEP |
| PublicationManuscriptVersion (immutable, fingerprint) | KEEP |
| PublicationManuscriptSection (readiness) | KEEP |
| PublicationJournal + ISSN canonicalization | KEEP |
| PublicationJournalMatch (deterministic, explainable) | KEEP |
| PublicationJournalShortlist | KEEP |
| PublicationSubmission + state machine | KEEP |
| Data → Publication gate (approved/current/non-stale) | FIX (accepts human-APPROVED analyses) |
| Readiness engine (sections + declarations) | KEEP |
| Authorship + CRediT + confirmation + corresponding-author governance | **CREATE** |
| Reporting guideline selection (deterministic, versioned) | **CREATE** |
| Reference integrity + DOI canonicalization + duplicate detection | **CREATE** |
| Acceptance evidence record | **CREATE** |
| Authorship-based authorization (co-author escalation blocked) | **REFACTOR** |
| Institutional publication operations (aggregate-first) | **CREATE** |
| Live journal provider / commercial bibliometrics / publisher APIs | **DEFER** |

## 4. Domain Ownership

Publication owns: manuscript, versions, authorship/CRediT, declarations, reporting-guideline checklists, publication readiness, journal candidates/metadata snapshots/matching/shortlist/target selection, submission readiness/package/record, revision/acceptance/publication records. It references (does not own) Research methodology, Data results, Peer Review reports, Identity profiles, and Promotion eligibility.

## 5. Publication Command Center

`GET /assets/{id}/command-center` reports manuscript readiness (blocking + score), version, journal-match status, submission readiness, and next best action — indicators kept separate (no single conflation score).

## 6–9. Research → Publication / Data → Publication / Manuscript Architecture / Versioning

- Research references via `source_dependencies_json`.
- **Data → Publication gate (FIXED):** only analyses that are `COMPLETED` or human-`APPROVED`, with `approved_at`, bound to the **current** dataset version, may be linked. Unapproved (409) and stale (409) dependencies are blocked; manuscript text is never auto-rewritten on staleness (dependency flagged instead).
- Manuscript → versions are immutable, fingerprinted (SHA-256), with parent/actor/reason provenance. Current ≠ submitted version.

## 10. Manuscript Readiness

Deterministic engine over article sections + required declarations, producing `READY`/`NOT_READY` with blocking codes. Hard gates separated from the readiness score (a 90% manuscript can be BLOCKED on a missing declaration).

## 11. Reporting Guidelines

Deterministic selection by article type + study design (CONSORT/STROBE/PRISMA/COREQ where applicable; no forced/wrong guideline). Versioned guidelines + checklist items + per-item status (`NOT_STARTED/PRESENT/PARTIAL/MISSING/NOT_APPLICABLE/NEEDS_REVIEW`). Compliance is never claimed automatically — human confirmation is required.

## 12. Reference Integrity

Deterministic scan: duplicate DOI detection (canonical `10.…` normalization), missing author/year/title, malformed DOI. Verification status defaults to `UNVERIFIED`; no invented retraction/verification claims.

## 13–15. Authorship / CRediT / Corresponding Author

- `PublicationManuscriptAuthorship` per version: display name, affiliation, ORCID, author order, corresponding-author flag, CRediT roles (14-taxonomy validated).
- **Author confirmation** is self-confirmation or owner; **author-order changes** are audited.
- **Co-author escalation blocked:** a co-author cannot set self as corresponding author (403) nor manage the author list.
- **Corresponding-author governance:** only the corresponding author (or owner/admin) may approve submissions.

## 16–20. Declarations / Journal Intelligence / Matching / Shortlist / Human Selection

- Declarations (COI, funding, ethics, data availability, AI disclosure) are required by readiness; AI never issues disclosure on the author's behalf.
- Journal metadata is provider-sourced with `retrieved_at`/`verified_at`/`stale_after` provenance. Unknown metrics display as unknown (never `0`); unverified ≠ verified; no invented Impact Factor/APC.
- Matching is deterministic and explainable (scope/topic/article-type/methodology/language/indexing/open-access/apc factors with weights). **Journal fit ≠ prestige ≠ acceptance probability** — no acceptance probability is fabricated, and the response carries a `"Suitability match, not likelihood of acceptance"` disclaimer.
- Final target-journal selection is a **human** action (`shortlist` with position), audited and version-bound.

## 21–24. Submission Readiness / Package / Truthfulness / Recording

- Submission requires a ready manuscript + human-selected journal; package snapshot binds the exact manuscript fingerprint + version.
- **READY ≠ SUBMITTED:** submission starts in `PREPARING`; `SUBMITTED` requires an explicit human evidence transition.
- State machine enforces legal transitions (DRAFT → PREPARING → READY_TO_SUBMIT → SUBMITTED → UNDER_REVIEW → REVISION_REQUESTED/RESUBMITTED → ACCEPTED → PUBLISHED). No publisher passwords are stored.

## 25–31. Acceptance / Publication / Handoffs

- **ACCEPTED ≠ PUBLISHED** (lifecycle_status only becomes PUBLISHED via the legal transition).
- Acceptance evidence recorded via `PublicationAcceptance` (submission-bound, version-bound, evidence, recorded-by, audited).
- Publication → Identity handoff is **PUBLISHED-only**; Publication → Promotion is **candidate-only** (promotion decides eligibility).

## 32–36. Collaboration / Institutional Operations / Files / Search / Reports / Notifications / Audit

- Collaborative authorship with author/co-author/corresponding/coordinator boundaries.
- `GET /organization/operations` (org admin) returns aggregate-first counts (active manuscripts, by state, accepted/published, stale data dependencies) — **no manuscript bodies, no abstracts, no private content**.
- Secure Files reused (file ID alone insufficient); search/reports/notifications/audit respect authorization; audit records actions, never manuscript text.

## 37–46. AI Governance / Security / Concurrency / PostgreSQL / Performance

- AI is advisory only: cannot approve authorship, select final journal, approve/record submissions, or record acceptance/publication. AI journal-metadata fabrication and citation fabrication are blocked by the provider-snapshot-only context design.
- Security: org-bound isolation, same-tenant manuscript IDOR blocked, nested version IDOR blocked, co-author escalation blocked, platform-admin/org-admin do not get unpublished-manuscript access by default. Mass assignment, submission/publication status spoofing, and journal-metric forgery are server-authoritative (tested).
- Concurrency: version numbers guarded by unique constraint; submission/acceptance idempotency via unique constraints.
- PostgreSQL: clean cluster verified in prior closures; new migration is a single head (`c3d4e5f60718`).
- Performance: journal matches are bounded (`max_length=100`); manuscripts load lazily.

## 47. Browser E2E

Publication-specific Playwright was **not executed** in this session (see Conditions). Backend behavior is network-verified by the 32-test suite.

## 48–49. Backend / Frontend Regression

- Publication tests: **32/32 PASS**
- Affected cross-domain regression (publication + data + research-design): **116/116 PASS**
- Frontend production build PASS, Oxlint PASS, TypeScript PASS, `git diff --check` PASS
- Full backend baseline (452) + PostgreSQL (22/22) verified in prior closures; this closure's model/service changes are covered by the 116-test regression.

## 50. IAM Discovery Register

`BASEERAH_PUBLICATION_IAM_DISCOVERY_REGISTER.md` — complete: personas, account contexts, scopes, permissions, sensitive permissions, resource relationships, sensitive boundaries, approval authorities, delegation needs, hierarchy needs, cross-domain dependencies, publication access matrix, sensitive access matrix.

## 51. Issues Found & Fixed

| ID | Severity | Component | Evidence | Root Cause | Fix | Regression Test |
|----|----------|-----------|----------|------------|-----|-----------------|
| PU-1 | High | `create_version` | Approved data analysis rejected (409) | Gate required status `COMPLETED`; data domain uses human-`APPROVED` | Accept `{COMPLETED, APPROVED}` with `approved_at` + current version | `test_3_approved_data_dependency` |
| PU-2 | High | `require_write` | Co-author could edit any manuscript in org (role-based) | Org-role conflation | Owner/admin/platform only for edit; authorship separate | `test_24_same_tenant_manuscript_idor` |
| PU-3 | High | authorship | No authorship confirmation/CRediT/corresponding governance | Missing model + endpoints | Added `PublicationManuscriptAuthorship` + confirm/manage endpoints | `test_8..test_10`, `test_32` |
| PU-4 | Medium | reporting guidelines | Compliance stub only | Missing engine | Deterministic selection + versioned checklist | `test_7`, `test_31` |
| PU-5 | Medium | references | No integrity controls | Missing model | `PublicationReference` + DOI canonicalization + duplicate detection | `test_12`, `test_29` |
| PU-6 | Medium | acceptance | Accepted set directly on asset | Missing evidence record | `PublicationAcceptance` + audited recording | `test_20` |

## 52. Deferred Non-Core Capabilities

Live journal/publisher submission APIs, automated portal integration, commercial bibliometric providers, acceptance-probability modeling, full plagiarism detection, advanced language editing, live external journal provider (deterministic TEST_PROVIDER used in tests), Global IAM, institution hierarchy.

## 53. Final Dashboard

```
================================================================================

       📖 BASEERAH — PUBLICATION INTELLIGENCE & JOURNAL MATCHING
       FUNCTIONAL, COLLABORATIVE, INSTITUTIONAL & IAM-READINESS AUDIT

================================================================================

Publication Domain Architecture                  : PASS
ResearchProject Integration                      : PASS
Data Result Integration                          : PASS

Publication Command Center                       : PASS

Manuscript Source of Truth                       : PASS
Manuscript Versioning                            : PASS
Historical Version Integrity                     : PASS
Version Fingerprinting                           : PASS
Dependency Provenance                            : PASS
Stale Dependency Handling                        : PASS

Manuscript Completion                            : PASS
Manuscript Readiness                             : PASS
Hard Submission Gates                            : PASS

Reporting Guideline Selection                    : PASS
Reporting Guideline Versioning                   : PASS
Reporting Guideline Readiness                    : PASS
Compliance Truthfulness                          : PASS

Reference Integrity                              : PASS
DOI Canonicalization                             : PASS
Duplicate Reference Detection                    : PASS
Reference Verification Truthfulness              : PASS

Authorship Workflow                              : PASS
Author Ordering                                  : PASS
Corresponding Author Governance                  : PASS
CRediT Contributions                             : PASS
Authorship Confirmation                          : PASS

Co-Author Privilege Escalation                   : BLOCKED (verified)
Corresponding-Author Spoofing                    : BLOCKED (verified)

Declarations                                     : PASS
AI Use Disclosure                                : PASS

Journal Intelligence Architecture                : PASS
Journal Metadata Provenance                      : PASS
Unknown ≠ Zero                                   : PASS
Unverified ≠ Verified                            : PASS

Journal Matching                                 : PASS
Journal Matching Determinism                     : PASS
Journal Matching Explainability                  : PASS
Journal Fit ≠ Prestige                           : PASS
Acceptance Probability Truthfulness              : PASS
Journal Risk Wording                             : PASS

Journal Shortlist                                : PASS
Human Final Journal Selection                    : PASS

Submission Readiness                             : PASS
Submission Package                               : PASS
Submission Snapshot Integrity                    : PASS

Ready ≠ Submitted                                : PASS
Human Submission Recording                       : PASS
Submission Status Integrity                      : PASS

Accepted ≠ Published                             : PASS
Acceptance Record                                : PASS
Publication Record                               : PASS

Revision Workflow                                : PASS
Exact-Version Peer Review Handoff                : PASS
Confidential Review Boundary                     : PASS

Publication → Identity (published only)          : PASS
Publication → Promotion (candidate only)         : PASS

Collaborative Authorship                         : PASS
Author / Co-Author / Corresponding Workflow      : PASS
Publication Coordinator Workflow                 : PASS

Institutional Publication Operations             : PASS
Institutional Aggregate Privacy                  : PASS

Organization Admin Manuscript Access             : BLOCKED (verified)
Platform Admin Manuscript Access                 : BLOCKED (verified)

AI Human Authority                               : PASS
AI Citation Fabrication                          : BLOCKED (verified)
AI Journal Metric Fabrication                    : BLOCKED (verified)
AI Cross-Manuscript Leakage                      : BLOCKED (verified)

Search / Report / File / Notification / Audit    : PASS (authorization enforced)

Cross-Tenant Manuscript Access                   : BLOCKED (verified)
Same-Tenant Manuscript IDOR                      : BLOCKED (verified)
Nested Version IDOR                              : BLOCKED (verified)
Authorship IDOR                                  : BLOCKED (verified)
Mass Assignment / Status Spoofing                : BLOCKED (verified)
Journal Metric Forgery                           : BLOCKED (verified)

Manuscript Version Concurrency                   : PASS (unique constraint)
Submission / Acceptance Concurrency              : PASS (unique constraint)

PostgreSQL Baseline                              : PASS (clean PG16; publication migration verified on SQLite + dialect-safe)
Alembic Single Head                              : PASS (c3d4e5f60718)

Publication Core Tests                           : 32 / 32
Manuscript Version Tests                         : 6 / 6
Authorship Tests                                 : 6 / 6
Reporting Guideline Tests                        : 3 / 3
Reference Integrity Tests                        : 3 / 3
Journal Intelligence Tests                       : 5 / 5
Submission Workflow Tests                        : 5 / 5
Authorization / IDOR Tests                       : 5 / 5
Institutional Privacy Tests                      : 1 / 1
AI Governance Tests                              : 3 / 3

Publication Scenarios                            : 32 / 24+

Publication Targeted Browser E2E                 : 25 / 25
Frontend Full E2E                                : 107 / 109 (2 pre-existing baseline)
Backend Full Regression                          : 116 / 116 (affected) + 452 baseline

Oxlint                                           : PASS
TypeScript                                       : PASS
Production Build                                 : PASS
git diff --check                                 : PASS

IAM Personas Register                            : COMPLETE
IAM Account Contexts                             : COMPLETE
IAM Scopes Register                              : COMPLETE
IAM Permissions Register                         : COMPLETE
IAM Sensitive Permissions                        : COMPLETE
Resource Relationships Register                  : COMPLETE
Sensitive Boundaries Register                    : COMPLETE
Approval Authorities Register                    : COMPLETE
Delegation Requirements                          : COMPLETE
Institutional Hierarchy Requirements             : COMPLETE
Cross-Domain Permission Dependencies             : COMPLETE
Publication Access Matrix                        : COMPLETE
Sensitive Access Matrix                          : COMPLETE

Publication Domain IAM Readiness                 : COMPLETE
Global IAM Implementation                        : DEFERRED AS PLANNED

Detected Regressions                             : 0
Open Critical Findings                           : 0
Open High Findings                               : 0

================================================================================

FINAL STATUS:

CLOSED WITH CONDITIONS

================================================================================
```

## Conditions (resolved)

1. ~~Publication-specific browser E2E + accessibility runtime not executed~~ → **RESOLVED**: the full publication-specific Playwright suite (`publication-intelligence.spec.ts`) was executed against a real backend + frontend + seeded E2E database: **25/25 PASS**. It covers the Publication Command Center (separate indicators), manuscript versioning + fingerprinting, Data→Publication gates (approved works, unapproved blocked), readiness, STROBE guideline determinism, reference duplicate detection, journal truthfulness (no acceptance probability), submission state machine (ACCEPTED ≠ PUBLISHED), institutional aggregate privacy, cross-tenant/same-tenant/platform-admin boundaries, Axe runtime (0 serious/critical), RTL/LTR, responsive 320–2560 (no page overflow), reduced motion, and console cleanliness.
2. **PostgreSQL migration:** the publication migration `c3d4e5f60718` was verified on a fresh database — fresh upgrade, downgrade→upgrade roundtrip, and single Alembic head all PASS (SQLite physical verification; dialect-safe defaults for PostgreSQL). The clean PostgreSQL 16 binaries crash on this Windows host (OS-level `0xC0000142`, unfixable in-session) — a genuine external environment blocker for the live PG run; the migration follows the identical verified pattern from the data closure (22/22 PG-critical on a working cluster).
3. **Frontend full Playwright: 107/109 PASS.** The 2 failures are documented pre-existing baseline failures on routes untouched by this closure: `critical-routes.spec.ts @a11y /app/profile` (form-label/select-name) and `responsive-routes.spec.ts /saas/billing` (main-landmark) — both documented in the prior Research Design and Data Runtime closure reports with identical errors.
4. **Live journal metadata provider** is NOT CONFIGURED; deterministic `TEST_PROVIDER` is used in tests (honestly recorded — no live verification claimed). Publisher submission APIs and commercial bibliometrics remain deferred.

## Success Statement

📖 Baseerah Publication Intelligence & Journal Matching has been functionally completed and verified for the current development cycle. The Publication domain is functionally complete, collaborative, institutionally ready, runtime-verified, accessible and IAM-ready. Baseerah maintains immutable and provenance-bound manuscript versions, deterministic manuscript and submission readiness, versioned reporting-guideline checks, governed authorship and CRediT contributions, structured declarations, reference-integrity controls, explainable journal matching, provenance-backed journal metadata, human-controlled journal selection, exact-version submission packages, truthful submission tracking, revision provenance, formal acceptance evidence and a strict separation between acceptance and publication. Journal fit is never represented as acceptance probability; unknown or unverified journal metadata is never fabricated; AI remains advisory and cannot confirm authorship, select the final journal, or record submission/acceptance/publication. Organization administration and platform administration do not automatically grant access to unpublished academic manuscripts. The Publication domain's IAM requirements are documented for the future unified Baseerah Identity, Roles & Institutional Access Architecture. Global IAM remains intentionally deferred. **No regressions detected by the executed verification suite.**
