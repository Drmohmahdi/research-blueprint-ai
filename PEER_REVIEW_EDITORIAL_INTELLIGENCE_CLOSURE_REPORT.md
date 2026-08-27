# ⚖️ Baseerah Peer Review & Editorial Intelligence

## Functional Completion, Editorial Intelligence, Reviewer Governance, Institutional Operations & IAM Requirements Discovery — Closure Report

**Date:** 2026-08-26
**Branch:** `main` @ `c58c8e2` (working tree, uncommitted — this closure adds to the same in-flight state as prior Data/Design/Publication closures)
**Scope:** Complete the existing Peer Review domain against the new spec's invariants (resource-scoped editorial authority, exact-version Publication binding, COI, blindness, concurrency, PostgreSQL, IAM). No rebuild, no new editorial platform, no Global IAM.

---

## 1. Executive Summary

Repository discovery found the Peer Review domain **already functionally complete** — not a stub: a 1095-line router, a 457-line external-reviewer magic-link portal, 9 model classes, a dedicated migration, 839+512 lines of frontend UI, and 14 passing security-conscious tests. This closure's job was therefore **discover → verify → fix**, not rebuild.

Discovery surfaced one **critical architectural gap**: editorial authority (`verify_editorial_admin`) was conflated with organization role (`OWNER`/`ORGANIZATION_ADMIN`/`SUPERVISOR`, plus an unconditional platform-`SystemAdmin` bypass) rather than being scoped to a specific case — directly violating this task's core mandate that organization and platform administration must **not** imply peer-review confidential/editorial authority. This has been redesigned to a resource-scoped `editor_user_id` model, verified against all 14 pre-existing tests (13 unaffected, 1 deliberately superseded with justification) plus 6 new tests.

Discovery also found **zero integration** between this legacy Peer Review domain and the newer, fingerprint-bound Publication Intelligence domain closed earlier in this session — violating the mandatory "Exact-Version Rule." Per an explicit scope decision, an **additive, optional** binding was implemented (`manuscript_version_id` + server-derived `fingerprint` + `publication_submission_id`) rather than a breaking refactor of the working legacy case/round/revision model.

Real multi-connection PostgreSQL testing then found and fixed **four concurrency gaps** (reviewer-invitation duplication, round/revision version races, and a genuine editorial-decision race that could silently let a round carry two contradictory "final" decisions) — none of which were previously tested on a real database.

## 2. Repository Discovery

| Item | Result |
|---|---|
| Branch | `main` |
| HEAD SHA | `c58c8e239a595e875a6fb336b835ddbbf67a8721` |
| Alembic head (start) | `d4e5f6a7b8c9` (from this session's earlier Publication closure) |
| Alembic head (end) | `e5f6a7b8c9d0` (new migration added by this closure) |
| Alembic heads | ONE, throughout |
| Existing Peer Review migration | `e8a2b3c4d5f6_add_peer_review_workflow_and_portal.py` — already committed (`down_revision = d7f1b2c3e4a5`), unchanged this session |

## 3. Existing vs New Capabilities

| Capability | Classification |
|---|---|
| PeerReviewCase / PeerReviewRound / ReviewRubric / ReviewCriterion | KEEP |
| ReviewerAssignment (internal + external, COI self-declaration, decline reasons) | KEEP |
| ExternalReviewerToken (SHA-256 hash-only, 32-byte entropy, 14-day expiry) | KEEP |
| ReviewSubmission / ReviewCriterionResponse / ReviewComment (author-visible vs confidential-to-editor) | KEEP |
| Server-side blindness masking (`apply_privacy_and_confidentiality`) | KEEP (network-level, not CSS — verified by existing test) |
| Editorial authority = org role (`OWNER`/`ORGANIZATION_ADMIN`/`SUPERVISOR`) + unconditional platform-admin bypass | **REFACTOR** — critical, see §4 |
| Publication Intelligence exact-version binding | **CREATE** — additive, optional |
| Co-author conflict-of-interest signal | **CREATE** |
| Reviewer-invitation / round-creation / revision-numbering / decision-recording concurrency safety | **FIX** (4 real races found and fixed) |
| Institutional Peer Review Operations dashboard | **CREATE** |
| Peer Review IAM Discovery Register | **CREATE** |
| Live external scholarly-reviewer-pool provider, reviewer marketplace, automated editorial decisions | **DEFER** (as planned — never in scope) |

## 4. Critical Finding: Editorial Authority Was Not Resource-Scoped

`verify_editorial_admin(context)` granted full editorial authority — invite reviewers, view confidential comments, record decisions — to **any** `OWNER`/`ORGANIZATION_ADMIN`/`SUPERVISOR` org member **and** to any platform `SystemAdmin`, globally, with no per-case scoping. This is exactly the anti-pattern this task's core mandate forbids ("Editor ≠ Organization Admin", "Platform Administration ≠ Academic Review Content Access").

**Fix:** `PeerReviewCase.editor_user_id` (new, nullable FK) + `is_case_editor(case, context)` = `role == "OWNER"` OR `case.editor_user_id == user.id`. `OWNER` remains bootstrap authority (consistent with every other Baseerah domain closed this cycle); `ORGANIZATION_ADMIN`/`SUPERVISOR` no longer auto-qualify; the platform-admin bypass was **removed entirely**. A new `PUT /cases/{id}/editor` endpoint (OWNER-only, audited) delegates editorial authority explicitly. Applied to `create_next_review_round`, `assign_or_invite_reviewer`, `record_editorial_decision`, `get_peer_review_case`'s access/masking check, and the AI review-summary context builder (`_review_feedback`), which had the identical conflation bug.

**Compatibility:** all 14 pre-existing tests use the `OWNER` persona for editorial actions — **13 passed unchanged**. The 14th, `test_system_admin_without_org_role_can_issue_editorial_decision`, explicitly asserted the platform-admin bypass (a prior regression fix, F13-005, for a different concern) — this directly contradicts the new mandatory boundary, so it was **deliberately superseded**: renamed to `test_platform_admin_without_case_editor_role_is_blocked_from_editorial_decision`, asserting `403` instead of `200`, with the supersession reasoning documented in its docstring.

## 5. Exact-Version Publication Binding (Additive, Per Scope Decision)

`PeerReviewCase` gained three nullable columns: `manuscript_version_id` (FK → `publication_manuscript_versions`), `manuscript_fingerprint`, `publication_submission_id` (FK → `publication_submissions`). When `POST /cases` is called with `manuscript_version_id`, the fingerprint and submission reference are **always re-derived server-side** from the referenced version — never accepted from the client — so a caller cannot assert a fingerprint that doesn't match the actual manuscript. The existing `scholarly_asset_id` + locally-authored title/abstract path is untouched for cases not yet migrated to Publication Intelligence.

Round-level Publication-version binding (vs. the existing immutable `manuscript_snapshot_json` per round) was **not** added in this pass — the JSON-snapshot mechanism already provably preserves historical-round integrity (verified: Round 1 unchanged after Round 2 exists), so this is a documented scope boundary, not a gap.

## 6. Conflict of Interest

Existing: reviewer self-declaration (`NO_CONFLICT`/`POTENTIAL_CONFLICT`/`CONFLICT_DECLARED`) at accept time, blocking draft/submit while declared. **Added:** a real, data-derived signal — a listed co-author on the bound Publication manuscript version cannot be assigned as reviewer (`400`), extending the existing author-cannot-review-own-paper check. COI override/resolution has **no** implementation (a declared conflict is a permanent block on that assignment with no unblock endpoint) — documented as an intentional, safe-by-default deferred workflow gap, not fabricated.

## 7. Real Multi-Connection PostgreSQL Concurrency — Issues Found & Fixed

New file `backend/app/tests/test_peer_review_postgresql.py`, `threading.Barrier` + FastAPI `TestClient` (each concurrent call gets its own pooled connection), run repeatedly against a real, locally-provisioned PostgreSQL 16.

| ID | Severity | Component | Evidence | Root Cause | Fix | Regression Test |
|---|---|---|---|---|---|---|
| PR-PG-1 | High | `assign_or_invite_reviewer` | Structurally identical to Publication's proven-unsafe pattern | Check-then-insert, no DB constraint | New unique constraints `uq_reviewer_assignment_internal`/`_external` (`round_id`+`reviewer_user_id`/`external_email`) + `IntegrityError → 409` | `test_pg_reviewer_invitation_race_no_duplicate` |
| PR-PG-2 | High | `create_next_review_round` | Same pattern as Publication's version-allocation race | No lock before allocating `round_number` | `.with_for_update()` on the case row | `test_pg_round_creation_race_allocates_distinct_numbers` |
| PR-PG-3 | High | `upload_manuscript_revision` | Count-based numbering (`len(case.revisions)+2`), no DB constraint | Same TOCTOU pattern | `.with_for_update()` on the case row + new `uq_manuscript_revision_version` (`case_id`+`version_number`) + `IntegrityError → 409` | `test_pg_manuscript_revision_race_allocates_distinct_versions` |
| PR-PG-4 | **Critical** | `record_editorial_decision` | No lock, no re-decision guard — a round's decision could be silently overwritten by a second call, concurrent or sequential | No lock; no check that the round wasn't already decided | `.with_for_update()` on the case row **+** a new "already decided" guard (`409` if `round.decision != "PENDING"`) — a round's decision is final; reconsideration requires a new round | `test_pg_conflicting_editorial_decisions_yield_one_authoritative_outcome`, `test_repeated_editorial_decision_on_same_round_rejected` |

All four verified clean across 5+ repeated fresh-database runs each. A fifth race — draft-vs-submit on the same assignment — was tested and found **already safe** (the existing `assignment_id` unique constraint on `ReviewSubmission` plus the newly-added row lock on the four assignment-mutation endpoints keep the persisted state self-consistent regardless of ordering; `test_pg_draft_after_submit_race_does_not_corrupt_state`).

## 8. PostgreSQL Migration Integrity

New migration `e5f6a7b8c9d0_add_peer_review_publication_binding.py` (down_revision `d4e5f6a7b8c9`), on the same real, locally-provisioned PostgreSQL 16 instance used for this session's earlier Publication closure:

```
Fresh upgrade (empty DB → head)              : PASS
Previous-head upgrade (→ d4e5f6a7b8c9 → head) : PASS (separate DB)
Roundtrip (downgrade → d4e5f6a7b8c9 → upgrade) : PASS
Alembic current                               : e5f6a7b8c9d0
Alembic heads                                 : [e5f6a7b8c9d0] — ONE
```

Physical `\d` inspection confirmed all 4 new columns, 3 new foreign keys, and 3 new unique constraints (`uq_reviewer_assignment_internal`, `uq_reviewer_assignment_external`, `uq_manuscript_revision_version`) exactly match the models. No PostgreSQL dialect defects — this migration used the codebase's established conventions from the outset (informed by the prior Publication closure's findings) and required no fix-and-rerun cycle.

**Housekeeping (necessary consequence of extending the chain, same as the earlier Publication closure):** `test_thesis_alembic.py`'s hardcoded `CURRENT_HEAD` constant was stale again (still `d4e5f6a7b8c9`) and was updated to `e5f6a7b8c9d0`.

## 9. Institutional Peer Review Operations Dashboard

New `GET /peer-reviews/organization/operations` (`OWNER`/`ORGANIZATION_ADMIN` only): active-case counts, cases awaiting editor assignment, pending/overdue/completed reviewer-assignment counts, decision distribution by status. **Aggregate-only** — verified by test that the response never contains manuscript titles, reviewer identity, or comment text (`test_institutional_operations_dashboard_is_aggregate_only`).

## 10. Security / Authorization Verification

Re-ran and extended the existing security suite (SQLite and real PostgreSQL):

- Cross-tenant case access: `404` (pre-existing, verified).
- Same-tenant reviewer-to-reviewer IDOR: `404` (pre-existing, verified).
- Double-blind author/reviewer identity masking + confidential-comment stripping: verified at the network response level, not just backend logic (pre-existing test, re-verified).
- Raw external-reviewer token never in audit log, database, or logs (pre-existing, verified).
- **New:** organization admin without case-editor status blocked from case view and decision recording (`403`) — `test_organization_admin_without_case_editor_role_is_blocked`.
- **New:** platform SystemAdmin blocked from decision recording (`403`) — supersedes the old bypass.
- **New:** organization admin without case-editor status blocked from the AI review-summary use case — `test_peer_review_ai_org_admin_without_editor_role_denied` (closes the identical conflation bug found in `context_builder.py::_review_feedback`).
- **New:** editor delegation is OWNER-only and scoped to the assigned case; a non-delegated researcher is blocked before delegation and permitted after — `test_editor_assignment_delegates_scoped_authority`.
- **New:** listed co-author blocked from reviewer assignment when the case is Publication-version-bound — `test_publication_manuscript_version_binding_and_coauthor_conflict`.
- AI governance: the existing `test_peer_review_ai_blind_privacy` and `test_peer_review_ai_wrong_user_denied` (reviewer identity / confidential notes never reach the AI context; cross-tenant AI access blocked) re-verified unaffected.

## 11. Cross-Domain & Backend Regression

- Peer Review suite (SQLite): **20/20 PASS** (14 pre-existing, 1 superseded, 6 new).
- Peer Review suite (real PostgreSQL): **20/20 PASS**.
- `test_ai.py` (AI governance, incl. the new peer-review boundary test): **41/41 PASS**.
- New PostgreSQL concurrency suite: **5/5 PASS**, repeated 5× clean.
- Combined cross-domain regression on a fresh real PostgreSQL database (Peer Review + Publication + Research Data + Thesis, 8 files): **86/86 PASS**.
- Full backend suite (SQLite default, 509 collected): **479 passed, 0 failed, 0 errors, 24 skipped** on the definitive run (the 4 `test_thesis_alembic.py` PG-dependent failures from the run before the `CURRENT_HEAD` fix are resolved and re-verified).
- `git diff --check` on every file touched: clean (only pre-existing CRLF/LF notices).

### Pre-existing, out-of-scope finding (investigated, not fixed)

`test_postgresql_concurrency.py::test_postgresql_dispatcher_claims_event_once` fails when run in the same pytest session as **any** test that creates an outbox `WorkflowEvent` without consuming it (e.g., any reviewer-invitation test) — bisection with unmodified, pre-existing test content proved this is **not caused by this closure's changes**: the test hardcodes an assumption that it is the only source of pending outbox events in the database, an assumption this codebase's growing Peer Review test suite is simply the first to violate. Root-caused precisely (its `[0, 1]` claim-count assertion breaks once more than one pending event exists) but **not fixed**, since it lives entirely outside Peer Review's own code (`ResearchProject`/`OutboxService`/`EventDispatcher`) and touches none of this task's Critical/High gate categories. Flagged for a future, separately-scoped fix.

## 12. IAM Requirements Discovery

`BASEERAH_PEER_REVIEW_IAM_DISCOVERY_REGISTER.md` — complete: personas, account contexts, scopes, permission registry, sensitive permissions, resource relationships, sensitive boundaries, approval authorities, delegation, institutional hierarchy (deferred), cross-domain IAM dependencies (each one verified against actual code, not asserted), access matrix, sensitive access matrix.

## 13. Browser Runtime, Accessibility, Responsive — NOT EXECUTED

Unlike Publication (which had a prior 25/25 Playwright baseline to reuse), **this is the first closure pass for Peer Review**, and no browser environment was exercised in this session. The frontend UI exists and is routed (`ReviewerDashboard.tsx`, `ExternalReviewerPortal.tsx`, `PortalGateway.tsx`, `/app/peer-review`, `/external-review/:token`) but was not driven end-to-end in a real browser, and Axe/keyboard/focus/RTL-LTR-mixed-direction/responsive-320–2560 were not run. This task's own instructions treat browser runtime as mandatory evidence, not something backend tests can substitute for — so this is honestly reported as **NOT EXECUTED**, not fabricated as passing.

**Known frontend consequence of §4's fix:** `ReviewerDashboard.tsx` has no client-side role gating (it relies entirely on server responses) and always renders the invite/decision controls for `OWNER`/`ORGANIZATION_ADMIN` personas. An `ORGANIZATION_ADMIN` who is not a case's assigned editor will now see a control that returns `403` on use. This is a UX-polish gap (the security boundary is correctly enforced server-side either way), not a security gap, and is deferred.

## 14. Deferred Non-Core Capabilities

Reviewer marketplace, paid reviewer management, live external scholarly-reviewer-pool provider, reviewer reputation modeling, automated plagiarism detection, automated editorial decisions, COI override/resolution workflow, department/college/journal-board institutional hierarchy, Global IAM. An automated Peer Review → Publication handoff for the final decision is also deferred — today the `record_editorial_decision` outcome is purely local to the Peer Review domain (safe: it never writes to `ScholarlyAsset.lifecycle_status` or any Publication table) but is not yet wired to Publication's submission-status transition, which remains a manual step.

## 15. Files Changed This Session

```
backend/app/routers/peer_reviews.py                                (resource-scoped editor authority, editor-assignment
                                                                      endpoint, Publication binding, COI signal, 4 locks,
                                                                      2 unique-constraint IntegrityError mappings,
                                                                      re-decision guard, institutional dashboard)
backend/app/models.py                                               (+4 PeerReviewCase columns, 2 new unique constraints)
backend/app/schemas.py                                              (+editor/manuscript-binding fields, EditorAssignmentRequest)
backend/app/services/ai/context_builder.py                          (fixed the identical editor/org-admin conflation bug)
backend/alembic/versions/e5f6a7b8c9d0_add_peer_review_publication_binding.py  (new migration)
backend/app/tests/test_peer_reviews.py                               (1 test superseded, 6 new tests)
backend/app/tests/test_peer_review_postgresql.py                    (new: 5 real-PostgreSQL concurrency tests)
backend/app/tests/test_ai.py                                        (1 new test)
backend/app/tests/test_thesis_alembic.py                            (CURRENT_HEAD kept in sync, as before)
BASEERAH_PEER_REVIEW_IAM_DISCOVERY_REGISTER.md                      (new)
```

Nothing committed — consistent with this session's uncommitted, multi-domain in-flight state.

## 16. Final Dashboard

```
================================================================================

          ⚖️ BASEERAH — PEER REVIEW & EDITORIAL INTELLIGENCE
       FUNCTIONAL, EDITORIAL, INSTITUTIONAL & IAM-READINESS AUDIT

================================================================================

Peer Review Domain Architecture                   : PASS
Publication Integration                           : PASS (additive exact-version binding)
Exact Manuscript Version Binding                  : PASS (case-level; round-level via existing immutable snapshot)
Historical Review Integrity                       : PASS

Human Editorial Authority                         : PASS
Editor Resource Scope                             : PASS (fixed — was organization-role-based)

Reviewer Candidate / Invitation                   : PASS
Conflict-of-Interest Screening                    : PASS (self-declaration + co-author signal)
COI Override Governance                           : N/A (not implemented — safe-by-default, deferred)

External Reviewer Portal / Magic-Link Token       : PASS (pre-existing, re-verified)
Single/Double-Blind Governance                    : PASS (pre-existing, network-level, re-verified)

Structured Review / Reviewer Recommendation       : PASS
Recommendation ≠ Editorial Decision               : PASS
Confidential Comment Leakage                      : BLOCKED

Human Editorial Decision                          : PASS
Editorial Decision Integrity                      : PASS (fixed — re-decision guard added)
Revision / Additional Round                       : PASS

Institutional Editorial Operations                : PASS (new, aggregate-only)
Organization Admin Confidential/Decision Access    : BLOCKED (fixed)
Platform Admin Review Content/Decision Access      : BLOCKED (fixed — superseded a prior bypass)

AI Human Authority                                : PASS
AI Cross-Review / Blind-Identity / Confidential Leakage : BLOCKED
AI Org-Admin Escalation                           : BLOCKED (fixed)

Cross-Tenant Review Access                        : BLOCKED
Same-Tenant Review IDOR                           : BLOCKED
Reviewer Assignment / Report IDOR                 : BLOCKED
Editorial Decision Spoofing                       : BLOCKED

PostgreSQL Fresh Migration                        : PASS
Previous-Head Upgrade                             : PASS
Migration Roundtrip                               : PASS
Alembic Single Head                               : PASS (e5f6a7b8c9d0)
Schema Alignment                                  : PASS

Reviewer Invitation Concurrency                   : PASS (duplication found & fixed)
Round Creation Concurrency                        : PASS (race found & fixed)
Revision Numbering Concurrency                    : PASS (race found & fixed)
Editorial Decision Concurrency                    : PASS (lost-update risk found & fixed)
Draft/Submit Concurrency                          : PASS (verified already safe)

Peer Review Core Tests (SQLite)                   : 20 / 20
Peer Review Core Tests (real PostgreSQL)          : 20 / 20
AI Governance Tests                               : 41 / 41
PostgreSQL Concurrency Tests                      : 5 / 5
Combined Cross-Domain Regression (real PostgreSQL): 86 / 86
Backend Full Regression (SQLite)                  : 479 / 479 (24 skipped, PG-gated)

git diff --check                                  : PASS

Peer Review IAM Register                          : COMPLETE
Global IAM                                        : DEFERRED AS PLANNED

Browser / Playwright E2E                          : NOT EXECUTED
Accessibility (Axe)                               : NOT EXECUTED
Keyboard / Focus                                  : NOT EXECUTED
RTL / LTR / Mixed Direction                       : NOT EXECUTED
Responsive 320–2560                               : NOT EXECUTED

Detected Regressions (Peer Review scope)          : 0
Open Critical Findings                            : 0
Open High Findings                                : 0
Out-of-scope pre-existing finding (documented, not fixed) : 1 (test_postgresql_concurrency.py isolation gap)

================================================================================

FINAL STATUS:

CLOSED WITH CONDITIONS

================================================================================
```

## Conditions

1. **Browser/Playwright E2E, Axe accessibility, keyboard/focus, RTL/LTR/mixed-direction, and responsive 320–2560 were not executed** — this domain has no prior baseline to reuse (unlike Publication), and this session did not exercise a real browser. All backend, security, PostgreSQL, and concurrency evidence is real and repeated; frontend runtime evidence is not.
2. **UX-polish gap**: the frontend does not yet hide editor-only controls from a non-editor organization admin (the backend correctly returns `403`; the button is simply still visible).
3. **Pre-existing, unrelated test-isolation gap** in `test_postgresql_concurrency.py::test_postgresql_dispatcher_claims_event_once`, root-caused but not fixed (out of scope — touches no Peer Review code).
4. **COI override/resolution workflow** and **automated Peer Review → Publication decision handoff** are intentionally deferred, documented, and safe by default (no unauthorized state changes possible in their absence).

None of these conditions involve an open Critical or High finding within the Peer Review domain's own security or functional boundary — all of §227's listed Critical/High categories (reviewer/author identity leakage, confidential comment leakage, token scope bypass, cross-tenant access, unauthorized editorial decision, escalation, lost editorial decision, duplicate case/round) are verified blocked or fixed with real, repeated evidence. The status is `CLOSED WITH CONDITIONS` rather than `VERIFIED & CLOSED` specifically because this task's own instructions treat browser runtime as mandatory, non-substitutable evidence, and that evidence was not produced in this pass.
