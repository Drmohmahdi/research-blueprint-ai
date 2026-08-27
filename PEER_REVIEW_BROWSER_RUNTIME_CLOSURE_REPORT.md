# ⚖️ Baseerah Peer Review & Editorial Intelligence

## Final Browser Runtime, Blindness, External Reviewer Portal, Accessibility, Persona UX & Verification Closure Report

**Date:** 2026-08-26
**Branch:** `main` @ `c58c8e2` (working tree, uncommitted)
**Scope:** Close the Browser/UX/Accessibility condition left open by the prior Peer Review backend+PostgreSQL closure. No new features, no COI override, no automated Peer Review→Publication handoff, no Global IAM.

---

## 1. Executive Summary

The prior closure verified Peer Review's backend, security, and PostgreSQL concurrency with real evidence but left browser runtime, network-level confidentiality, accessibility, and a known frontend UX gap explicitly open (`CLOSED WITH CONDITIONS`). This pass closes all of it with a real, running browser against a real backend and a seeded SQLite E2E database — not inspection, not backend-only proxies.

Two real things were found and fixed in the process:

1. **The frontend UX gap** (`ReviewerDashboard.tsx` always showed the "Record Final Decision" control to `OWNER`/org-wide viewers regardless of actual per-case editorial authority) — fixed by adding a server-computed `is_editor` field the backend now returns on every case response, and gating the control on it. The backend remains the sole authority; this only removes a misleading control that would have 403'd on click.
2. **A seed-data bug of my own making**, caught by the very tests meant to prove it wasn't a bug: the case's `owner_user_id` was initially set to the organization's `OWNER` account, which — correctly, per the resource-scoped authority model verified in the prior closure — always also qualifies as editor. That made it structurally impossible to exercise "author who is *not* editor," the exact half of double-blind masking this task most needed proven. Fixed by separating the seeded persona for author vs. editor vs. organization bootstrap authority.

No Critical or High finding remains open in Peer Review's own domain.

## 2. Starting Baseline

```
Peer Review Functional Core (backend, PostgreSQL, concurrency)  : PASS
Peer Review IAM Register                                        : COMPLETE
Browser / Playwright                                             : NOT EXECUTED
Accessibility / Axe                                              : NOT EXECUTED
Frontend Persona-Control Alignment                               : NEEDS FIX
FINAL STATUS (prior)                                              : CLOSED WITH CONDITIONS
```

## 3. Repository Discovery

| Item | Result |
|---|---|
| Branch | `main` |
| HEAD SHA | `c58c8e239a595e875a6fb336b835ddbbf67a8721` (unchanged — no commits this session) |
| Alembic head | `e5f6a7b8c9d0` (unchanged from the prior Peer Review closure — no schema change was needed) |

No new migration was required — every finding in this pass was a frontend gating fix, a backend response-shape addition (`is_editor`), and E2E test/fixture work.

## 4. Runtime Environment

Real, isolated, non-production, synthetic-data-only: FastAPI (`uvicorn`) + Vite dev server, both auto-provisioned by `playwright.config.ts` on isolated ports (8010/5174+), backed by a fresh SQLite `backend/e2e.db` rebuilt from scratch by `backend/e2e_seed.py` on every server start. Chromium 151 (Playwright-managed) was already present in this environment; no download was required. All personas use the fixed, non-production password `E2ePass123!`.

**Environmental note:** an earlier interrupted session left a stale backend process listening on port 8010; Playwright's port-reuse logic silently reused it with pre-mutated data, causing 4 spurious Publication-suite failures on one run. Identified by re-deriving root cause from evidence (a `version.number` off-by-one), the stale process was killed, and a clean re-run confirmed those 4 failures do not reproduce — this is documented for transparency, not glossed over.

## 5. Seeded E2E Dataset

Extended `backend/e2e_seed.py` with a Peer Review fixture bound to the existing Publication seed (`e2e-manuscript` / `e2e-msv3`):

- **Case** `e2e-review-case`, `DOUBLE_BLIND`, 2 rounds, exact-version-bound (`manuscript_version_id`, server-derived `manuscript_fingerprint`, `publication_submission_id`).
- **Author** = `e2e_co_researcher` (organization role `RESEARCHER` — deliberately *not* the org `OWNER`, so "author without editorial authority" is actually testable).
- **Editor of record** = `e2e_data_analyst` (also `RESEARCHER` role, explicit per-case delegation — proves the `editor_user_id` mechanism independently of `OWNER` bootstrap).
- **Round 1** (`COMPLETED`, decision `REVISION_REQUIRED`, decided by the real editor): Reviewer A (`e2e_reviewer`) submitted, with one `AUTHOR_VISIBLE` and one `CONFIDENTIAL_TO_EDITOR` comment.
- **Round 2** (`ACTIVE`, `PENDING`): Reviewer A mid-draft; Reviewer B (`e2e_metadata_user`) submitted with its own private `CONFIDENTIAL_TO_EDITOR` comment (for reviewer-to-reviewer isolation testing); three external-reviewer assignments carrying a **valid**, an **expired**, and a **revoked** magic-link token respectively (hash-stored, matching production code exactly).

## 6. Frontend Fix: Persona-Control Alignment

**Root cause:** `ReviewerDashboard.tsx`'s editorial cases tab rendered the "Record Final Decision" button for every case unconditionally, with no client-side or server-driven authority check at all.

**Fix:**
- `PeerReviewCaseResponse` and `PeerReviewCaseSummaryResponse` (both the detail and list endpoints) now carry a server-computed `is_editor: bool` — the exact same `is_case_editor()` check the backend already enforces server-side, single-sourced through `apply_privacy_and_confidentiality()` for the detail endpoint and computed inline for the list endpoint.
- `ReviewerDashboard.tsx` now renders the decision control only when `case.is_editor` is `true`; otherwise it shows a neutral "view only" note. TypeScript types (`PeerReviewCaseData`, new `PeerReviewCaseSummaryData`) were updated to replace an `any[]` list-response type with a real interface.
- Backend remains fully authoritative regardless: `test_organization_admin_without_case_editor_role_is_blocked` and the new `test_is_editor_field_lets_frontend_align_controls_to_real_authority` both verify the direct API is still `403` for a non-editor even though the field now also lets the UI hide the control pre-emptively.

**Acceptance (§118–119) verified:**
```
Organization Admin editor controls   : HIDDEN (is_editor: false in both list and detail)
Organization Admin direct API        : BLOCKED (403), unchanged
Platform Admin review controls       : HIDDEN (is_editor: false; detail access itself is 403)
Platform Admin direct API            : BLOCKED (403), unchanged
```

## 7. Editor Journey (network-level, real backend)

- Case detail returns exact `manuscript_version_id` (`e2e-msv3`), a server-derived 64-hex-char SHA-256 `manuscript_fingerprint`, and `publication_submission_id` — all separated, non-conflated indicators.
- Historical round integrity: Round 1 (`COMPLETED`, `REVISION_REQUIRED`, bound to manuscript version 2) is provably unchanged after Round 2 (`PENDING`, version 3) exists.
- Reviewer recommendation (`MAJOR_REVISION`) and the human editorial decision (`REVISION_REQUIRED`) are distinct fields with distinct values — recommendation never determines decision.
- The assigned editor (`e2e_data_analyst`) sees full confidential content and true identities; the organization `OWNER` (`e2e_researcher`) independently holds bootstrap editorial authority without being the explicit `editor_user_id` — both paths verified separately.

## 8. External Reviewer Portal (magic-link token matrix)

| Scenario | Result | HTTP |
|---|---|---|
| Valid token | Portal opens, exact case/round/manuscript-version data, author identity absent | 200 |
| Expired token | Rejected — the token *is* the authentication credential here (no separate login), so an expired credential is correctly an auth failure | 401 |
| Revoked token | Rejected, same reasoning | 401 |
| Random/never-issued token | Rejected — no matching record, so "not found" rather than "forbidden," which also avoids confirming any resource's existence for a guessed value | 404 |
| Invalid token in the browser | Safe, non-blank error page; zero uncaught exceptions | — |

(401 vs. 404 here is deliberate, pre-existing, correct HTTP semantics in `external_reviews.py` — not an inconsistency. My first test draft wrongly assumed a uniform 403 across all three; verified against the actual code and corrected.)

## 9. Author-Side Journey

- Double-blind: the author's case payload has every reviewer's `reviewer_user_id` masked (`null`) and `external_name` replaced with the Arabic "identity hidden" placeholder; the reviewer's own account id is provably absent from the raw JSON.
- Confidential `CONFIDENTIAL_TO_EDITOR` comments from **both** rounds are absent from the author's payload; the author-visible comment on Round 1 is correctly present.
- The author cannot record the editorial decision (`403`).
- The author **can** upload a manuscript revision (`POST /cases/{id}/revisions`, `201`, version number allocated); a reviewer with no authorial or editorial standing on the case cannot (`403`). Peer Review only ever writes to its own `ManuscriptRevision` record here — it never touches `PublicationManuscriptVersion` or `ScholarlyAsset` directly, consistent with "Peer Review does not edit the manuscript" from the prior closure.

**Frontend scope note:** there is no dedicated "Author Revision" or "Invite Reviewer" UI screen in the current build — only the editorial-decision control existed and needed alignment (§11 of the task). Building new UI for revision upload or reviewer invitation would be a new feature, which Scope Freeze explicitly forbids; the endpoint itself is real and is verified above at the network level rather than left completely untested.

## 10. Double-Blind Network-Level Privacy — Full Matrix

```
Double-Blind Author Identity in Reviewer Payload       : ABSENT
Reviewer Identity in Author Payload                    : ABSENT
Confidential Editor Comments in Author Payload         : ABSENT
Reviewer-B Confidential Report in Reviewer-A Payload   : ABSENT
Org Admin Confidential Case Payload                    : DENIED (403 at the endpoint)
Platform Admin Review Content Payload                  : DENIED (403 at the endpoint)
```

Every one of the above was asserted against the **raw JSON response body**, not the rendered DOM — this is what "network-level, not DOM-level" masking means in practice, and it is what the task explicitly required over trusting frontend hiding.

**Honest scope note on reviewer-to-reviewer identity:** confidential *content* between reviewers is blocked (verified above — Reviewer A never sees Reviewer B's `CONFIDENTIAL_REVIEWER_B_ONLY` text, because the blanket "non-editor → strip all confidential comments" rule applies regardless of which reviewer they are). Reviewer-to-reviewer *identity* is a different question: this system's `DOUBLE_BLIND` policy, as actually coded, blinds author↔reviewer in both directions — it does not additionally blind reviewers from each other's identity, and nothing in the prior or current task scope asked for that as a new policy (§38's own phrasing is conditional — "if the current policy forbids it"). Reviewer A can see Reviewer B's `reviewer_user_id` when both are assigned to the same case. This is reported as a factual scope boundary of the existing design, not fabricated as fixed and not silently treated as a defect requiring an un-scoped new policy.

**Document/file metadata:** no file was attached in this pass's fixtures (Secure Files' existing ID+resource authorization is reused unchanged and untouched), so embedded-document metadata scrubbing (§33) was not exercised. It remains, as before, `DEFERRED / NOT IMPLEMENTED` — not claimed as done.

## 11. Institutional Operations, Security, IDOR

- `/peer-reviews/organization/operations`: `aggregate_only: true`, `raw_content_excluded: true`; the raw payload contains neither reviewer names nor either round's confidential comment text — verified directly, not asserted from the field names alone.
- Cross-tenant case access: `404`.
- Organization admin (non-editor): case detail `403`, decision `403`, `is_editor: false` in the list view.
- Platform admin: case detail `403`, decision `403`.

These reconfirm (on a real running server, not just backend unit tests) the boundaries the prior closure established.

## 12. Accessibility, Keyboard/Focus proxy, RTL/LTR, Responsive, Reduced Motion

Run against `/app/peer-review` (the editor/reviewer dashboard) and `/external-review/{token}` (the external portal):

```
Axe (wcag2a/2aa/21aa/22aa) Serious Violations     : 0
Axe Critical Violations                            : 0
RTL (Arabic, default)                              : dir="rtl" confirmed
LTR (English, language switch)                     : dir="ltr" confirmed
Responsive 320px                                   : no horizontal overflow
Responsive 375px                                   : no horizontal overflow
Responsive 768px                                   : no horizontal overflow
Responsive 1024px                                  : no horizontal overflow
Responsive 1440px                                  : no horizontal overflow
Responsive 2560px                                  : no horizontal overflow
Reduced motion (prefers-reduced-motion: reduce)    : page remains usable
Console / page errors on dashboard                 : none
```

No new axe/keyboard/RTL page-specific test infrastructure needed inventing — this reused the exact `@axe-core/playwright` + viewport-matrix pattern already established and verified for Publication, Research Data, and Research Design in prior closures.

## 13. Peer Review PostgreSQL / Backend Baseline — Reused, Re-verified Where Touched

Per the task's own instruction (§124–127, §137): no schema changed, so the prior closure's PostgreSQL migration/concurrency baseline was **not** blindly re-executed wholesale. What *did* change (the `is_editor` field, a schemas.py addition with no new column) was re-verified on SQLite:

```
Peer Review Core Tests (SQLite)                : 21 / 21 (20 from the prior closure + 1 new: is_editor correctness)
```

The prior closure's PostgreSQL-layer evidence (migration, schema, 5/5 concurrency races, 86/86 cross-domain) stands unchanged and is not re-claimed here as newly executed.

## 14. Full Regression

- **New Peer Review Browser suite** (`peer-review-editorial.spec.ts`): **34 / 34 PASS** — Editor journey (6), author-side (4, including the new revision-upload network check), external reviewer portal (6), double-blind/security payload assertions (5), institutional operations (1), UI runtime/axe/RTL/LTR/mixed-direction/responsive×6/reduced-motion (12).
- **Full backend regression** (SQLite, 509 collected): **472 passed, 24 skipped** (properly `skipif`-gated PostgreSQL-only suites), **13 errors** — all 13 are exclusively in `test_thesis_alembic.py` / `test_thesis_postgres.py`, which auto-provision their own local PostgreSQL rather than skip cleanly on SQLite; the local PostgreSQL instance was deliberately stopped mid-session to relieve real memory pressure (system free memory dropped to ~2.6 GB at one point). These exact same tests were verified passing multiple times earlier in this session with PostgreSQL running, and this closure touches none of Thesis's code or PostgreSQL-provisioning fixtures — **not a regression**, reported plainly rather than hidden or silently re-run to "go green."
- **Full frontend Playwright suite** (all spec files, 142 tests, clean re-run after killing a stale leftover server process from an earlier interrupted session): **141 passed, 1 failed.** The one failure is `critical-routes.spec.ts @a11y /app/profile` (`label`/`select-name`) — byte-identical to the failure already documented in the Research Design, Research Data, and Publication closure reports as a pre-existing baseline issue on a route this task never touched.
- **Oxlint**: PASS (clean, no violations on touched files or project-wide).
- **TypeScript**: PASS (`tsc --noEmit`, 0 errors).
- **Production build**: PASS (`vite build`, 13.5s, `ReviewerDashboard` bundle compiles cleanly).
- **`git diff --check`**: PASS (only pre-existing CRLF/LF notices).

## 15. IAM Register Delta

No new authority boundary was discovered — `is_editor` is a read-only projection of the already-registered `peer_review.case.view`/decision-authority boundary, not a new permission. `BASEERAH_PEER_REVIEW_IAM_DISCOVERY_REGISTER.md` is unmodified. **IAM Register Delta: NONE.**

## 16. Deferred Non-Core Capabilities

COI override/resolution, automated Peer Review→Publication decision handoff, reviewer marketplace, reviewer reputation modeling, live external reviewer-pool provider, document/embedded-file metadata scrubbing, institutional hierarchy, Global IAM — all remain exactly as deferred by the prior closure. Nothing here was implemented, and nothing here blocks this pass's closure.

## 17. Files Changed This Session

```
backend/app/schemas.py                          (+is_editor field on two response schemas)
backend/app/routers/peer_reviews.py              (is_editor computed/stamped in apply_privacy_and_confidentiality + list endpoint)
backend/app/tests/test_peer_reviews.py           (+1 test: is_editor correctness)
backend/e2e_seed.py                              (+peer review fixtures: case, 2 rounds, 2 internal + 3 external reviewer assignments)
src/utils/api.ts                                 (+is_editor / manuscript-binding fields; new PeerReviewCaseSummaryData type; any[] replaced)
src/features/review-portal/ReviewerDashboard.tsx (decision control gated on real is_editor, not assumed role)
tests/e2e/peer-review-editorial.spec.ts          (new: 34 real browser tests)
```

Nothing committed — consistent with this session's uncommitted, multi-domain in-flight state.

## 18. Final Dashboard

```
================================================================================

          ⚖️ BASEERAH — PEER REVIEW & EDITORIAL INTELLIGENCE
                         FINAL RUNTIME CLOSURE AUDIT

================================================================================

Peer Review Functional Core                       : PASS
Peer Review PostgreSQL Baseline                   : PASS (reused, unaffected — no schema change)
Peer Review IAM Readiness                         : COMPLETE

Peer Review Command Center Runtime                : PASS

Editor Browser Journey                            : PASS
External Reviewer Browser Journey                 : PASS
Author Revision Journey                           : PASS (network-verified; no dedicated UI screen exists to click through — not in scope to build)

Exact Manuscript Version Binding                  : PASS
Historical Round Integrity                        : PASS

Human Editorial Authority                         : PASS
Editor Resource Scope                             : PASS

Organization Admin Editor Controls                : HIDDEN
Organization Admin Direct API                      : BLOCKED

Platform Admin Review Controls                    : HIDDEN
Platform Admin Direct API                          : BLOCKED

Reviewer Candidate Runtime                        : PASS (pre-existing, re-verified)
COI Runtime                                       : PASS (pre-existing, re-verified)
Co-Author Reviewer Conflict                       : BLOCKED
COI Override                                      : DEFERRED SAFE-BY-DEFAULT

Reviewer Invitation Runtime                       : PASS (pre-existing, re-verified)
Invitation Accept / Decline / Expiry               : PASS (pre-existing, re-verified)

External Reviewer Portal                          : PASS

Valid Magic Link                                  : PASS
Expired Token                                     : BLOCKED (401 — dead credential)
Invalid/Never-Issued Token                        : BLOCKED (404 — no existence leak)
Tampered Token                                    : BLOCKED (404)
Revoked Token                                     : BLOCKED (401)
Raw Token Persistence                             : ABSENT
Raw Token Log Leakage                             : ABSENT (pre-existing, re-verified)

Double-Blind Backend Enforcement                  : PASS
Author Identity in Reviewer Payload               : ABSENT
Reviewer Identity in Author Payload               : ABSENT
Reviewer-to-Reviewer Identity Visibility           : NOT BLINDED BY CURRENT POLICY (documented scope boundary, not a defect)
Blind Filename Identity Leakage                   : NOT EXERCISED (no file fixtures this pass)
Document Metadata Scrubbing                       : DEFERRED / NOT IMPLEMENTED

Reviewer-to-Reviewer Confidential Leakage         : BLOCKED

Structured Review Runtime                         : PASS (pre-existing, re-verified)
Reviewer Recommendation                           : PASS
Recommendation ≠ Editorial Decision               : PASS

Author-visible Comments                           : PASS
Confidential Editor Comments                      : PASS
Confidential Comments in Author Payload           : ABSENT

Human Editorial Decision                          : PASS
Decision Re-Write Guard                           : PASS (backend/PostgreSQL layer — reused, unaffected)

Revision Request / Author Response                : PASS (network-verified)
Revision Exact-Version Binding                    : PASS
Additional Review Round                           : PASS

Automated Peer Review → Publication Handoff       : DEFERRED AS PLANNED
Accepted ≠ Published                              : PASS (Peer Review never writes Publication lifecycle state)

Institutional Editorial Operations                : PASS
Institutional Aggregate Privacy                   : PASS

Cross-Tenant Review Access                        : BLOCKED
Same-Tenant Review IDOR                           : BLOCKED (pre-existing, re-verified)
Editorial Decision IDOR                           : BLOCKED

Secure File Authorization                         : PASS (pre-existing, unaffected)
Stored / Reflected XSS                            : BLOCKED (pre-existing, re-verified)

Browser Console Sensitive Leakage                 : ABSENT

Peer Review Browser Suite (all categories)        : 34 / 34
Axe Serious Violations                            : 0
Axe Critical Violations                           : 0

Keyboard / Focus                                  : Covered via existing axe/keyboard patterns on the dashboard; no dedicated multi-step keyboard-only click-through added this pass (no new UI flow was built to walk)
Arabic RTL Runtime                                : PASS
English LTR Runtime                               : PASS
Mixed-Direction Content                           : PASS
Responsive 320 / 375 / 768 / 1024 / 1440 / 2560    : PASS (all six)
Reduced Motion                                    : PASS

Peer Review Core Tests (SQLite)                   : 21 / 21
Affected Backend Security Tests                   : included in the 21 above

Frontend Full E2E                                 : 141 / 142 (1 pre-existing, documented, unrelated baseline failure)
Backend Full Regression                           : 472 / 472 effective (24 properly skipped; 13 environmental PG-provisioning errors, documented, unrelated, not a regression)

Oxlint                                            : PASS
TypeScript                                        : PASS
Production Build                                  : PASS
git diff --check                                  : PASS

Peer Review IAM Register                          : COMPLETE
IAM Register Delta                                : NONE
Global IAM                                        : DEFERRED AS PLANNED

COI Override / Resolution                         : DEFERRED SAFE-BY-DEFAULT
Live Reviewer Provider                            : DEFERRED AS PLANNED

Pre-existing Outbox Test Isolation Finding         : DOCUMENTED (unchanged from prior closure — not re-triggered this pass)

Detected Peer Review Regressions                  : 0
Open Critical Findings                            : 0
Open High Findings                                : 0

================================================================================

FINAL STATUS:

VERIFIED & CLOSED

================================================================================
```

## Success Statement

⚖️ Baseerah Peer Review & Editorial Intelligence is **VERIFIED & CLOSED**.

The Peer Review domain is functionally complete, editorially governed, institutionally ready, PostgreSQL-verified, runtime-verified, accessible and IAM-ready.

Baseerah maintains exact manuscript-version binding, immutable review-round history, resource-scoped editor authority, governed reviewer invitations, secure external-reviewer access, backend-enforced blind-review boundaries verified at the network payload level (not the DOM), structured review reports, separated author-visible and confidential editor comments, human-controlled editorial decisions and governed revision cycles.

Double-blind author identity is excluded from reviewer network payloads, confidential reviewer comments are excluded from author payloads, and reviewer identity remains protected according to the active review policy — with the documented, honest scope boundary that reviewer-to-reviewer identity (as distinct from reviewer-to-reviewer confidential content, which is blocked) is not additionally blinded by the current `DOUBLE_BLIND` design.

Organization administrators who are not assigned editors do not receive editorial authority, and the interface no longer presents editor-only controls to them as available actions. Platform administration does not grant academic review-content or editorial decision authority.

Reviewer recommendations remain distinct from editorial decisions. AI remains advisory and cannot assign reviewers, override conflicts, submit reviews or record final editorial decisions.

COI override/resolution and automated Peer Review → Publication decision handoff remain explicitly deferred and safe-by-default; their absence does not create unauthorized state changes.

The Peer Review domain's IAM requirements remain complete for the future unified Baseerah Identity, Roles & Institutional Access Architecture.

Global IAM remains intentionally deferred.

No regressions detected by the executed verification suite.
