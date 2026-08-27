# Baseerah IAM Conflict & Gap Report

Findings from cross-referencing all six existing domain IAM registers against each other and, where they disagreed or were silent, against the actual running code. Ranked most-severe first. This report does not fix any domain's code — per this consolidation task's own mandate, fixes belong to dedicated future domain-closure rounds, following the exact precedent already established by Promotion's own two prior self-correction rounds in this program.

---

## Finding 0 — CRITICAL: `projects.py` had no resource-scoped authorization at all (SAME-TENANT HORIZONTAL IDOR) — **FIXED**

Discovered while following up Finding 1's pattern into `research_lifecycle.py`'s parent resource. `backend/app/routers/projects.py` — the base CRUD for `ResearchProject`, the root resource every other domain in this consolidation ultimately hangs off of — had **no ownership or `ResearchProjectMember` check whatsoever** on `get_project`, `update_project`, `delete_project`, `list_projects`, `update_project_workflow_profile`, or `create_manuscript_from_project`. Every one of them filtered only on `organizationId == caller's org`. This is more severe than Finding 1 (a role-semantics inconsistency for `ORGANIZATION_ADMIN` specifically): here, **any authenticated member of an organization — including a plain `RESEARCHER` with zero relationship to a project — could view the complete project (title, problem statement, ethics/consent plans, pre-registration data, variables, hypotheses), fully overwrite every field, delete it outright, or mint a new manuscript `ScholarlyAsset` attributed to themselves off of it.** `list_projects` returned this same full content org-wide, not just a summary. No dedicated test file existed for this router; the one cross-tenant test that did exist (`test_saas_isolation.py`) only proved isolation *between organizations*, never *within* one — the exact scenario that was actually broken.

This also revealed that `research_design.py` (the primary, later-built domain router for this same resource) already has the *correct* model — `project_access()`/`can_edit_section()`, checking `is_global_admin`, ownership, or an active `ResearchProjectMember` relationship — meaning `projects.py` is legacy/base CRUD that was simply never brought into conformance with the more careful model established later for the same table. Exactly the same root cause as Finding 1, one layer deeper.

**Fixed**: `projects.py` now imports and reuses `research_design.py`'s own `project_access`/`member_relationship` functions directly (rather than yet another divergent reimplementation) for `get_project`, `update_project`, `list_projects` (scoped to own/member projects, admin sees org-wide), `update_project_workflow_profile`, and `create_manuscript_from_project` (edit-capable relationships: `PI`/`CO_RESEARCHER`/`DATA_ANALYST`). `delete_project` is deliberately narrower — owner or platform admin only, given deletion is irreversible and no evidence anywhere establishes broader delete authority. Verified: new dedicated `test_projects_authorization.py` (8/8: blocks a same-org colleague and an `ORGANIZATION_ADMIN` with no relationship from view/edit/delete/list/manuscript-creation; confirms a `PI` relationship can view/edit but not delete; confirms the owner retains full CRUD), plus the full existing regression suite touching this router (see Regression Evidence below).

---

## Finding 1 — CRITICAL / HIGH: `ORGANIZATION_ADMIN`/`OWNER` carries inconsistent authority across domains (ROLE CONFLICT, SECURITY CONFLICT) — **FIXED**

**Status: RESOLVED in all three affected surfaces**, per explicit user authorization to reopen them following this consolidation's own discovery. See each fix's detail below the original finding. A **third instance** of this exact pattern was found and fixed after the first two: `research_lifecycle.py` (an eighth code surface — a cross-domain integration/handoff layer sitting between Research Design, Research Data, Publication, and Promotion, not itself one of the original seven registered domains) had its own `require_project_write` checking generic `ORGANIZATION_ADMIN`/`SUPERVISOR`/`RESEARCHER` organization role instead of the `ResearchProjectMember` resource-scoped relationship that `research_design.py`'s own established `can_edit_section()`/`project_access()` already use for this exact same `ResearchProject` resource — meaning this router had silently diverged from its own domain's already-correct precedent. **Fixed**: `require_project_write` now checks `is_global_admin`, ownership, or an active `ResearchProjectMember` with an edit-capable relationship (`PI`/`CO_RESEARCHER`/`DATA_ANALYST`), matching `research_design.py` exactly. Verified: 10/10 tests in `test_research_lifecycle.py` (3 new), 69/70 in the adjacent Research Design/Data suites (1 pre-existing unrelated `openpyxl` failure, unchanged).

**The same role name grants radically different authority depending on which domain enforces it.**

| Domain | Does generic `OWNER`/`ORGANIZATION_ADMIN` (no resource relationship) get private/confidential content access? |
|---|---|
| Peer Review | **NO** — `ORGANIZATION_ADMIN` (non-editor) is explicitly blocked from case content, confidential comments, reviewer/author identity, and decision authority; only `OWNER` retains bootstrap editor authority (itself a deliberate, documented exception — see Finding 5) |
| Promotion | **NO** (as of its second correction round, this program) — oversight-only `OWNER`/`ORGANIZATION_ADMIN` gets a distinct, metadata-only response shape; private dossier requires an active `PromotionCommitteeAssignment` |
| Academic Identity | **NO** — no admin/oversight code path exists in this domain's router at all |
| Research Data | **NO** — `platform.admin`/generic org role does not imply `view_sensitive`/`download_raw`/`export_sensitive`; dataset ownership or an explicit `DatasetAccessGrant` is required (a prior defect here, FD-1, was already found and fixed before this consolidation) |
| **Publication Intelligence** | **YES** — `require_write`/`require_authorship_manage`/`require_submission_authority` all grant full manuscript edit, authorship management, and (for `require_write`/`require_authorship_manage`) submission authority to any `OWNER`/`ORGANIZATION_ADMIN`, with no resource relationship required at all |
| **Thesis Supervision & Examination** | **YES** — `admin(ctx)` (`is_global_admin OR OWNER/ORGANIZATION_ADMIN` org role) is treated as fully equivalent to a resource-assigned, final-authority supervisor throughout `thesis_workflow.py`: it bypasses `require_supervisor` entirely (no `ThesisSupervisionAssignment` needed), and `list_examiner_reports` grants `can_confidential=True` to any generic org-admin — the same visibility level as the assigned supervisor, exposing examiners' private `confidential_comments` |

**Verified against code, not asserted from documentation** — `publication_intelligence.py:75-99` (`require_write`, `require_authorship_manage`, `require_submission_authority`) and `thesis_workflow.py:178-206` (`admin()`, `require_supervisor()`, `list_examiner_reports`'s `can_confidential` computation) were read directly this round.

**Severity**: HIGH, not CRITICAL — this is a same-tenant, role-based over-grant (an `ORGANIZATION_ADMIN` in the same organization sees more than a peer-domain equivalent would), not a cross-tenant or unauthenticated leak. Both domains already correctly block cross-tenant and platform-admin access; the gap is specifically that *generic same-org admin/owner* status substitutes for a *resource-scoped relationship* in exactly the two domains that haven't yet been through the correction Peer Review/Promotion/Academic Identity/Research Data already received.

**Resolution — canonical, already adopted by the majority**: generic `OWNER`/`ORGANIZATION_ADMIN` role membership grants **institutional oversight** (administrative metadata, aggregate visibility, configuration authority) but never **private/confidential academic content** or **academic decision authority** — those require an explicit resource-scoped relationship (authorship, supervision assignment, committee assignment) or true ownership of the specific resource. This is now the platform's de facto standard, independently converged upon four separate times.

**Disposition — FIXED this round**, following explicit user authorization to reopen both domains after this consolidation surfaced the finding:

**Publication Intelligence**: `require_write` and `require_authorship_manage` now check resource ownership (`asset.owner_user_id == ctx.user.id`) only — the `OWNER`/`ORGANIZATION_ADMIN` role bypass is removed entirely. A second, independent defect was discovered while implementing this fix: `require_submission_authority` (the function meant to gate submission approval to the owner or the confirmed corresponding author) was defined but **never actually called anywhere** — both `add_submission` and `set_submission_status` used the broader `require_write` instead, meaning the domain's own documented design ("corresponding author approves submission") was silently unenforced. Both endpoints now call `require_submission_authority` (reordered to resolve the manuscript version first, since the check needs it). Verified: all 32 pre-existing tests pass unchanged (none relied on the removed bypass), plus 4 new regression tests (`test_33`–`test_36` in `test_publication_intelligence.py`) proving org-admin is now blocked from editing, managing authorship, and approving/recording submissions, and proving a non-owner corresponding author can now genuinely approve a submission for the first time.

**Thesis Supervision & Examination**: `require_supervisor` no longer bypasses for `admin(ctx)` (platform or org-role admin) — supervisor-equivalent authority (chapter approval, milestone completion, examination scheduling/decisions, committee/examiner assignment, corrections) now requires a genuine `ThesisSupervisionAssignment`. `list_examiner_reports`'s `can_confidential` no longer includes `admin(ctx)`. The identical duplicated pattern was found and fixed in a *second* consumer, `services/reporting/context_builder.py::_build_thesis_examiner_report` (the Reports/Export engine) — exactly the "same bug independently duplicated in another consumer" pattern this program has now seen four times (Promotion → Search + AI; Thesis → the report engine). **Finding 3 was fixed in the same change**: rather than leaving `GRADUATE_STUDIES_ONLY` reports unreachable, admin's confidential-content access is now precisely scoped to that one tier (both existence-visibility and `confidential_comments`), while losing the blanket bypass on `SUPERVISOR_VISIBLE`/`COMMITTEE_ONLY` tiers, which still require the genuine relationship. Every other `admin(ctx)`-gated action in this router (`add_policy`, `add_thesis`, `assign_supervisor`, `update_deposit_clearance`, `final_approval`, `add_post_approval_amendment`, `add_deposit`, `graduate_operations`) was deliberately left unchanged — these are legitimate administrative/configuration/assignment-authority/aggregate actions matching the same pattern already established elsewhere (Promotion's policy-admin, assignment-authority-≠-membership-authority), not private academic content or academic decision authority. Verified: all 50 pre-existing tests across `test_thesis_security.py`, `test_thesis_workflow.py`, and `test_thesis_closure_scenarios.py` pass unchanged, plus 8 new regression tests proving both `require_supervisor` and both confidential-report consumers correctly reject admin without an assignment while correctly allowing the assigned supervisor, and proving the `GRADUATE_STUDIES_ONLY` tier is now reachable for its intended audience in both consumers.

Neither fix required a schema change or migration. **This closes both instances of Finding 1 and Finding 3** — see `BASEERAH_CROSS_DOMAIN_IAM_REQUIREMENTS.md`'s updated readiness dashboard and final status.

---

## Finding 2 — HIGH: No dedicated Thesis Supervision & Examination IAM register existed

Every other domain in this program produced its own IAM discovery register at closure time; Thesis did not. This consolidation extracted its authorization surface directly from code this round (personas, the `ThesisExaminerToken` external-guest mechanism, the `ThesisSupervisionAssignment`/`ThesisCommitteeMember`/`ThesisExaminerAssignment` relationship model, and Finding 1's admin-bypass discovery) — now recorded in `BASEERAH_CANONICAL_IAM_VOCABULARY.md` §7 and folded into the matrices below. **Gap, not a conflict** — closed by this round's extraction, but Thesis should receive its own dedicated register the next time that domain is touched, matching every other domain's convention.

---

## Finding 3 — MEDIUM: `GRADUATE_STUDIES_ONLY` confidentiality tier was unreachable through `list_examiner_reports` — **FIXED**

`ThesisExaminerReport.confidentiality_level` defines four tiers including `GRADUATE_STUDIES_ONLY`, but the visibility-list construction in `list_examiner_reports` never included it for *any* caller, admin included — the tier was defined in the model but dead in this endpoint (and in the report engine's equivalent function). Not a security leak (failed safe), but a functional gap. **Fixed in the same change as Finding 1** (see above): admin's confidential-content access is now precisely scoped to exactly this tier, in both `list_examiner_reports` and `_build_thesis_examiner_report`.

---

## Finding 4 — LOW / DOCUMENTATION PRECISION: Publication register's `view_unpublished` non-implication is misleading, not wrong

`BASEERAH_PUBLICATION_IAM_DISCOVERY_REGISTER.md` states `organization.admin DOES NOT IMPLY publication.manuscript.view_unpublished (ENFORCED)`. Verified against `publication_intelligence.py:69-72` (`asset_or_404`): this function grants **view** access to *any* organization member on `organization_id` match alone — no role check of any kind, `ORGANIZATION_ADMIN` or otherwise. The non-implication statement is technically true (org-admin specifically confers nothing *beyond* what any member already has) but its phrasing implies `view_unpublished` is a gated, sensitive permission requiring something org-admin lacks, when the actual implementation is that it is **open to the entire organization by default** — the same deliberate "internal catalogue, org-wide readable" pattern already documented and accepted for `ScholarlyAsset` elsewhere (Academic Identity §13.1, Promotion's evidence picker). Recorded here as a documentation-clarity issue for the register's next revision, not a behavior change.

---

## Finding 5 — Documented by design, not a conflict: Peer Review's `OWNER` bootstrap editor authority

Peer Review's `OWNER` role acts as the implicit editor of *every* case in the organization with no per-case assignment needed — this looks superficially like Finding 1's pattern, but it is explicitly documented as a deliberate bootstrap mechanism (a brand-new organization has no cases with editors assigned yet, so `OWNER` must be able to act) and, critically, `ORGANIZATION_ADMIN` — the role one level below `OWNER` — is explicitly *excluded* from this bootstrap grant and receives aggregate-metadata-only access, same as everywhere else. This is a narrower, single-role exception with a clear rationale, not the broad `OWNER`-and-`ORGANIZATION_ADMIN`-both-get-full-content-authority pattern found in Publication and Thesis. Not flagged as a conflict requiring remediation.

---

## Finding 6 — MEDIUM: No domain implements a distinct Research Office / Graduate Studies / Executive Viewer role

Every register that names one of these personas (Research, Research Data, Publication) marks it "documented need, not implemented" — the org-level oversight these personas would need is currently provided, where it exists at all, by the generic `ORGANIZATION_ADMIN` role itself. This is consistent (all registers agree) rather than conflicting, but it is a real gap for the future Unified IAM architecture: **there is currently no way to grant "aggregate institutional visibility" without also granting the full `ORGANIZATION_ADMIN` role**, which — per Finding 1 — carries different, sometimes much broader, authority depending on the domain. A dedicated `INSTITUTIONAL_VIEWER` role/relationship, scoped to aggregate-only visibility and independent of `ORGANIZATION_ADMIN`, is a genuine requirement for the Unified IAM phase, not yet met by any domain today.

---

## Finding 7 — LOW: `is_global_admin` tiering is unresolved

Every register's non-implication rules treat `is_global_admin` as a single boolean with no internal tiers, but the Canonical Vocabulary's Layer 4 (§2) anticipates "Platform Support" vs. "Platform Super Admin" as distinct personas — these do not exist as distinct, checkable values anywhere in the current code (`User.role` collapses to one boolean via `TenantContext.is_global_admin`). Recorded as a **Future Requirement**, not a conflict — no domain claims this distinction exists, so there is nothing inconsistent to resolve, only a gap for the eventual Unified IAM data model (see the Verification Requirements and Cross-Domain Requirements documents).

---

## Institutional Policy Questions — RESOLVED (product owner decision)

All four were genuine product-policy questions no domain register or code settled — per this task's own instruction, none were guessed. Each was put to the product owner directly and decided:

1. **Future `INSTITUTIONAL_VIEWER`/Research-Office/Graduate-Studies aggregate visibility across domains — DECIDED: per-domain grant, not automatic cross-domain visibility.** When such a persona/relationship is eventually built (Finding 6, still a Future Requirement — no code exists yet), it must be granted explicitly in each domain it needs to see, matching the current pattern where every domain's aggregate endpoint is independently gated. No code changes today — this decision only takes effect once the persona itself is built.
2. **College/Department-level admin inheritance once Institutional Hierarchy exists — DECIDED: automatic top-down inheritance** (a College admin sees all its Departments' aggregate data by default, not per-department explicit grants). No code changes today — no hierarchy entity exists yet anywhere in the platform; this decision is recorded for whenever that layer is eventually built.
3. **Revoked reviewer/committee-member/examiner retaining access to their own historical contribution — DECIDED: total, immediate loss, including of their own past work.** This was not purely a future-facing question: it exposed a real, live gap. `GET /cases/{case_id}` and `GET /cases` (Peer Review) checked `ReviewerAssignment.reviewer_user_id == caller` with **no status filter at all** — inconsistent with `search/providers.py` and `storage.py`, which already correctly excluded `REVOKED`/`DECLINED` for this exact same relationship. No live "revoke reviewer" endpoint exists yet in Peer Review, so this was not exploitable today, but the gap would have become live the moment such a feature is added, silently contradicting the very policy just decided. **Fixed**: both endpoints now exclude `REVOKED`/`DECLINED`, matching the established pattern elsewhere in the same domain. Promotion (`PromotionCommitteeAssignment`) and Thesis (`ThesisSupervisionAssignment`) were checked and already correctly filter on active status — no gap found in either. Regression: `test_revoked_reviewer_assignment_loses_case_access` in `test_peer_reviews.py` (23/23 passing).
4. **`INSTITUTIONAL`-visibility Academic Identity profile discoverability via Unified Search — DECIDED: remains non-discoverable, no change.** The current behavior (Academic Identity §9's documented safe-by-default gap) is confirmed as the intended product behavior, not merely a placeholder — no code change needed.

---

## Legacy Authorization Debt Registry

```
publication_intelligence.py: require_write / require_authorship_manage / require_submission_authority
    — generic org-admin bypass (Finding 1) — FIXED this round

publication_intelligence.py: require_submission_authority was defined but never called anywhere,
    leaving the documented corresponding-author-approval design unenforced — FIXED this round
    (wired into add_submission and set_submission_status)

thesis_workflow.py: admin() bypass of require_supervisor and of list_examiner_reports' can_confidential
    — generic org-admin bypass (Finding 1) — FIXED this round

services/reporting/context_builder.py: _build_thesis_examiner_report's identical duplicated
    admin-bypass pattern — FIXED this round (found while fixing thesis_workflow.py — the same
    "duplicated pattern in a second consumer" risk this program has now seen four times)

thesis_workflow.py + context_builder.py: GRADUATE_STUDIES_ONLY tier unreachable (Finding 3)
    — FIXED this round in both consumers

research_lifecycle.py: require_project_write checked generic ORGANIZATION_ADMIN/SUPERVISOR org
    role instead of ResearchProjectMember, diverging from research_design.py's own established
    precedent for the same ResearchProject resource (Finding 1, third instance) — FIXED this round

peer_reviews.py: get_peer_review_case and list_review_cases' ReviewerAssignment lookups had no
    status filter at all — a revoked/declined reviewer's assignment still granted case access,
    inconsistent with search/providers.py and storage.py's already-correct filtering of the same
    relationship — FIXED this round (exposed by deciding Institutional Policy Question 3;
    unreachable in practice today since no live "revoke reviewer" endpoint exists yet, but would
    have silently violated the decided policy the moment one is added)

No domain implements a role/relationship distinct from ORGANIZATION_ADMIN for aggregate-only
institutional oversight (Finding 6) — every domain currently conflates "can see aggregates"
with "holds the full ORGANIZATION_ADMIN role" — this remains open, unrelated to Finding 1's fix
```

No other direct role checks (`if role in [...]`, `if is_global_admin`) were found to diverge from each domain's own documented model beyond what is listed above — the helper-function pattern (`verify_*`, `require_*`, `is_*_member`, `has_*_access`) is consistently used across all six domains and Thesis, and every one of them was already re-verified against its own domain's passing test suite at that domain's own closure time (per each register's own stated verification method), except Publication's and Thesis's two specific functions flagged above, which were never tested for the narrower resource-scoped model because their broader model was the intended, tested behavior at the time.
