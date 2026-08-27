# Baseerah Peer Review & Editorial Intelligence — IAM Discovery Register

Documents the actual, implemented authorization surface of the Peer Review domain (`backend/app/routers/peer_reviews.py`, `external_reviews.py`, `app/services/ai/context_builder.py::_review_feedback`) as of this closure. Written from code, not aspiration — every permission below maps to a real check in the router.

---

## 1. Personas

| Persona | Definition | Implemented as |
|---|---|---|
| Author | Creates the review case (`owner_user_id`) | `PeerReviewCase.owner_user_id == user.id` |
| Reviewer (internal) | Org member assigned to a round | `ReviewerAssignment.reviewer_user_id == user.id` |
| External Reviewer | No Baseerah account; accesses via magic-link token | `ReviewerAssignment.reviewer_type == "EXTERNAL_REVIEWER"` + `ExternalReviewerToken` |
| Editor | Delegated authority over one specific case | `PeerReviewCase.editor_user_id == user.id` |
| Organization Owner | Bootstrap authority — implicitly the editor of every case in the org | `OrganizationMembership.role == "OWNER"` |
| Organization Admin | Manages org membership/workspaces; **no automatic peer-review authority** | `OrganizationMembership.role == "ORGANIZATION_ADMIN"` |
| Platform Operator | Cross-organization platform administration; **no peer-review content access** | `User.role == "SystemAdmin"` / `context.is_global_admin` |

No persona above OWNER is a global role for this domain — editorial authority is resource-scoped (§6, §11).

## 2. Account Contexts

- `ORGANIZATION_MEMBER` — author, internal reviewer, editor, owner, admin (all have an `OrganizationMembership` row).
- `EXTERNAL_GUEST` — external reviewer; identified solely by a hashed, single-purpose, time-limited token (`ExternalReviewerToken`), never an account.
- `PLATFORM_OPERATOR` — `is_global_admin`; has no organization membership context for this domain's resources.

## 3. Scopes

| Scope | Meaning | Resolution |
|---|---|---|
| `AUTHOR_OWNED_CASE` | The case this user created | `case.owner_user_id == user.id` |
| `EDITOR_ASSIGNED_CASE` | The case this user is the delegated editor of | `case.editor_user_id == user.id` |
| `OWN_REVIEWER_ASSIGNMENT` | The reviewer's own assignment/round | `assignment.reviewer_user_id == user.id` |
| `EXTERNAL_TOKEN_ASSIGNMENT` | The single assignment a magic-link token resolves to | `token.assignment_id` (hash-verified) |
| `ORGANIZATION_AGGREGATE` | Counts/status only, no content | `OWNER` / `ORGANIZATION_ADMIN` via `/organization/operations` and case-list summaries |

## 4. Permission Registry

| Permission | Who satisfies it (as implemented) |
|---|---|
| `peer_review.case.create` | Any authenticated organization member (submission-for-review is author-initiated, not editor-gated) |
| `peer_review.case.view` | Author, case editor, OWNER, or an assigned reviewer of that case |
| `peer_review.case.view_aggregate` | `OWNER`, `ORGANIZATION_ADMIN` (list/summary and operations endpoints only — no identities, no content) |
| `peer_review.editor.assign` | `OWNER` only |
| `peer_review.round.create` | Case editor or `OWNER` |
| `peer_review.reviewer.invite` | Case editor or `OWNER` |
| `peer_review.reviewer.accept` / `.decline` | The assigned reviewer, for their own assignment only |
| `peer_review.review.save_draft` / `.submit` | The assigned reviewer, own assignment, not after `SUBMITTED`/`DECLINED`/`EXPIRED`/`REVOKED`, and not while `CONFLICT_DECLARED` |
| `peer_review.review.view_author_visible` | Author (comments filtered to `AUTHOR_VISIBLE`), case editor/`OWNER` (all comments) |
| `peer_review.review.view_confidential` | Case editor or `OWNER` only |
| `peer_review.reviewer_identity.view` | Case editor/`OWNER` always; author/other participants per `blind_type` masking |
| `peer_review.author_identity.view_blind_context` | Case editor/`OWNER`/the author themself; masked to `DOUBLE_BLIND` reviewers |
| `peer_review.revision.upload` | The manuscript author, or `OWNER`/`ORGANIZATION_ADMIN` |
| `peer_review.decision.record` | Case editor or `OWNER` only; blocked once the round already carries a non-`PENDING` decision |
| `peer_review.operations.view_aggregate` | `OWNER`, `ORGANIZATION_ADMIN` |
| `peer_review.ai.review_summary` | Author or case editor/`OWNER` (mirrors `peer_review.review.view_confidential`'s exclusion of plain org admin) |

## 5. Sensitive Permissions

`peer_review.review.view_confidential`, `peer_review.reviewer_identity.view`, `peer_review.author_identity.view_blind_context`, `peer_review.decision.record`, `peer_review.editor.assign`, `peer_review.ai.review_summary` (confidential-content-adjacent).

## 6. Resource Relationships

`editor_of` (`case.editor_user_id`), `author_of` (`case.owner_user_id`), `reviewer_of` (`ReviewerAssignment.reviewer_user_id`), `external_reviewer_of` (`ExternalReviewerToken → ReviewerAssignment`), `coauthor_of` (`PublicationManuscriptAuthorship`, when the case is version-bound — used only for the reviewer-assignment COI block, not for case access).

## 7. Sensitive Boundaries

Author identity under `DOUBLE_BLIND`/`SINGLE_BLIND`; reviewer identity; `CONFIDENTIAL_TO_EDITOR` comments; raw external-reviewer magic-link tokens (hash-only storage, 64-hex-char SHA-256, never logged); unpublished manuscript content; editorial decision authority; COI declarations/notes.

## 8. Approval Authorities

| Question | Answer (as implemented) |
|---|---|
| Who assigns/reassigns the editor? | `OWNER` only — not the current editor, not `ORGANIZATION_ADMIN` |
| Who invites a reviewer? | Case editor or `OWNER` |
| Who resolves/overrides a declared COI? | **Nobody — not implemented.** A `CONFLICT_DECLARED` reviewer is permanently blocked from that assignment with no unblock endpoint. Safe-by-default; documented as a deferred workflow gap, not a security defect. |
| Who releases comments to the author? | No separate release step — `AUTHOR_VISIBLE` vs `CONFIDENTIAL_TO_EDITOR` is set by the reviewer at submission time and enforced automatically by `comment_type` filtering |
| Who issues the editorial decision? | Case editor or `OWNER`, once per round |
| Who creates the next round? | Case editor or `OWNER` |

## 9. Delegation

Editor delegation exists (`PUT /cases/{id}/editor`, `OWNER`-only, audited as `PEER_REVIEW_EDITOR_ASSIGNED`). No sub-delegation (an editor cannot appoint another editor); no coordinator/associate-editor persona is implemented — not a proven use case in this codebase, so not fabricated here.

## 10. Institutional Hierarchy

Not implemented (no department/college/journal-board layer). Future requirement only — this domain is single-organization, single-editor-per-case.

## 11. Cross-Domain IAM Dependencies (verified against real code, not asserted)

```
publication.manuscript.edit        DOES NOT IMPLY  peer_review.decision.record
    — publication_intelligence.py never imports or touches PeerReviewCase.

publication.submission.approve     DOES NOT IMPLY  peer_review.editor.assign
    — no code path connects them; editor.assign is OWNER-gated independently.

peer_review.reviewer (assigned)    DOES NOT IMPLY  publication.manuscript.edit
    — ReviewerAssignment carries no Publication-domain permission at all.

peer_review.review.submit          DOES NOT IMPLY  peer_review.decision.record
    — submit_completed_review has zero decision-authority checks;
      require_case_editor is a wholly separate gate on a different endpoint.

peer_review.review.view_author_visible  DOES NOT IMPLY  peer_review.review.view_confidential
    — apply_privacy_and_confidentiality strips CONFIDENTIAL_TO_EDITOR comments
      for every caller where is_editor is False.

peer_review.editor.assign          DOES NOT IMPLY  publication.publication.record
    — record_editorial_decision writes only to PeerReviewCase/PeerReviewRound;
      it never touches ScholarlyAsset.lifecycle_status or any Publication
      table. The Peer Review → Publication handoff for a final decision is
      therefore a MANUAL step today (safe — no unauthorized writes — but not
      yet automated; see Deferred Non-Core Capabilities).

organization.admin                 DOES NOT IMPLY  peer_review.review.view_confidential
organization.admin                 DOES NOT IMPLY  peer_review.reviewer_identity.view
organization.admin                 DOES NOT IMPLY  peer_review.decision.record
    — verified: test_organization_admin_without_case_editor_role_is_blocked,
      test_peer_review_ai_org_admin_without_editor_role_denied.

platform.admin                     DOES NOT IMPLY  peer_review.manuscript.view
platform.admin                     DOES NOT IMPLY  peer_review.review.view_confidential
platform.admin                     DOES NOT IMPLY  peer_review.decision.record
    — verified: test_platform_admin_without_case_editor_role_is_blocked_from_editorial_decision
      (supersedes a prior regression fix, F13-005, that had made SystemAdmin
      an implicit global override — that override was exactly the anti-pattern
      this boundary forbids, so it was removed rather than preserved).

promotion.committee_member         DOES NOT IMPLY  peer_review.review.view_confidential
    — the Promotion domain has no code path into PeerReviewCase at all.
```

## 12. Peer Review Access Matrix

| Action | Author | Editor (assigned) | OWNER | ORGANIZATION_ADMIN (not editor) | Reviewer (own assignment) | External Reviewer | Platform Operator |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Create case | ✅ | — | ✅ | ✅ | — | — | — |
| View case detail | ✅ (own) | ✅ | ✅ | ❌ | ✅ (assigned only) | ✅ (own assignment via portal) | ❌ |
| View aggregate list/ops | — | — | ✅ | ✅ | — | — | ❌ |
| Assign editor | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Invite reviewer | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Accept/decline own assignment | — | — | — | — | ✅ | ✅ | — |
| Save draft / submit review | — | — | — | — | ✅ (own) | ✅ (own) | — |
| View author-visible comments | ✅ | ✅ | ✅ | ❌ | ✅ (own review) | ✅ (own review) | ❌ |
| View confidential comments | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Upload revision | ✅ | — | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create next round | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Record decision | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| AI review summary | ✅ (own) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

## 13. Sensitive Access Matrix

| Sensitive resource | Who can access | Blocked |
|---|---|---|
| Unpublished manuscript / revision content | Author, editor, `OWNER`, assigned reviewer | `ORGANIZATION_ADMIN` (non-editor), platform operator, non-assigned reviewers |
| Reviewer identity | Editor, `OWNER` always; author/others per `blind_type` | Blinded parties per policy |
| Author identity (`DOUBLE_BLIND`) | Editor, `OWNER`, the author themself | Reviewers |
| `CONFIDENTIAL_TO_EDITOR` comments | Editor, `OWNER` | Author, reviewers, `ORGANIZATION_ADMIN` (non-editor), platform operator |
| Raw external-reviewer token | Nobody (hash-only storage; raw value returned once at invite time, never persisted or logged) | Everyone, including editor/`OWNER` after issuance |
| Editorial decision authority | Editor, `OWNER` | Everyone else, including reviewers who submitted the underlying reports |

---

## IAM Readiness

Personas ✅ · Account Contexts ✅ · Scopes ✅ · Permissions ✅ · Sensitive Permissions ✅ · Resource Relationships ✅ · Sensitive Boundaries ✅ · Approval Authorities ✅ · Delegation ✅ (documented as not-yet-needed beyond editor assignment) · Institutional Hierarchy ✅ (documented as future/deferred) · Cross-Domain Dependencies ✅ (code-verified) · Access Matrix ✅ · Sensitive Access Matrix ✅.

**Peer Review Domain IAM Readiness: COMPLETE.**
**Global IAM Implementation: DEFERRED AS PLANNED** — this register documents domain-local requirements for the future unified Baseerah Identity, Roles & Institutional Access Architecture; it does not implement it.
