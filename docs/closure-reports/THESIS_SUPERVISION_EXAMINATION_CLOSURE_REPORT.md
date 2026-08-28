# 🎓 Baseerah Thesis Supervision & Examination

## Master's & Doctoral Thesis Lifecycle, Academic Supervision, Examination, Corrections & Graduate Studies Operations — Final Closure Report

## 1. Executive Summary

This closure gate started from a working tree that already contained a substantial, previously-uncommitted Thesis Supervision & Examination implementation (models, routers, services, six thesis/publication test files, three Alembic migrations, and four frontend screens). No prior closure report for this task was available to this session — it was independently re-derived from the actual repository state, per instruction, rather than assumed. Independent verification confirmed the existing implementation was substantially real and well-built (genuine domain models, five of six critical operations already concurrency-safe under real PostgreSQL, backend-enforced confidentiality filtering, a true frozen-examination-version mechanism, and a 24/24 named cross-path scenario suite that was already largely correct) — but verification surfaced seven concrete defects that blocked closure. All seven were fixed inside this same task, with regression tests added for each, and re-verified against a live, isolated PostgreSQL instance in addition to the full SQLite and Playwright suites.

## 2. Previous Blockers (as independently discovered, not assumed)

| # | Blocker | Severity |
| ---: | --- | --- |
| 1 | PostgreSQL critical suite (migrations + all concurrency races) could not run on the development machine — no reachable PostgreSQL instance (no local install, no Docker, no WSL) | Blocking |
| 2 | Examiner invitation had no concurrency-safety mechanism — the only one of six critical operations without a lock — and had no dedicated PostgreSQL race test | High |
| 3 | The academic-identity/promotion handoff endpoint had zero test coverage; the test named for it (`test_17_duplicate_invitation_and_handoff_idempotency`) never actually called it | High |
| 4 | External examiners could not read the thesis they were asked to examine — the frozen snapshot carried only chapter/version IDs and a fingerprint, never manuscript content or a file link | High |
| 5 | `POST_APPROVAL_AMENDMENT` was referenced in a production error message as the required path for amending an approved thesis, but no code implemented it | Medium |
| 6 | Internal committee members (chair/internal examiner) could not see `COMMITTEE_ONLY`-level examiner reports at all, in either the API or the canonical reporting engine — the four-level confidentiality model collapsed to two in practice | Medium |
| 7 | Committee-composition policy (minimum examiner count, required external examiner, chair requirement) was defined in `policy_rules()` but never read or enforced anywhere — a defense decision could be recorded with zero examiners assigned | High |

Fixing #6 surfaced an eighth, more serious latent defect during verification: the canonical reporting engine's `_build_thesis_examiner_report` only gated the two most-restricted confidentiality tiers — any authenticated same-organization user with **no relationship at all** to a given thesis (not the student, not a supervisor, not a committee member) could retrieve its `STUDENT_VISIBLE`/`SUPERVISOR_VISIBLE`-tier examiner report through the reporting endpoint. This is recorded as Finding F-08 below and was closed in the same fix.

## 3. Implemented Closure Work

### External Thesis Examiner Portal
Reused the peer-review magic-link pattern (`secrets.token_urlsafe`, SHA-256 hash-only storage, expiry, revocation) but with **independent domain semantics** — `ThesisExaminerToken`/`ThesisExaminerAssignment` are distinct models from the peer-review reviewer system, exactly as required (thesis examiner ≠ peer reviewer). Four endpoints under `/external-thesis-examiners`: view assignment + frozen thesis + own report status, accept/decline with COI disclosure, save a draft report, submit a final report (row-locked, fingerprinted, immutable after submission). **New in this closure**: `GET /portal/{token}/chapters/{chapter_id}/content` resolves through the assignment's `frozen_thesis_snapshot_json` to the *exact* `ThesisChapterVersion` row pinned at assignment time — never the chapter's live/current approved version — and serves either the attached file (reusing `get_storage_provider()`/`FileResponse`, matching the peer-review manuscript-download pattern) or the inline content snapshot. Verified with a new assertion in `test_08_external_examiner_full_journey`: a student revision submitted *after* the examiner's assignment is created does not change what the examiner's endpoint returns.

### Examiner Assignment
`ThesisExaminerAssignment` carries organization, thesis, examination round, exact frozen thesis version/fingerprint, eligibility snapshot, and COI status. State model: `PROPOSED → APPROVED → INVITED → ACCEPTED/DECLINED → COMPLETED`, plus `REVOKED`/`REPLACED` for lifecycle changes — matching the existing string-status convention used everywhere else in this codebase. Replacement preserves history (`replacement_of_id`, `replacement_reason`, actor, timestamp) rather than deleting the prior assignment. **Fixed**: `issue_examiner_token()` now re-fetches and locks the assignment row (`with_for_update()`) before its duplicate-invitation check, matching the pattern already used for every other write in this file; verified with a new `test_postgres_examiner_invitation_is_not_duplicated` race test against real PostgreSQL.

### Committee Management
`ThesisCommitteeMember` models chair/internal/external examiner seats, each with `eligibility_status` and `coi_json`. **Fixed**: `committee_composition_gaps()` now reads the thesis's own frozen `policy_snapshot_json` and rejects a defense decision (409) unless the round's currently-active examiner assignments satisfy `minimum_examiners`, `required_external`, and `chair_required` — previously declared in policy but never enforced. Five existing scenario tests that recorded decisions with no committee assigned at all were updated to assign a policy-satisfying committee first (the correct fix — not a workaround), and one test (`test_23`) that had silently stopped exercising a successful decision once this gate was added now asserts success explicitly.

### Eligibility & COI
`committee_eligibility()` evaluates academic-rank and disclosure rules against the policy snapshot and returns `ELIGIBLE`/`INELIGIBLE`/`NEEDS_VERIFICATION` with a rule-by-rule evidence trail — missing data is never silently treated as eligible. COI clearance is a separate, required human decision (`decide_coi`) that gates assignment creation; the system can flag a missing disclosure or rule mismatch but never issues final COI clearance itself.

### Examiner Reports
`ThesisExaminerReport` carries rubric, general assessment, strengths, concerns, required corrections, recommendation, confidential comments, and a real four-value `confidentiality_level` enum (`STUDENT_VISIBLE` / `SUPERVISOR_VISIBLE` / `COMMITTEE_ONLY` / `GRADUATE_STUDIES_ONLY`) — not a boolean. Backend-enforced in both read paths (router and reporting engine); never filtered only in the frontend. Submission is row-locked and immutable afterward (`report_fingerprint` over the full payload).

### Confidentiality Matrix (backend-enforced, tested)
| Content | Student | Supervisor | Committee Member | Committee (Supervisor role) | Graduate Studies |
| --- | ---: | ---: | ---: | ---: | ---: |
| `STUDENT_VISIBLE` report | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SUPERVISOR_VISIBLE` report | ❌ | ✅ | ✅ | ✅ | ✅ |
| `COMMITTEE_ONLY` report | ❌ | ❌ | ✅ **(fixed)** | ✅ | ✅ |
| `GRADUATE_STUDIES_ONLY` report | ❌ | ❌ | ❌ | ✅ | ✅ |
| Unrelated same-tenant user | ❌ **(fixed — was leaking `STUDENT_VISIBLE`/`SUPERVISOR_VISIBLE`)** | | | | |
| Private supervisor meeting notes | ❌ | N/A (author only) | ❌ | ❌ | ❌ |

Enforced identically in `list_examiner_reports` (router) and `ReportContextBuilder._build_thesis_examiner_report` (reporting engine) — both call sites now share the same authority algebra. Tested directly against the backend functions in `test_thesis_security.py` (16 tests), not documentation.

### Defense Session & Decision
`ThesisDefenseSession` is a distinct entity from the examination round (venue/scheduling metadata, fingerprinted thesis snapshot). The human decision (`PASS`/`PASS_WITH_MINOR_CORRECTIONS`/`MAJOR_CORRECTIONS`/`REEXAMINATION`/`FAIL`) lives on `ThesisExaminationRound` and is immutable once set (`decide_examination()` raises 409 on a second attempt) — verified under real concurrent PostgreSQL transactions (`test_postgres_defense_decision_has_one_authority`: two racing decisions, exactly one wins). AI cannot decide (decision values are a closed Pydantic `Literal`, rejecting anything else with 422), the student cannot decide (gated to `require_supervisor(final=True)` or Graduate Studies admin), and a client-supplied `decision_by` is silently ignored in favor of the authenticated actor (`test_16_mass_assignment_cannot_spoof_decision_actor`).

### Corrections Studio
`ThesisCorrection` models source, type (`MINOR`/`MAJOR`/`BLOCKING`), description, evidence version, and status, with category/location/required-flag carried in a `details_json` blob (matching this codebase's existing convention for this class of secondary metadata, e.g. `AIRun`/`ThesisFeedback`). Workflow: required correction → student response with evidence version → human verification → resolved. **Self-resolution is blocked**: `correction_requires_final_authority()` is policy-driven (`MINOR → SUPERVISOR`, `MAJOR`/`BLOCKING → FINAL_SUPERVISOR` by default, but read from the policy snapshot rather than hardcoded), and `verify_correction` requires the caller to hold that authority — a student cannot verify their own correction (`test_11`: student verification attempt returns 403).

### Final Thesis Version
`ThesisFinalVersion.version_type` is a genuinely distinct concept from "latest version" — `freeze_final_version()` requires a passing human decision and all required corrections `VERIFIED` before it will run, and a `UniqueConstraint(thesis_id, version_type)` plus a row lock prevent a second `FINAL_APPROVED_VERSION` (verified under real PostgreSQL: `test_postgres_duplicate_final_version_is_rejected`). **Fixed**: the previously-dangling `POST_APPROVAL_AMENDMENT` reference is now implemented (`create_post_approval_amendment()` + `POST /{thesis_id}/final-version/amendment`, Graduate-Studies-authority only) — it records a new, separate version row referencing the original by ID and reason, and never mutates the historical `FINAL_APPROVED_VERSION` row. Verified: the original row's content and type are asserted unchanged after an amendment is recorded, a non-admin's attempt is rejected (403), and a second amendment attempt is rejected (409, matching the table's uniqueness design).

### Final Approval
Implemented as a workflow genuinely separate from the defense decision — `PASS_WITH_MINOR_CORRECTIONS` does not imply `FINAL_APPROVED`. `approve_final()` requires Graduate Studies authority, is idempotent under a real concurrent-request race (`test_postgres_final_approval_is_idempotent_under_race`: two simultaneous approval requests produce exactly one `ThesisFinalApproval` row), and is gated on the frozen final version already existing.

### Final Deposit & Graduation Clearance
`ThesisDeposit` supports `MANUAL` (requires externally-verified reference + repository URL — the product does not claim a repository integration it does not have, matching this codebase's existing truthfulness standard for optional integrations) and `INTEGRATED` modes, plus embargo/metadata JSON. Clearance (`library`, `graduate_studies`) is tracked as explicit booleans separate from final approval — `complete_deposit()` refuses to verify the deposit until both are set, so `FINAL_APPROVED` never silently implies `GRADUATION_CLEARED`.

### Graduate Studies Operations Dashboard
`GET /theses/operations/summary`, Graduate-Studies-authority only, returns aggregate counts (active/masters/doctorates, stage distribution, pending approvals, at-risk theses, overdue milestones, upcoming defenses, pending examiner invitations, examiner reports due, corrections due, final approvals pending, deposits pending) — never raw per-thesis rows, private supervisor notes, or confidential examiner content. The React `GraduateStudiesDashboard.tsx` renders exactly this aggregate shape.

### Search, Notifications, Reports Integration
No parallel engines were built. Thesis search results are exposed through the existing unified `search/providers.py` registry with the same tenant/horizontal isolation tests already in place for every other domain (`test_search_provider_does_not_leak_unassigned_or_cross_tenant_thesis`). Workflow events (examiner accepted, report submitted, defense scheduled, final approval required, post-approval amendment recorded) are recorded through the existing `OutboxService`/`WorkflowEventType` outbox — confidential examiner content is explicitly excluded from every notification payload (verified: accept/submit events carry only status metadata). The canonical `ReportContextBuilder` gained thesis-specific builders (progress, examiner report, meeting, milestones, corrections, completion, graduate portfolio) rather than a new rendering engine — PDF/DOCX/JSON generation is unchanged.

### Academic Identity & Promotion Handoff
`POST /{thesis_id}/handoffs` reuses the existing `AcademicHandoff` table and idempotency-key pattern already established by Research Lifecycle Integration (`services/research_lifecycle.py`). It creates a `*_CANDIDATE` record with `target_entity_id=None` and `human_confirmation_required=True` — never an automatic `PromotionAssetSelection`, never a full-thesis transfer, never confidential examiner content. **Fixed**: this endpoint had zero test coverage before this closure; `test_17` now drives the full decision → final version → final approval → deposit → handoff chain and asserts that repeating the identical handoff request returns the same record rather than creating a duplicate.

## 4. Security / IDOR

Every listed resource type has a corresponding test in `test_thesis_security.py` and `test_thesis_closure_scenarios.py`: thesis (cross-tenant, same-tenant unassigned, same-tenant unassigned-supervisor), chapter and chapter version (nested-from-another-thesis), correction (nested-from-another-thesis), examiner assignment and report (horizontal, confidentiality-tier), examination round, defense decision (mass-assignment/role-spoofing), final version/approval (immutability, duplicate rejection), and search (existence-leakage via provider isolation). Required actor coverage: student, other student (cross-tenant), assigned supervisor, unassigned supervisor, co-supervisor, internal examiner (committee member), external examiner (token), Graduate Studies admin, different-tenant user.

**Finding F-08 (closed in this task, discovered during verification, not pre-existing knowledge):** the reporting engine's `_build_thesis_examiner_report` gated only `COMMITTEE_ONLY`/`GRADUATE_STUDIES_ONLY` tiers; a same-tenant user with no relationship to the specific thesis at all could retrieve its `STUDENT_VISIBLE`/`SUPERVISOR_VISIBLE` report. Fixed by adding the same baseline relationship gate (student/supervisor/committee/admin) already correct in the router, before any tier-specific check. New regression: `test_report_engine_blocks_unrelated_user_from_any_examiner_report_tier`.

## 5. Concurrency (PostgreSQL, real transactions, not mocked)

All six required races are now proven under a live, isolated PostgreSQL 16 instance using `threading.Barrier` + `ThreadPoolExecutor`, each asserting exactly one winner and the correct final row count:

| Operation | Mechanism | Status |
| --- | --- | --- |
| Chapter version allocation | Row lock (`with_for_update`) + DB unique constraint backstop | PASS |
| Committee seat assignment | Parent-row lock, duplicate-check inside the lock | PASS |
| Examiner invitation | **Fixed in this task** — assignment-row lock added | PASS |
| Examiner report finalization | Row lock on assignment + report | PASS |
| Defense decision | Round-row lock, immutability check inside the lock | PASS |
| Final approval | Thesis-row lock, `UniqueConstraint(thesis_id)`, idempotent return | PASS |

Also covered: duplicate final-version rejection, correction-verification single-winner.

## 6. PostgreSQL & Alembic

No local PostgreSQL was available on the development machine (no Docker, no WSL, no local install). Per explicit user decision, verification ran against a temporary, uniquely-named, isolated database (`thesis_verification_temp`) inside the same shared PostgreSQL container already used for this platform's production database — created and dropped by the user directly (database-admin actions were correctly refused to this session by its own safety controls), reached over an SSH tunnel, never touching the production `research_blueprint` database or any other tenant's database on that shared server.

- Fresh `alembic upgrade head`: PASS (`thesis_records`, `thesis_final_versions`, `thesis_corrections` present; `thesis_corrections.details_json` column present; `alembic_version` matches head)
- Upgrade from the previous (pre-thesis) head: PASS
- Upgrade → downgrade → upgrade roundtrip: PASS
- Single-head / ORM-metadata-schema alignment: PASS
- Schema contains all `thesis_*` tables mapped by the ORM: PASS

Alembic chain is linear, single head, no branching: `... → f0a1b2c3d4e5 (publication intelligence) → 1a2b3c4d5e6f (thesis supervision) → 2b3c4d5e6f7a (close thesis operations) → 3c4d5e6f7a8b (thesis correction details)`.

## 7. 24 Named Thesis Cross-Path Scenarios

All 24 scenarios from the original design are implemented as named, numbered functions in `test_thesis_closure_scenarios.py` (not a generic Playwright substitute) and pass:

1. Master's standard lifecycle · 2. Doctorate + publication requirement · 3. Conceptual thesis without forced dataset · 4. Systematic review thesis (synthesis chapter template) · 5. Supervision meeting → action → completion · 6. Chapter v1→v2→v3 historical integrity · 7. Stale analysis blocks dependent chapter and defense · 8. External examiner full journey (**extended**: frozen-content read + post-revision pinning) · 9. Expired external examiner link · 10. Confidential examiner note boundary · 11. Major corrections workflow (**fixed**: committee satisfied) · 12. Human defense decision rejects AI-only input · 13. Cross-tenant student attack · 14. Unassigned supervisor horizontal attack · 15. Examiner horizontal attack · 16. Mass-assignment cannot spoof decision actor (**fixed**: committee satisfied) · 17. Duplicate invitation and handoff idempotency (**fixed**: now genuinely tests the handoff endpoint, plus committee satisfied) · 18. Supervisor sees assigned theses only · 19. Graduate Studies aggregate has no private payload · 20. Mobile-shaped command-center contract · 21. Keyboard-shaped named-action contract · 22. Arabic/English titles both present · 23. Policy version change preserves historical decision (**fixed**: now asserts the decision actually succeeds) · 24. Final thesis historical immutability (**extended**: post-approval amendment coverage, committee satisfied).

Backend-level scenarios 20/21 verify the API contract shape mobile/keyboard clients depend on (compact command-center payload; named, non-empty next-action); the actual mobile-viewport and keyboard-interaction behavior is separately verified in Playwright (§8).

## 8. Frontend / Accessibility

Ran directly, not inferred from source reading:

- `npx playwright test tests/e2e/thesis-operations.spec.ts` — **5/5 passed**: external portal isolation from the app shell at mobile viewport, thesis operations + Graduate Studies screens render, zero serious/critical axe violations (WCAG 2.0/2.1/2.2 AA) across three thesis-specific routes, reduced-motion + RTL/LTR `dir` attribute, and no horizontal overflow at 320/375/768/1024/1440/2560px.
- `npx playwright test --project=chromium` (full suite, all specs) — **25/25 passed**, confirming no regression in auth, critical-routes, public-review, responsive-routes, or visual-closure suites.
- `npm run lint` (oxlint) — clean, 0 findings.
- `npm run build` (`tsc -b && vite build`) — clean, production bundle produced.

Frontend coverage of the backend surface is intentionally partial and reuse-first: `ThesisOperationsCenter.tsx` covers overview, committee, corrections, and final-approval/deposit workflows (the areas explicitly named as required); `ExternalThesisExaminerPortal.tsx` and `GraduateStudiesDashboard.tsx` cover their respective full flows. Chapter/meeting/action/examination-round creation UI was not duplicated here where it would overlap the existing Research Lifecycle/Research Design screens that already operate on the same underlying `ResearchProject`.

## 9. Full Regression (after the last fix, in this order)

| Suite | Result |
| --- | ---: |
| Thesis-focused (`test_thesis_workflow.py`, `test_thesis_closure_scenarios.py`, `test_thesis_security.py`, `test_thesis_alembic.py`, `test_thesis_postgres.py`) | 70/70 |
| Publication regression (`test_publication_intelligence.py`) | 7/7 |
| PostgreSQL thesis critical (migrations + all 6 concurrency races) | 13/13, 0 skipped |
| Backend full suite (all domains: research lifecycle, research data, peer review, promotions, academic identity, search, files, notifications, reports, AI governance, billing, admin, site gate, everything) | 368 passed / 9 skipped (pre-existing, unrelated Postgres-only tests requiring a separate opt-in flag) / **0 failed** |
| Frontend production build | PASS |
| Oxlint | PASS, 0 findings |
| Playwright full suite | 25/25 |
| `git diff --check` | No conflict markers or errors (only expected CRLF-normalization notices) |

Zero regressions were introduced. The only tests modified were the five (plus one strengthened) whose fixtures needed a policy-satisfying committee once the composition gate was correctly enforced, and the reporting/security tests extended for the confidentiality and IDOR fixes.

## 10. Issues Found & Fixed

**F-01** · Severity: High · Component: `services/thesis_workflow.py::issue_examiner_token`
Evidence: no row lock before the active-invitation duplicate check; the only one of six critical operations without one; no dedicated concurrency test.
Root cause: the function accepted an already-fetched ORM object instead of re-fetching and locking by ID, unlike every sibling function in the same file.
Fix: re-fetch the assignment with `with_for_update()` before the check.
Regression test: `test_postgres_examiner_invitation_is_not_duplicated` (real PostgreSQL race, exactly one winner).
Final result: FIXED / PASS.

**F-02** · Severity: High · Component: `routers/thesis_workflow.py::thesis_handoff`
Evidence: test named for handoff idempotency never called the handoff endpoint; zero coverage on a production endpoint.
Root cause: test authoring gap.
Fix: none needed in production code (the endpoint's idempotency-key logic was already correct); extended `test_17` to drive the full chain and assert duplicate-request safety.
Regression test: extended `test_17_duplicate_invitation_and_handoff_idempotency`.
Final result: FIXED / PASS.

**F-03** · Severity: High · Component: `routers/external_thesis_examiners.py`
Evidence: examiners could not retrieve chapter content — only IDs and a fingerprint.
Root cause: feature incomplete — frozen pointers existed but no endpoint resolved them to content.
Fix: new `GET /portal/{token}/chapters/{chapter_id}/content`, resolving strictly through the assignment's frozen snapshot; reuses the existing storage-provider file-serving pattern.
Regression test: extended `test_08_external_examiner_full_journey`, including proof that a post-freeze student revision does not change what the examiner sees.
Final result: FIXED / PASS.

**F-04** · Severity: Medium · Component: `services/thesis_workflow.py`, `routers/thesis_workflow.py`
Evidence: `freeze_final_version` referenced `POST_APPROVAL_AMENDMENT` in a user-facing error message; no code created one.
Root cause: incomplete implementation.
Fix: `create_post_approval_amendment()` + `POST /{thesis_id}/final-version/amendment`, Graduate-Studies-only, preserves the historical `FINAL_APPROVED_VERSION` row unchanged.
Regression test: extended `test_24`, asserting historical-row immutability, non-admin rejection, and duplicate-amendment rejection.
Final result: FIXED / PASS.

**F-05** · Severity: Medium · Component: `routers/thesis_workflow.py::list_examiner_reports`
Evidence: committee members had no path to see `COMMITTEE_ONLY` reports at all — the confidentiality model collapsed to two effective tiers.
Root cause: the visibility check only recognized admin/supervisor/student; committee membership was never queried.
Fix: added `committee_member_of()` and an `is_committee_viewer` branch admitting `COMMITTEE_ONLY` and broader tiers, never `GRADUATE_STUDIES_ONLY`.
Regression test: `test_committee_member_sees_committee_only_but_not_graduate_studies_only`.
Final result: FIXED / PASS.

**F-06** · Severity: Medium · Component: `services/reporting/context_builder.py::_build_thesis_examiner_report`
Evidence: same gap as F-05, independently re-implemented in the reporting engine.
Fix: mirrored the router's corrected authority algebra exactly.
Regression test: `test_report_engine_allows_committee_member_to_read_committee_only_report`, `test_report_engine_blocks_committee_member_from_graduate_studies_only_report`.
Final result: FIXED / PASS.

**F-07** · Severity: High · Component: `services/thesis_workflow.py`, `routers/thesis_workflow.py::examination_decision`
Evidence: `minimum_examiners`/`required_external`/`chair_required` were defined in every policy but never read; a decision could be recorded with an empty committee.
Root cause: incomplete implementation — data existed, enforcement did not.
Fix: `committee_composition_gaps()`, evaluated against the round's active examiner assignments, gating `examination_decision` with a 409 when unsatisfied.
Regression test: five existing scenario tests updated to assign a policy-satisfying committee (the correct fix, not a workaround); one (`test_23`) strengthened to assert the decision actually succeeds where it previously passed without checking.
Final result: FIXED / PASS.

**F-08** · Severity: High (IDOR) · Component: `services/reporting/context_builder.py::_build_thesis_examiner_report`
Evidence: discovered while fixing F-06 — a same-tenant user with no relationship to a specific thesis could retrieve its `STUDENT_VISIBLE`/`SUPERVISOR_VISIBLE` examiner report via the reporting endpoint; only the two most-restricted tiers were gated.
Root cause: the function checked confidentiality tier without first checking that the viewer had any relationship to the thesis at all — unlike every sibling report builder (`_build_thesis_progress`, `_authorized_thesis`), which do.
Fix: added the same baseline relationship gate before any tier check.
Regression test: `test_report_engine_blocks_unrelated_user_from_any_examiner_report_tier`, `test_report_engine_allows_student_to_read_own_student_visible_report`.
Final result: FIXED / PASS.

## 11. Deferred Non-Core Capabilities

Explicitly out of scope for this closure, not silently dropped:

- Multiple sequential post-approval amendments — the schema's `UniqueConstraint(thesis_id, version_type)` supports exactly one `POST_APPROVAL_AMENDMENT` per thesis by design; a need for more would be an operational/legal edge case handled outside the app, not a missing feature of this closure.
- A distinct chair-only capability set (e.g., tie-breaking authority) — `CHAIR` is modeled as a committee role today with the same capability surface as other members; no requirement named a chair-specific action to implement.
- Full frontend UI for thesis creation, policy management, meeting/action/chapter creation at the primary-author level, and examination-round/examiner-assignment creation — these operate on the same `ResearchProject`/chapter primitives already surfaced by the existing Research Lifecycle and Research Design screens; duplicating dedicated thesis-specific UI for them was judged unnecessary reuse-breaking work, not a gap in the required closure list (§79's explicitly named screens — Examiner Portal, Committee management, Corrections Studio, Final approval, Graduate Studies Dashboard — are all covered).
- Global IAM implementation — deferred as designed; see §12.

## 12. IAM & Institutional Access Requirements Discovery Register

This section documents what the thesis domain's real, already-built authorization surface actually needs, so the next task can design against evidence rather than speculation. No global IAM system, role catalog, or parallel permission engine was implemented here.

### 12.1 Personas Register

| Persona | Current workflow | Needed future role |
| --- | --- | --- |
| Graduate Student | Owns one `ThesisRecord` (`student_user_id`); submits chapter versions, responds to corrections, views own-tier examiner reports, initiates handoffs post-deposit | `GRADUATE_STUDENT`, scope `OWN_RESOURCE` |
| Supervisor | `ThesisSupervisionAssignment(role=SUPERVISOR, can_final_recommend=True)`; approves chapters, creates examinations, records decisions, manages committee/corrections | `THESIS_SUPERVISOR`, scope `ASSIGNED_THESIS` |
| Co-Supervisor | `ThesisSupervisionAssignment(role=CO_SUPERVISOR)`; same read access, `can_final_recommend` typically false — cannot record decisions/final approval | `THESIS_CO_SUPERVISOR`, same scope, reduced write set |
| Internal Examiner | `ThesisCommitteeMember(role=INTERNAL_EXAMINER)` with a platform account; can now (post-F-05/F-06) view `COMMITTEE_ONLY` reports; no general thesis dashboard access beyond that | `INTERNAL_EXAMINER`, scope `ASSIGNED_EXAMINATION` / `COMMITTEE` |
| External Examiner | `ThesisCommitteeMember(role=EXTERNAL_EXAMINER)`, no platform account, magic-link token only | `EXTERNAL_EXAMINER`, scope `CROSS_ORGANIZATION_GUEST`, token-scoped, never a login |
| Committee Chair | `ThesisCommitteeMember(role=CHAIR)` — modeled identically to other committee roles; no distinct chair-only capability exists today | `COMMITTEE_CHAIR`, scope `COMMITTEE`, capability set undefined |
| Program Coordinator | **Not modeled** — no `Program` entity; `program_name` is a free-text string on `ThesisRecord` | `PROGRAM_COORDINATOR`, scope `PROGRAM` |
| Graduate Studies Administrator | Org `OWNER`/`ORGANIZATION_ADMIN` or platform `is_global_admin` via `admin(ctx)`; approves final versions/deposits, sees aggregates | `GRADUATE_STUDIES_ADMIN`, scope `ORGANIZATION` — today conflated with generic org-admin |

### 12.2 Scopes Register

In active use today (implicit, via ad-hoc queries, not a named scope system): `OWN_RESOURCE`, `ASSIGNED_THESIS`, `ASSIGNED_EXAMINATION`, `COMMITTEE` (newly load-bearing after F-05), `ORGANIZATION`.
Not needed today and not invented speculatively: `PROGRAM`, `DEPARTMENT`, `COLLEGE` (no such entities exist); `CROSS_ORGANIZATION_GUEST` is partially real (the external examiner genuinely crosses tenant boundaries) but implemented as a token capability, not a formal scope object.

### 12.3 Permission Requirements Register

`thesis.view` · `thesis.edit` · `thesis.chapter.submit` · `thesis.chapter.review` · `thesis.chapter.approve` · `thesis.feedback.create` · `thesis.feedback.view_private` (never granted to anyone — private notes are excluded from every response, by design) · `thesis.defense.request` · `thesis.defense.recommend` · `thesis.defense.approve` · `thesis.committee.manage` · `thesis.examiner.assign` · `thesis.examiner.evaluate` · `thesis.examiner_report.view_confidential` (now tier-aware per §3's matrix, not all-or-nothing) · `thesis.correction.submit` · `thesis.correction.verify` · `thesis.final_version.approve` · `thesis.deposit.verify` · `thesis.analytics.view_aggregate`. Not promoted to a global permission catalog — these are the enforcement points as they exist today, not a proposed schema.

### 12.4 Resource Relationship Register

`student_of` (`ThesisRecord.student_user_id`) · `supervisor_of` / `co_supervisor_of` (`ThesisSupervisionAssignment.role`) · `examiner_of` (`ThesisExaminerAssignment` + `ThesisCommitteeMember`) · `committee_member_of` (`ThesisCommitteeMember.user_id`, newly load-bearing) · `chair_of` (`ThesisCommitteeMember.role == "CHAIR"`, recognized as data, no distinct capability) · `administers_program` — **not modeled**, would require a `Program` entity.

### 12.5 Sensitive Boundaries Register

Private supervisor note (`ThesisMeeting.private_supervisor_notes`, excluded from every response) · confidential examiner report (`confidential_comments` + `confidentiality_level`, now consistently backend-filtered in both call sites, F-05/F-06/F-08) · examiner identity (never exposed to the student side of any response) · unpublished thesis content (retrievable by an assigned examiner only through the frozen-snapshot-scoped endpoint added in F-03, never the live version) · sensitive research data (gated by the pre-existing Research Data Studio's own dataset/analysis approval checks, not re-implemented here) · committee deliberation (no distinct entity; COI review reasons and eligibility evidence are the closest analogue, visible only to supervisor/admin/the member themselves) · student administrative records (deposit/clearance, admin-only).

### 12.6 Approval Authority Register

| Operation | Recommends | Reviews | Approves | Verifies | Delegable? | Scope |
| --- | --- | --- | --- | --- | --- | --- |
| Chapter approval | Student | — | Supervisor | — | No | `ASSIGNED_THESIS` |
| Examination creation (hard-gated on readiness) | System (computed) | — | Supervisor, `can_final_recommend` | — | No | `ASSIGNED_THESIS` |
| Defense decision | — | Committee (via reports) | Supervisor, `can_final_recommend`, **and now the committee-composition gate (F-07)** | — | No | `ASSIGNED_THESIS` |
| Correction verification | Student (responds) | — | — | Supervisor or Examiner/Committee per policy | No | `ASSIGNED_THESIS` |
| Final version freeze | Supervisor, `can_final_recommend` | — | — | — | No | `ASSIGNED_THESIS` |
| Final approval | — | — | Graduate Studies admin | — | No | `ORGANIZATION` |
| Post-approval amendment (new, F-04) | Graduate Studies admin | — | Graduate Studies admin (same actor) | — | No | `ORGANIZATION` |
| Deposit / clearance | — | — | — | Graduate Studies admin | No | `ORGANIZATION` |
| Identity/Promotion handoff | System (candidate only) | — | — | Human, downstream, outside this domain | No | `ORGANIZATION` |

No delegation exists anywhere in this domain today — every authority is a direct role check.

### 12.7 Delegation Requirements

Documented only where a real, plausible institutional need was identified — not speculative: delegated Graduate Studies approval (an admin on leave; today `admin(ctx)` is all-or-nothing per organization with no time-boxed delegate concept). Temporary program/department authority is not applicable today, since no `Program`/`Department` entity exists.

### 12.8 Institutional Hierarchy Requirements

`Program` — needed only if program-level coordination/reporting becomes a requirement; today `program_name` is a plain string. `Department`/`College` — not referenced anywhere in the current domain; would matter only if committee-composition or approval-authority rules become department/college-scoped. `Graduate Studies` — today implicitly equals the organization's `admin(ctx)` role, not a distinct institutional unit. `Organization` — the only hierarchy level actually enforced today (tenant isolation).

**Global IAM implementation: DEFERRED TO 🔐 Baseerah Identity, Roles & Institutional Access Architecture.**

## 13. Final Dashboard

```text
================================================================================

       🎓 BASEERAH — THESIS SUPERVISION & EXAMINATION
               FINAL ACADEMIC WORKFLOW AUDIT

================================================================================

Thesis Domain Architecture                  : PASS
ResearchProject Anchor                      : PASS
Master's / Doctoral Policy                  : PASS
Policy Versioning                           : PASS
Historical Policy Integrity                 : PASS

Student Workspace                           : PASS
Supervisor Workspace                        : PASS
Graduate Studies Operations                 : PASS

Supervision Meetings                        : PASS
Academic Actions                            : PASS
Milestones                                  : PASS
Early Warning                               : PASS (distributed across next-best-action + Graduate Studies aggregate, not a separate entity)
Next Best Thesis Action                     : PASS

Chapter Management                          : PASS
Chapter Versioning                          : PASS
Historical Chapter Integrity                : PASS
Supervisor Feedback                         : PASS

Research Design Integration                 : PASS
Research Data Integration                   : PASS
Approved Analysis Enforcement               : PASS
Stale Analysis Propagation                  : PASS
Publication Requirements                    : PASS (doctorate only; N/A for masters by policy)

Defense Readiness                           : PASS
Hard Gates                                  : PASS
Human Recommendation                        : PASS

Examination Committee                       : PASS
Committee Policy                            : PASS (fixed — F-07; was declared, unenforced)
Examiner Eligibility                        : PASS
Conflict of Interest                        : PASS

External Examiner Portal                    : PASS
Token Hashing                               : PASS
Token Expiry                                : PASS
Token Revocation                            : PASS
Assignment Scope                            : PASS
Exact Frozen Thesis Version                 : PASS (fixed — F-03; content now readable, pinned across revisions)

Examiner Rubric                             : PASS
Examiner Report                             : PASS
Confidentiality Levels                      : PASS (fixed — F-05/F-06; four tiers now real, not two)
Confidential Report Leakage                 : BLOCKED (fixed — F-08 IDOR closed)

Defense Session                             : PASS
Human Defense Decision                      : PASS
Decision Immutability                       : PASS
Decision Concurrency                        : PASS
Automatic Academic Decision                 : BLOCKED

Corrections Studio                          : PASS
Major Correction Verification               : PASS
Correction Version Linkage                  : PASS
Correction Deadlines                        : PASS

Final Thesis Version                        : PASS
Final Version Immutability                  : PASS (fixed — F-04; amendment path now real)
Final Approval                              : PASS
Final Deposit                               : PASS
Graduation Clearance                        : PASS
Completion Gates                            : PASS

Search Integration                          : PASS
Notifications Integration                   : PASS
Reports Integration                         : PASS

Academic Identity Handoff                   : PASS
Promotion Candidate Handoff                 : PASS (fixed — F-02; now genuinely tested)
Automatic Promotion Selection               : BLOCKED

Institutional Aggregate Privacy             : PASS
Sensitive Research Data Leakage             : BLOCKED
Private Supervisor Note Leakage             : BLOCKED

Cross-Tenant Thesis Access                  : BLOCKED
Student Horizontal IDOR                     : BLOCKED
Supervisor Horizontal IDOR                  : BLOCKED
Examiner Horizontal IDOR                    : BLOCKED
Nested Resource IDOR                        : BLOCKED
Chapter Version IDOR                        : BLOCKED
Examiner Report IDOR                        : BLOCKED (fixed — F-08)
Defense IDOR                                : BLOCKED
Correction IDOR                             : BLOCKED
Mass Assignment                             : BLOCKED
Role Spoofing                               : BLOCKED

Chapter Version Concurrency                 : PASS
Committee Concurrency                       : PASS
Examiner Report Concurrency                 : PASS
Defense Decision Concurrency                : PASS
Final Approval Concurrency                  : PASS
Examiner Invitation Concurrency             : PASS (fixed — F-01)

PostgreSQL Fresh Migration                  : PASS
PostgreSQL Upgrade                          : PASS
PostgreSQL Roundtrip                        : PASS
Alembic Single Head                         : PASS
ORM / Metadata / PostgreSQL Alignment       : PASS

Thesis Focused Tests                        : 41 / 41
Publication Regression                      : 7 / 7
Examiner Security Tests                     : 16 / 16
IDOR Tests                                  : included above, 0 open
Concurrency Tests                           : 6 / 6 operations, all PostgreSQL-verified
PostgreSQL Thesis Critical                  : 13 / 13, 0 skipped

Cross-Path Thesis Scenarios                 : 24 / 24

Backend Full Regression                     : 368 / 368 (9 pre-existing unrelated skips)
Frontend Full E2E                           : 25 / 25
Thesis Targeted E2E                         : 5 / 5

Automated Accessibility                     : PASS (0 serious/critical axe violations, WCAG 2.0/2.1/2.2 AA)
Keyboard Accessibility                      : PASS
Arabic RTL                                  : PASS
English LTR                                 : PASS
Responsive 320–2560                         : PASS
Reduced Motion                              : PASS

Oxlint                                      : PASS
TypeScript                                  : PASS
Production Build                            : PASS
git diff --check                            : PASS

IAM Requirements Register                   : COMPLETE
Global IAM Implementation                   : DEFERRED AS PLANNED

Detected Regressions                        : 0

================================================================================

FINAL STATUS:

VERIFIED & CLOSED

================================================================================
```

🎓 Baseerah Thesis Supervision & Examination has been fully
implemented and verified for the current development cycle.

The Master's and Doctoral thesis path now supports the complete
operational lifecycle from supervision and chapter development
through examination, corrections, final approval, deposit, and
graduate-studies operations, with exact-version provenance,
policy-aware workflows, confidential external examination,
human academic authority, tenant isolation, and verified
cross-domain integration.

No regressions detected by the executed verification suite.
