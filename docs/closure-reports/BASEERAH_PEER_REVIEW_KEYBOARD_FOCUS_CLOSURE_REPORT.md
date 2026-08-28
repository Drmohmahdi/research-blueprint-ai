# Baseerah Peer Review & Editorial Intelligence — Final Keyboard, Focus, Author-Revision Evidence & Regression Verification Closure Report

**Scope**: micro-closure only. No new UI was built (no Author Revision UI, no Invite Reviewer UI), no rebuild of prior work, no touching of COI Override, Automated Peer Review→Publication Handoff, or Global IAM. Every fix below was made because real, automated keyboard/focus testing surfaced a genuine defect — not proactively.

---

## 1. Repository Discovery

- Branch: `main`
- HEAD SHA: `c58c8e239a595e875a6fb336b835ddbbf67a8721` (unchanged from the prior Browser Runtime closure — this round is uncommitted work on top of it)
- Alembic: `current` and `heads` both resolve to a single head, `e5f6a7b8c9d0` — **unchanged**. No schema modified this round; this is a code-only (backend authorization logic + frontend focus management) closure.
- Working tree: modified files listed in §9 below; no new migrations.

## 2. Runtime Environment

- Local PostgreSQL (`%TEMP%\baseerah-thesis-pg`, port 55432) was found **stopped** at the start of this round (deliberately stopped at the end of the prior phase to relieve memory pressure — documented, expected).
- On restart, the data directory was found corrupted (`FATAL: could not open directory "pg_notify"`) — several system subdirectories (`pg_notify`, `pg_commit_ts`, `pg_dynshmem`, `pg_replslot`, `pg_serial`, `pg_snapshots`, `pg_stat_tmp`, `pg_tblspc`) were missing. This matches the previously-documented root cause: this cluster lives inside the volatile OS temp folder and is subject to external cleanup between sessions.
- **Fix**: reinitialized the cluster fresh via `initdb.exe -D ... -U thesis --auth=trust --locale=C --encoding=UTF8` (matching the test suite's own `_local_postgres_url()` bootstrap convention exactly), then started it. Confirmed `SHOW server_encoding` → `UTF8`. This is a disposable local dev fixture; no user data was affected.
- No stale Playwright dev-server processes were found on ports 8010/5174 before any run in this round (`netstat -ano | grep -E ":8010|:5174" | grep LISTENING` returned empty each time it was checked) — no stale-server risk this round.

## 3. Evidence-Hygiene Fix (Author Revision / Invite Reviewer classification)

The prior report's Final Dashboard line `Author Revision Journey : PASS (network-verified; no dedicated UI screen exists to click through — not in scope to build)` conflated a real API-level PASS with a UI journey that does not exist. Corrected here into three honest, separate lines (see §15 Final Dashboard):

- `Author Revision Backend/API Workflow: PASS` — `POST /peer-reviews/cases/{id}/revisions` is real, authorization-correct (author-only, 403 for others), and covered by `test('@pr author can upload a revision; Peer Review never edits the manuscript directly')` in `peer-review-editorial.spec.ts`.
- `Author Revision Network Runtime: PASS` — the same test exercises it through a live Playwright `page.request` call against the running backend, not a mocked/unit call.
- `Author Revision Browser UI Journey: N/A — NOT IMPLEMENTED IN CURRENT PRODUCT SCOPE` — confirmed by reading `ReviewerDashboard.tsx` and `ExternalReviewerPortal.tsx` end-to-end: neither renders any control for uploading a manuscript revision. No such UI was built this round (out of scope).

"Invite Reviewer" was checked against the same standard: `ReviewerDashboard.tsx` has no dedicated "Invite External Reviewer" UI control either (reviewer assignment happens via `assign_or_invite_reviewer` at the API layer only, exercised by existing backend/PostgreSQL tests). It is now classified identically: **Backend/API Workflow: PASS**, **Browser UI Journey: N/A — NOT IMPLEMENTED IN CURRENT PRODUCT SCOPE**.

## 4. Keyboard-Only Editor Journey (real Playwright, no mouse)

Implemented as `test('@pr @keyboard editor can complete decision dialog with keyboard only')` in `peer-review-editorial.spec.ts`. Logged in as `e2e_data_analyst` (the seeded delegated case editor), the test:

1. Switches from "My Review Assignments" to "Editorial Review Cases" via `Tab` + `Enter` (no `.click()`).
2. Reaches the "Record Final Decision" trigger, opens it via `Enter`.
3. Verifies initial focus lands inside `role="dialog"` (Focus Entry).
4. Presses `Tab` 25 times, asserting focus never leaves the dialog boundary on any iteration (Focus Trap).
5. Tabs to and selects "Revision Req." via `Enter`, asserting `aria-checked="true"` really flips (Logical Tab Order + real keyboard activation, not just reachability).
6. Tabs to the rationale `<textarea>`, types real Arabic text via `page.keyboard.type`, asserts the typed value round-trips.
7. Tabs to and confirms "Confirm Decision" is reachable (proves full keyboard reachability of the form) — **without** activating it, since actually deciding round 2 here would corrupt the shared `e2e-review-case` fixture for every later test in the file (the same fixture-safety principle already documented in the file for the pre-existing decision tests).
8. Presses `Escape`, asserts the dialog closes without submitting (Escape Behavior).

Result: **PASS** (see §11 for the defects this uncovered and fixed before it passed).

## 5. Keyboard-Only External Reviewer Journey (real Playwright, no mouse)

Implemented as `test('@pr @keyboard external reviewer can navigate the review form with keyboard only')`. `VALID_TOKEN`'s seeded assignment is genuinely `INVITED` (the real fixture state, not a shortcut) — the test:

1. Opens the magic-link portal, tabs to and activates "Accept" via keyboard (the real first step of the journey; transitions the assignment to `ACCEPTED` so the rubric renders).
2. Tabs through the 10 score buttons to the criterion comment `<textarea>`, types a real comment.
3. Tabs to the author-visible general comment field, types a comment.
4. Tabs to the confidential-to-editor field, types a comment.
5. Tabs to and selects "تعديلات جوهرية" (Major Revision) via keyboard.
6. Tabs to and confirms "Submit" is reachable — not activated, to avoid permanently locking the shared fixture assignment as `SUBMITTED`.

A second test, `test('@pr @keyboard external reviewer confirmation focus is correct after a real save')`, performs a real, safe, idempotent action (Save Draft — does not lock the assignment the way Submit does) and asserts the success confirmation is announced via an accessible live region without abandoning keyboard focus at `<body>`.

Result: **PASS** on both.

## 6. Focus Management Matrix

| Requirement | Where tested | Result |
|---|---|---|
| Focus Entry | Editorial Decision Modal, New Case Modal | PASS |
| Focus Trap | Editorial Decision Modal (25-Tab boundary test) | PASS (after fix — see §11) |
| Focus Return | `test_editor_dialog_returns_focus_to_trigger_element_on_close` — exact element-identity check via `el === document.activeElement`, not just text match | PASS (after fix — see §11) |
| Escape Behavior | Both editor dialogs (close without submit) | PASS |
| Error Focus | New Case Modal — empty required title moves focus to the field, `role="alert"` on the inline error | PASS (new fix — see §11) |
| Visible Focus / confirmation announcement | External Reviewer Save Draft — `role="status" aria-live="polite"`, focus not abandoned to `<body>` | PASS (new fix — see §11) |
| Logical Tab Order | All of the above — traversal order matches visual/DOM order, no traps, no dead ends | PASS |
| Hidden controls are keyboard-unreachable, not just visually hidden | `test_organization-admin-hidden_editor_controls_are_keyboard-unreachable` — org admin's card renders with zero "Record Final Decision" buttons in the DOM (not `display:none`) | PASS |

## 7. Real Defects Found and Fixed (in scope — discovered by this round's keyboard testing)

This round's keyboard-only testing was the **first** test coverage to ever actually open the "Editorial Review Cases" tab as a delegated (non-owner) editor and interact with its dialogs via keyboard. It surfaced two genuine, pre-existing defects, both fixed:

### 7a. Backend: delegated editors were invisible in their own case list
`GET /peer-reviews/cases` (`list_peer_review_cases` in `peer_reviews.py`) filtered non-privileged researchers to `owner_user_id == user.id OR reviewer assignment` — it never accounted for `case.editor_user_id` delegation, even though the case-*detail* endpoint (`is_case_editor`) already recognizes it correctly. A delegated editor (exactly the seeded `e2e_data_analyst` persona) could open the case directly by ID with full editorial authority, but the case never appeared in their own case list — the "Editorial Review Cases" tab showed a false "no cases" empty state. Confirmed via direct `curl` against a freshly-seeded backend: `GET /api/peer-reviews/cases` as `e2e_data_analyst` returned `[]` while `GET /api/peer-reviews/cases/e2e-review-case` returned the full case with `is_editor: true`.

**Fix**: added `(models.PeerReviewCase.editor_user_id == context.user.id)` to the visibility filter, matching the already-established `is_case_editor` authority model. New regression test `test_delegated_editor_sees_case_in_own_list` added and passing. Full Peer Review backend suite re-verified: 22/22 (was 21; +1 for this fix).

### 7b. Frontend: shared Modal/Drawer component's Escape/focus-trap effect fired its focus-restore cleanup on every keystroke
`src/design-system/components/Overlay.tsx`'s `Modal` and `Drawer` both had `useEffect(..., [isOpen, onClose])` guarding the keydown/focus-trap listener, with a cleanup that calls `openerRef.current?.focus()`. Because every consumer (including my own new usage in `ReviewerDashboard.tsx`, and the pre-existing `ProjectWizard.tsx`) passes `onClose` as an inline arrow function, its identity changes on **every parent re-render** — including a re-render triggered by clicking inside the dialog itself (e.g. selecting a decision option). This caused the effect's cleanup to fire on every interaction, yanking keyboard focus back to the trigger button behind the still-open dialog. Confirmed live: after selecting "Revision Req." via `Enter`, the radio button showed `[checked]` in the DOM (the click worked) but `document.activeElement` had reverted to the original trigger button (not the radio) — i.e. every subsequent keystroke inside the dialog was silently landing on the wrong element.

**Fix**: the callback is now read through a ref (`onCloseRef`, updated every render but not a dependency), so the keydown/focus-trap effect's dependency array is `[isOpen]` only — it mounts/unmounts (and only then restores focus) when the dialog actually opens or closes, not on every interaction. Applied identically to both `Modal` and `Drawer`. This is a shared-component fix benefiting every current and future consumer, not something scoped narrowly to Peer Review — verified safe via a clean full `tsc -b` production build and the full Playwright regression (§10).

### 7c. Frontend: disabling the just-clicked action button mid-request drops focus to `<body>`
While building the "confirmation focus" test for the External Reviewer form, disabling the Save Draft/Submit buttons via the `disabled` attribute during their in-flight request (a legitimate double-submit guard) was found to blur focus to `<body>` in Chromium once the currently-focused element becomes disabled — a real, verifiable browser behavior, not a false positive. **Fix**: `ExternalReviewerPortal.tsx` now restores focus to the action button (via `id` + `document.getElementById(...).focus()` in the `finally` block — the shared `Button` component is not ref-forwarding, so `id` was used rather than converting it to `forwardRef`, keeping the fix minimal) once the request completes; on a successful final Submit the button itself unmounts (state locks to `SUBMITTED`), so focus falls back to the now-visible confirmation status region instead.

### 7d. New inline validation + Error Focus on the New Case Modal
`handleCreateNewCase`/`handleRecordEditorialDecision` previously did nothing visible on an empty required field (`if (!newCaseTitleAr) return;` — a silent no-op). Added a real inline error (`role="alert"`, `aria-describedby`) plus focus-move to the offending field on both the New Case Modal's title and the Editorial Decision Modal's rationale textarea.

None of 7a–7d required building any new UI, touching COI Override, the Publication handoff, or Global IAM — all four are corrections to existing, already-shipped code paths, discovered specifically because this round tested real keyboard interaction where prior rounds had only tested mouse-driven or network-level flows.

## 8. Both Custom Dialogs Now Use the Shared, Accessible `Modal` Primitive

`ReviewerDashboard.tsx`'s New Case Modal and Editorial Decision Modal were previously hand-rolled `fixed inset-0` overlay `<div>`s with **no** focus trap, no initial-focus, no focus-return, and no `role="dialog"`/`aria-modal` at all (confirmed via `grep` — zero matches for `useRef|focus\(\)|onKeyDown|Escape` in the original file). Both now render through `src/design-system/components/Overlay.tsx`'s `Modal` component (already used elsewhere in the codebase, e.g. `ProjectWizard.tsx`), which provides all of the above out of the box (and now correctly, per §7b's fix).

## 9. Files Changed This Round

- `backend/app/routers/peer_reviews.py` — list-visibility fix (§7a)
- `backend/app/tests/test_peer_reviews.py` — +1 regression test (`test_delegated_editor_sees_case_in_own_list`)
- `src/design-system/components/Overlay.tsx` — shared Modal/Drawer focus-trap fix (§7b)
- `src/features/review-portal/ReviewerDashboard.tsx` — both dialogs migrated to the shared `Modal`; inline validation + Error Focus added; status banner given `role`/`aria-live`
- `src/features/review-portal/ExternalReviewerPortal.tsx` — success banner given `role="status" aria-live="polite"`; focus-restoration after Save Draft/Submit (§7c)
- `tests/e2e/peer-review-editorial.spec.ts` — +5 new automated keyboard/focus tests (34 → 39)

No other Peer Review file, no migration, no IAM/authorization model file changed.

## 10. Full Regression Evidence

**Peer Review browser suite** (`peer-review-editorial.spec.ts`), full run after all fixes: **39/39 passed** (34 pre-existing + 5 new keyboard/focus tests), including all network, double-blind, external-token, institutional-operations, axe, RTL/LTR, responsive, and reduced-motion tests from prior rounds — none regressed.

**Full frontend Playwright regression** (entire `tests/e2e/` suite, project `chromium`): **143 passed, 1 failed** — the failure is `critical-routes.spec.ts @a11y critical authenticated routes have no serious axe violations` on `/app/profile` (`label`/`select-name` — form elements missing accessible names), confirmed identical to the pre-existing baseline failure documented across every prior closure report in this domain (Research Design, Research Data, Publication, Peer Review Editorial, Peer Review Browser Runtime). Not a regression; unrelated to this round's changes.

**Full backend regression** (`python -m pytest app/tests`, SQLite): **485 passed, 1 failed, 24 skipped**. The one failure, `test_research_data_service.py::test_xlsx_import_runtime_and_limits`, is `ModuleNotFoundError: No module named 'openpyxl'` — a missing local Python dependency in the Research Data domain, entirely unrelated to Peer Review, not touched this round, and not a code regression (an environment gap, honestly reported rather than silently excluded). All 22 Peer Review backend tests (21 pre-existing + 1 new) are included in the 485 passing.

**13 previously environment-blocked PostgreSQL tests** (from the prior Browser Runtime closure, blocked because local PostgreSQL was stopped): after reinitializing the corrupted cluster (§2) and restarting it, all 13 were re-run individually by exact name — **13/13 passed**:
`test_postgres_fresh_alembic_upgrade_head`, `test_postgres_upgrade_from_previous_thesis_revision`, `test_postgres_alembic_roundtrip`, `test_alembic_single_head_and_schema_alignment`, `test_postgres_chapter_version_allocation_is_serialized`, `test_postgres_defense_decision_has_one_authority`, `test_postgres_final_approval_is_idempotent_under_race`, `test_postgres_committee_seat_is_not_duplicated`, `test_postgres_examiner_report_finalization_is_single`, `test_postgres_correction_verification_is_single`, `test_postgres_duplicate_final_version_is_rejected`, `test_postgres_examiner_invitation_is_not_duplicated`, `test_postgres_schema_contains_thesis_tables`.

No PostgreSQL migration/concurrency/roundtrip suite was re-run beyond this, per scope (schema unchanged this round — confirmed in §1).

## 11. Static Checks

- `npx tsc --noEmit -p .` — clean, no errors.
- `npm run build` (`tsc -b && vite build`) — **clean production build**, no errors. (This caught a real type error my ad-hoc `tsc --noEmit -p .` check missed — passing a `ref` to the non-forwardRef `Button` component — fixed by switching to `id`-based focus restoration, §7c.)
- `npx oxlint` — exit code 0, no findings.
- `git diff --check` — exit code 0; only benign CRLF/LF line-ending notices (pre-existing repo-wide `core.autocrlf` behavior), no real trailing-whitespace/mixed-tab errors.

## 12. IAM Register Delta

**NONE.** `BASEERAH_PEER_REVIEW_IAM_DISCOVERY_REGISTER.md` is unchanged. The list-visibility fix (§7a) does not grant any new *capability* — it corrects the list endpoint to match the authority `is_case_editor` already granted at the detail/action level, which was already fully documented in the register.

## 13. Pre-Existing, Documented, Out-of-Scope Items (unchanged, not re-litigated)

- `critical-routes.spec.ts @a11y /app/profile` — pre-existing baseline a11y debt (§10).
- `test_postgresql_concurrency.py::test_postgresql_dispatcher_claims_event_once` — pre-existing test-isolation bug, unrelated to Peer Review (documented in the prior Editorial Intelligence closure report; not re-triggered or re-investigated this round since it wasn't part of the full-suite run's failures this time).
- `test_research_data_service.py::test_xlsx_import_runtime_and_limits` — missing `openpyxl` dependency, Research Data domain, out of scope (§10).
- `SAWarning: Coercing Subquery object into a select()` on the `list_peer_review_cases` query — a pre-existing SQLAlchemy style warning on code I touched for §7a; harmless, not a failure, left as-is to avoid unrelated scope creep.
- `react-router` GHSA-qwww-vcr4-c8h2 — documented in `CLAUDE.md`, not exploitable in this app's routing mode, no fix published yet.

## 14. Final Dashboard

| Gate | Status |
|---|---|
| Repository Discovery (branch/SHA/alembic unchanged) | PASS |
| Author Revision Backend/API Workflow | PASS |
| Author Revision Network Runtime | PASS |
| Author Revision Browser UI Journey | N/A — NOT IMPLEMENTED IN CURRENT PRODUCT SCOPE |
| Invite Reviewer Backend/API Workflow | PASS |
| Invite Reviewer Browser UI Journey | N/A — NOT IMPLEMENTED IN CURRENT PRODUCT SCOPE |
| Keyboard-Only Editor Journey | PASS |
| Keyboard-Only External Reviewer Journey | PASS |
| Focus Entry | PASS |
| Focus Trap | PASS (real defect found and fixed — §7b) |
| Focus Return | PASS (real defect found and fixed — §7b) |
| Escape Behavior | PASS |
| Error Focus | PASS (new fix — §7d) |
| Visible Focus / confirmation announcement | PASS (new fix — §7c) |
| Logical Tab Order | PASS |
| Editor-only controls keyboard-unreachable for non-editors | PASS |
| New automated keyboard/focus Playwright tests | 5/5 added and passing |
| Peer Review browser suite (full) | 39/39 PASS |
| Full frontend Playwright regression | 143/144 PASS (1 pre-existing, unrelated baseline failure) |
| Peer Review backend suite | 22/22 PASS (21 pre-existing + 1 new regression test) |
| Full backend regression | 485/486 PASS, 24 skipped (1 pre-existing, unrelated environment gap — missing `openpyxl`) |
| 13 previously environment-blocked PostgreSQL tests | 13/13 PASS |
| TypeScript (`tsc -b`, production build mode) | PASS |
| Production build | PASS |
| Oxlint | PASS |
| `git diff --check` | PASS |
| IAM Register Delta | NONE |

## 15. Final Status

**VERIFIED & CLOSED.**

Every keyboard-only journey, focus-management gate, and evidence-hygiene correction this micro-closure was scoped to deliver has real, automated, passing evidence — including two genuine pre-existing defects (a backend authorization-list gap and a shared-component focus-trap bug) that this round's keyboard testing was the first coverage to surface, both fixed at their root cause and covered by new regression tests. No new UI was built. No COI Override, Publication handoff, or Global IAM logic was touched. The two remaining test failures in the full regression sweep (the `/app/profile` axe violation and the missing `openpyxl` dependency) are pre-existing, documented, and unrelated to Peer Review.

**Stopping here — not proceeding to Academic Promotion Intelligence or any other domain.**
