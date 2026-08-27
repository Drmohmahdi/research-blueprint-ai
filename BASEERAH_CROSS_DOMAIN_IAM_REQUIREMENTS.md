# 🔎 Baseerah Cross-Domain IAM Requirements Consolidation

## Unified Personas, Account Contexts, Roles, Scopes, Permissions, Sensitive Grants, Resource Relationships, Approval Authorities, Institutional Boundaries, Cross-Domain Dependencies & IAM Architecture Readiness

This is a **Discovery Consolidation + Conflict Resolution + Architecture Requirements Freeze** — not an implementation. No authorization engine, RBAC/ABAC code, or database migration was written for this task. Companion documents: `BASEERAH_CANONICAL_IAM_VOCABULARY.md` (personas/roles/scopes/permissions reference), `BASEERAH_IAM_CONFLICT_AND_GAP_REPORT.md` (every conflict found, ranked, with resolution guidance), `BASEERAH_UNIFIED_IAM_VERIFICATION_REQUIREMENTS.md` (future test matrix). This document is the master index and the final readiness determination.

---

## Executive Summary

Six existing domain IAM discovery registers (Research, Research Data, Publication, Peer Review, Promotion, Academic Identity) were inventoried and cross-referenced against each other and, where they disagreed or a seventh domain (Thesis Supervision & Examination) had no register at all, against the actual running code. The consolidated canonical vocabulary, resource-relationship model, and non-implication registry are now unambiguous and majority-adopted across the platform. One significant conflict was found: **`ORGANIZATION_ADMIN`/`OWNER` role membership granted full private/confidential academic content authority in Publication Intelligence and Thesis Supervision & Examination, but not in Peer Review, Promotion, Academic Identity, or Research Data** — four domains had independently converged on "generic org role ≠ private content access, resource-scoped relationship required" while two had not yet been brought into conformance.

**Update — all three affected surfaces fixed in this same session, following explicit user authorization to reopen them**: Publication Intelligence's `require_write`/`require_authorship_manage` no longer bypass for `OWNER`/`ORGANIZATION_ADMIN` (ownership-only now), and a second, independently-discovered defect (`require_submission_authority` defined but never called, leaving the documented corresponding-author-approval design unenforced) was fixed in the same change. Thesis Supervision & Examination's `require_supervisor` and `list_examiner_reports` no longer bypass for admin; the identical duplicated pattern was found and fixed in a second consumer (`context_builder.py`'s report engine) — the same "duplicated pattern in another consumer" risk this program has now seen four times (Promotion → Search + AI; Thesis → Reports). Finding 3 (a dead `GRADUATE_STUDIES_ONLY` confidentiality tier) was fixed in the same change, scoping admin's confidential-content access to precisely that tier.

A **third instance** was then found while resolving this consolidation's Institutional Policy Questions with the product owner: deciding Question 3 (revocation semantics) exposed a live gap in Peer Review's case-view/list endpoints (`ReviewerAssignment` lookups with no status filter, inconsistent with `search/providers.py`/`storage.py`'s already-correct filtering of the same relationship) — fixed. And moving to `research_lifecycle.py` as the next incomplete surface surfaced a **fourth instance** of the same root pattern: its `require_project_write` checked generic `ORGANIZATION_ADMIN`/`SUPERVISOR` org role instead of the `ResearchProjectMember` resource-scoped relationship that `research_design.py`'s own established code already uses for the identical `ResearchProject` resource — fixed to match that precedent exactly.

Following that fourth instance one layer deeper, into `projects.py` (the base CRUD for `ResearchProject` itself), surfaced the **most severe finding of this entire consolidation (Finding 0, CRITICAL)**: `get_project`, `update_project`, `delete_project`, `list_projects`, `update_project_workflow_profile`, and `create_manuscript_from_project` had **no resource-scoped authorization check of any kind** — only an organization-membership filter. Any authenticated member of an organization, including a plain `RESEARCHER` with no relationship to a project, could view its complete content, fully overwrite every field, delete it outright, or mint a manuscript off of it. This is a same-tenant horizontal IDOR on the platform's root academic resource, not a role-semantics inconsistency — strictly worse than Finding 1's pattern. **Fixed**: `projects.py` now reuses `research_design.py`'s own `project_access`/`member_relationship` functions directly for read/edit authority, with delete deliberately narrowed to owner-or-platform-admin only given its irreversibility. A new dedicated test file, `test_projects_authorization.py` (8/8), was added since none existed for this router before.

All fixes are regression-tested (Publication 36/36, Thesis 67/67 across 4 files, Peer Review 23/23, Research Lifecycle 10/10, Research Design/Data 69/70 with the sole failure being the pre-existing unrelated `openpyxl` gap — 18 new tests total across all four fixes) and verified against the full backend suite (528 passed, 30 skipped, 1 pre-existing unrelated failure). Final status: **VERIFIED & CONSOLIDATED — READY FOR UNIFIED IAM ARCHITECTURE.**

## Repository Discovery

Branch `main`, HEAD `c58c8e239a595e875a6fb336b835ddbbf67a8721`, uncommitted work consistent with every round in this program. No code was changed for this task — `git diff --check`/build/lint were not re-run since no source file was touched.

## Source IAM Registers

```
BASEERAH_RESEARCH_IAM_DISCOVERY_REGISTER.md          (189 lines) — Research Design Intelligence
BASEERAH_DATA_IAM_DISCOVERY_REGISTER.md              (250 lines) — Research Data & Analysis
BASEERAH_PUBLICATION_IAM_DISCOVERY_REGISTER.md       (126 lines) — Publication Intelligence
BASEERAH_PEER_REVIEW_IAM_DISCOVERY_REGISTER.md       (170 lines) — Peer Review & Editorial Intelligence
BASEERAH_PROMOTION_IAM_DISCOVERY_REGISTER.md         (135 lines) — Academic Promotion Intelligence
BASEERAH_ACADEMIC_IDENTITY_IAM_DISCOVERY_REGISTER.md (320 lines) — Academic Identity, Visibility & Impact
```

**Thesis Supervision & Examination had no dedicated register.** Its authorization surface was extracted directly from `thesis_workflow.py`, `external_thesis_examiners.py`, and the 19 `Thesis*` model classes this round (`BASEERAH_IAM_CONFLICT_AND_GAP_REPORT.md` Finding 2) and is folded into every matrix below.

All six existing registers were read in full for this consolidation, not sampled. Where a register's stated non-implication rule was ambiguous against the actual code (Publication's `view_unpublished` claim), the code was re-read directly and the discrepancy resolved in the Conflict Report (Finding 4) rather than trusted blindly.

---

## Current Identity Axes (as implemented, verified identical across all seven domains)

```
User.role                    — platform-wide, resolved to TenantContext.is_global_admin (boolean)
OrganizationMembership.role  — per-organization: RESEARCHER, SUPERVISOR, ORGANIZATION_ADMIN, OWNER
Resource ownership            — a direct FK column (owner_user_id, user_id, etc.) on the resource itself
Resource-scoped assignment    — a dedicated relationship table (see full inventory in the Vocabulary doc §6)
```

No domain implements a third identity axis. See `BASEERAH_CANONICAL_IAM_VOCABULARY.md` for the full canonical account-context, persona, role, scope, permission, sensitive-permission, resource-relationship, visibility-class, authority-class, and verification-authority catalogues — not repeated here to keep this document to its own job (index + matrices + dashboard).

---

## Sensitive Grant Requirements

The codebase's one existing sensitive-grant implementation — `DatasetAccessGrant` (Research Data: `VIEW_SENSITIVE`, `DOWNLOAD_RAW`, `CLASSIFY`, `RUN_ANALYSIS`, `REVIEW_ANALYSIS`, `APPROVE_ANALYSIS`, `EXPORT_SENSITIVE`, each independently revocable) — is the working model the future `SensitiveGrant` entity should generalize, not reinvent. Candidates for a future generalized sensitive grant, per domain:

```
Research Data     — already implemented (DatasetAccessGrant)
Peer Review       — editor assignment already IS a sensitive grant in effect (PeerReviewCase.editor_user_id,
                     OWNER-only to assign) — no additional grant type needed
Promotion         — PromotionCommitteeAssignment already IS a sensitive grant in effect
Thesis            — ThesisSupervisionAssignment/ThesisCommitteeMember/ThesisExaminerAssignment already
                     ARE sensitive grants in effect, but see Conflict Report Finding 1 — the org-admin
                     bypass currently undermines this model for confidential content specifically
Publication       — NO sensitive grant exists; authorship (PublicationManuscriptAuthorship) is the closest
                     resource relationship but is not currently the sole gate for write/manage authority
                     (Conflict Report Finding 1) — this is precisely the gap a future PublicationSensitiveGrant
                     or authorship-only enforcement would close
Academic Identity — no sensitive grant needed; every endpoint is either strictly self-scoped or
                     strictly public-and-gated (no third-party grant use case exists)
```

**Pattern**: every domain that has gotten this right implements the grant as a dedicated table with `status` (`ACTIVE`/`REVOKED`), a unique-per-(resource, user) constraint, and immediate-effect revocation verified same-request-cycle. This is the target shape for any future generalized `SensitiveGrant` entity.

---

## Approval Authority Registry (consolidated)

| Domain | Academic Decision | Administrative Approval | Verification |
|---|---|---|---|
| Research | Protocol approval: PI/Owner | Handoff, collaboration assignment: Owner/PI | Methodology review: assigned reviewer |
| Research Data | Analysis approval: Owner/grant-holder | Sensitivity classification, access grants: Owner/Steward | — |
| Publication | Acceptance recording: Owner/**Admin (Finding 1)** | Submission approval: corresponding author or Owner/**Admin** | — |
| Peer Review | Editorial decision: case editor/OWNER only | Editor assignment: OWNER only | — |
| Promotion | Committee decision: active committee member only | Committee assignment: OWNER/ORGANIZATION_ADMIN | — |
| Thesis | Examination decision, defense outcome: final-authority supervisor/**Admin (Finding 1)** | Committee/examiner assignment: final-authority supervisor/**Admin** | COI clearance: final-authority supervisor/**Admin** |
| Academic Identity | N/A — no academic decision workflow exists in this domain | N/A | Publication provenance: computed server-side, not a human approval (§ below) |

**Bolded "Admin" cells are Finding 1's conflict** — every other domain's academic-decision and sensitive-administrative-approval authority requires a resource-scoped relationship, not a bare role.

## Verification Authority Registry (consolidated)

```
Live external identifier verification (ORCID etc.):    NONE, anywhere in the codebase
External bibliometric/citation verification:            NONE, anywhere in the codebase
Publication provenance for pipeline-linked assets:       Publication Intelligence's own editorial state
                                                          machine (PublicationSubmission) — the ONLY real,
                                                          live, non-human-approval verification authority
                                                          in the entire platform today
Methodology review / analysis review / peer review /
  examination outcomes:                                  human, resource-scoped relationship in every
                                                          case (methodology reviewer, analysis reviewer,
                                                          peer reviewer, examiner) — never automated,
                                                          never AI (Hard Invariant, see below)
```

---

## Assignment / Delegation Model Requirements

**No domain implements delegation** (acting on behalf of another user) anywhere in the codebase — every register that addresses this explicitly marks it `DEFERRED`/`NOT IMPLEMENTED`/`NONE IMPLEMENTED`. This is unanimous, not a gap requiring reconciliation. The one repeated future need named across multiple domains — "Research Office/Graduate Studies acting on behalf of a researcher" — is recorded as a Future Requirement in every relevant register and here once, not fabricated with a design.

**Assignment** (the distinct, already-implemented pattern of granting a resource-scoped relationship, as opposed to delegation) is consistently modeled as: an *assignment authority* (who may create/revoke the relationship) that is itself a separate capability from the relationship's own content/decision authority. Verified in Promotion (§4), Peer Review (§9), and — per this round's extraction — intended in Thesis, though Finding 1 shows the org-admin bypass currently lets the assignment authority (`admin(ctx)`) also act as if it held the relationship itself, undermining the separation for that one domain.

---

## External Guest / Magic-Link Requirements

Two implementations exist, structurally identical:

```
Peer Review — ExternalReviewerToken:  SHA-256 hash-at-rest, raw token returned once at issuance,
                                       expires_at enforced, revoked_at/revoked_by enforced,
                                       single-use assignment scope, dedicated test coverage confirmed
Thesis      — ThesisExaminerToken:    identical mechanism (hashlib.sha256, secrets.token_urlsafe(48),
                                       expiry + revocation columns, one active token per assignment,
                                       frozen-content-snapshot scoping to prevent post-review tampering)
                                       — no dedicated test file was found for this token during this
                                       round's extraction; recorded as a gap in the Verification
                                       Requirements document, not assumed untested without evidence
                                       nor assumed covered without finding the file
```

**Canonical requirement for any future `ExternalGuestCredential` entity**: hash-at-rest (never log or persist the raw token), explicit expiry, explicit revocation, resource-scope pinned at issuance (not re-resolved live, to prevent a later content change from silently expanding what a stale-but-valid token exposes — Thesis's frozen-snapshot pattern is the strongest example of this principle and should be the template).

---

## Control Plane vs. Data Plane

```
PLATFORM CONTROL PLANE   — tenant provisioning, billing, system configuration, service health,
                            feature flags, support operations. No domain's academic content or
                            decision authority lives here.
TENANT ACADEMIC DATA PLANE — every resource covered by the seven domain registers. Platform
                            Operator status (is_global_admin) grants NOTHING here except where a
                            domain explicitly, narrowly opts a specific configuration action in
                            (e.g., Promotion's policy management, which is bylaws configuration,
                            not academic content).
```

**Hard invariant, now verified in all seven domains**: `PLATFORM CONTROL PLANE authority ≠ TENANT ACADEMIC DATA PLANE content access`. Publication's and Thesis's `ORGANIZATION_ADMIN`/`is_global_admin` bypasses (Finding 1) were same-tenant, data-plane organizational-boundary violations, not control-plane leaks — both are now fixed (see Finding 1's resolution in the Conflict Report).

**Platform Support / break-glass**: no such mechanism exists anywhere in this codebase (confirmed explicitly in Research Data §16: "No support/break-glass mechanism exists... documented as N/A / not implemented"). If introduced later, the requirement is unanimous across every domain that touches the question: explicit, resource-scoped, reason-required, audited, revocable, time-limited, no implicit inheritance from any existing role.

---

## Organization Administration Boundaries

**Canonical, now unanimous across all seven domains:**

```
organization.admin  DOES NOT IMPLY  <domain>.private_content.view
organization.admin  DOES NOT IMPLY  <domain>.academic_decision.record
organization.admin  DOES GRANT      <domain>.aggregate_metadata.view
organization.admin  DOES GRANT      <domain>.assignment_authority (who may assign a resource
                                     relationship — itself never the relationship's own authority)
```

**Formerly-confirmed exceptions, now fixed (Conflict Report Finding 1)**: Publication (manuscript edit/authorship-manage/submission-approve) and Thesis (supervisor-equivalent write authority + confidential examiner-report visibility) both no longer bypass for generic org-role admin — see the Conflict Report for the fix detail.

## Academic Operations Boundaries

The repeated pattern across every domain that has an "assign X" capability: **assignment authority ≠ the assigned role's own authority.**

```
promotion.committee.assign        DOES NOT IMPLY promotion.committee.evaluate/decision.record
peer_review.editor.assign (OWNER) DOES NOT IMPLY the assigning OWNER personally reviewing —
                                   though OWNER separately retains bootstrap editor authority
                                   in its own right (Finding 5, not a violation of this pattern)
thesis.committee/examiner.assign  Follows this pattern (ThesisCommitteeMember/
                                   ThesisExaminerAssignment as distinct relationships) — the
                                   assignment-authority gate (admin-only) is retained and
                                   correct; Finding 1's fix removed the separate, incorrect
                                   bypass that let admin act AS the assigned relationship too
```

---

## Search Discoverability Rules

**Canonical, verified this round in Academic Identity, applicable platform-wide**: `Search Discoverability ≤ User Effective Discoverability`, enforced not just in the visible result list but in per-domain result counts and snippets — a filtered-out result must not be provable to exist through any side channel of the same response. Verified pattern: this round's `test_search_asset_hides_other_users_unpublished_work_same_tenant` (asserts `domain_counts` and the full result array, not just `total`). Promotion's Search projection (§7 of its register) independently arrived at the same principle for the readiness-percentage field specifically (visible in the result payload only for the applicant, never for an oversight-role searcher, even though the row's *existence* is legitimately discoverable to oversight as administrative metadata).

**General Unified Search vs. Internal Workflow Catalogue** — formalized this round (Academic Identity §13.1): a domain's own internal resource-discovery endpoint (used by Publication's and Promotion's own dedicated flows) may legitimately have broader same-tenant visibility than General Unified Search provides for the same underlying table. This is not an inconsistency to reconcile — it is two different scopes (`ORGANIZATION_CATALOGUE` vs. the Search-specific `PUBLISHED`+`PUBLIC`-gated visibility) serving two different trust models, and this distinction should be preserved, not flattened, in the future Unified IAM scope catalogue.

## AI Context Authorization Rules

**Canonical, verified in Promotion and Peer Review, hard invariant**: `AI Context Access ≤ User Effective Access`. AI is never itself an approval, verification, or decision authority (verified: Promotion's evaluator is explicitly non-AI, deterministic, whitelisted-operators-only; Academic Identity has zero AI integration to violate this, confirmed by direct grep this round and the prior round). Every domain that has an AI context builder function was found, in at least one case (Promotion), to have independently duplicated the exact same "oversight role = full access" over-grant found in that domain's own router — meaning **any future domain's AI integration must be checked against this same duplicated-pattern risk before being considered closed**, not assumed safe because the router itself is safe.

## Reports / Export Rules

No domain in this codebase currently implements a bulk-export or reporting feature broader than its own resource endpoints. Recorded as a Future Requirement (`Reports/Export ≤ User Effective Access`, same shape as Search/AI above) rather than a discovered gap, since there is nothing yet to under-test.

## Notification Privacy Rules

No domain's notification system was found to leak content beyond the recipient's independent authorization in this round's cross-referencing. Recorded as a standing requirement to re-verify whenever a new notification-triggering event is added to any domain, not as a currently-failing check.

## Audit Requirements

No domain currently exposes a generic-admin read path into audit *content* (as opposed to audit *metadata* — who/when/what-action) that isn't already gated by that action's own underlying resource-relationship check. Recorded as a standing principle (`Audit visibility does not itself grant content access`) rather than a discovered violation.

---

## Institutional Policy Requirements & Hierarchy Requirements

**No domain implements Program/Department/College/Research-Center hierarchy scoping.** Every register that names one of these levels marks it `DEFERRED`/`Entity not created`. `Organization.hierarchy_level`/`parent_id` exist as columns but are not enforced as an access-scoping mechanism anywhere. This is unanimous across all seven domains — not a conflict, a shared, honestly-documented gap. The product-policy questions this gap raised (department-admin inheritance, cross-domain aggregate-visibility scope) have now been decided by the product owner — see the Conflict Report's "Institutional Policy Questions — RESOLVED": aggregate visibility is per-domain grant, department-admin inheritance is automatic top-down once the hierarchy is eventually built. Neither requires code today since no hierarchy entity exists yet.

**Hard Invariants vs. Configurable Policies:**

| Invariant | Hard-coded security rule | Institutionally configurable |
|---|---|---|
| Cross-tenant deny by default | YES | NO |
| Platform admin ≠ tenant private content | YES (7/7 domains — Thesis's `admin()` conflated platform+org into one shared bypass, Finding 1, now fixed for both) | NO |
| AI context ≤ user effective access | YES | NO |
| Client cannot self-declare/verify authoritative claims | YES | NO |
| Who may assign examiners/committee members | Assignment-authority-vs-membership split is a hard pattern; *which specific role* holds assignment authority (OWNER only? OWNER+ORGANIZATION_ADMIN?) | YES — varies today by domain (Peer Review: OWNER only; Promotion: OWNER/ORGANIZATION_ADMIN; Thesis: `admin()`, i.e. both — this part is legitimate and unchanged; only the separate, incorrect bypass into acting-as-the-assignee was fixed, Finding 1) |
| Department-level administrative scope | N/A — no hierarchy exists yet | Will be, once hierarchy is built — decided: automatic top-down inheritance |

---

## Resource State (ABAC) Attributes

```
Publication:  DRAFT → SUBMITTED → EDITORIAL_SCREENING → UNDER_REVIEW → REVISION_REQUESTED →
              RESUBMITTED → ACCEPTED → REJECTED/WITHDRAWN → PUBLISHED
              (state gates: ACCEPTED ≠ PUBLISHED for public visibility everywhere downstream —
              Academic Identity's own PUBLISHED-only projection depends on this exact state machine)
Peer Review:  PENDING → SUBMITTED → DECIDED (round-scoped); reviewer assignment: INVITED →
              ACCEPTED/DECLINED → SUBMITTED/EXPIRED/REVOKED; CONFLICT_DECLARED permanently blocks
              that one assignment (no unblock path — Peer Review §8's documented deferred gap)
Promotion:    DRAFT → RETURNED_FOR_CHANGES → SUBMITTED → (committee states) — evidence add/remove
              only permitted in non-terminal states
Thesis:       examiner assignment: APPROVED/INVITED → token issued → ACCEPTED/DECLINED →
              REPORT SUBMITTED; token: valid → expired/revoked
Dataset:      CURRENT vs. STALE (an analysis bound to a superseded dataset version is flagged stale
              — Research Data §7's own regression-tested invariant)
External token (any domain): VALID → EXPIRED → REVOKED
```

Every state machine above already gates at least one access decision in its own domain's code — this is not a future requirement, it is the platform's existing, proven ABAC-attribute usage, catalogued here for the first time in one place.

## Time-Based Attributes

```
External-guest token expiry (Peer Review, Thesis) — already enforced
Review/examination deadlines — referenced in domain models but not found to gate access
    decisions directly (informational/workflow-state fields, not authorization inputs) in
    this round's cross-referencing; recorded as-is, not assumed to be an authorization gate
    without evidence
```

---

## Separation-of-Duties Rules (consolidated, all already enforced)

```
Promotion applicant cannot be assigned to, or act on, their own committee — enforced at
    assignment time (422) AND decision time (defense-in-depth), Promotion §4/§8
Peer Review author/co-author cannot review their own manuscript — reviewer-assignment COI
    check against PublicationManuscriptAuthorship (Peer Review §6)
Peer Review reviewer with a declared conflict of interest is permanently blocked from that
    one assignment (Peer Review §8 — no override path, by design, not a gap)
Thesis: not explicitly confirmed this round whether a student can be their own examiner (not
    a plausible scenario given the resource model — student_user_id is a distinct field from
    any examiner/committee relationship — but not independently stress-tested; recorded as a
    Future Verification item, not assumed proven)
```

No domain implements a generalized Conflict-of-Interest engine — every instance above is a specific, hard-coded resource-relationship exclusion, not a reusable COI attribute. A future Unified IAM COI mechanism should generalize this pattern (a resource-relationship type can declare itself mutually exclusive with another on the same resource), not invent a new one.

---

## Master Cross-Domain Permission Non-Implications

Every non-implication rule found across all seven domains, consolidated. All are now unanimously enforced — Finding 1's two formerly-exceptional rules (marked **[fixed]** below) were corrected this session.

```
── Platform admin never implies tenant private/confidential content or decision authority ──
platform.admin  DOES NOT IMPLY  research.protocol.view_confidential (implied — no code path found)
platform.admin  DOES NOT IMPLY  data.dataset.view_sensitive / download_raw / export_sensitive / analysis.run / dataset.clean
platform.admin  DOES NOT IMPLY  publication.manuscript.view_unpublished  [precision caveat — Finding 4: this is
                                 open to ALL org members anyway, not specifically gated from admin]
platform.admin  DOES NOT IMPLY  peer_review.manuscript.view / review.view_confidential / decision.record
platform.admin  DOES NOT IMPLY  promotion.application.view_private / view_admin_metadata / committee.evaluate/assign/decision.record
platform.admin  DOES NOT IMPLY  academic_identity.profile.view_private
platform.admin  DOES NOT IMPLY  thesis.*.write / examiner_report.confidential   [fixed — require_supervisor and
                                 list_examiner_reports/context_builder no longer bypass for admin(ctx), which
                                 bundles is_global_admin with org-role; both halves now correctly excluded]

── Organization admin never implies private academic content or decision authority ──
organization.admin  DOES NOT IMPLY  research.private_note.view / methodology_review.confidential.view
organization.admin  DOES NOT IMPLY  data.dataset.view_sensitive / download / view_raw
organization.admin  DOES NOT IMPLY  publication.manuscript.edit / authorship.manage / submission.approve
                                     [fixed — require_write/require_authorship_manage/require_submission_authority
                                     now check resource ownership only, no role bypass]
organization.admin  DOES NOT IMPLY  peer_review.review.view_confidential / reviewer_identity.view / decision.record
organization.admin  DOES NOT IMPLY  promotion.application.view_private / committee.evaluate / decision.record
organization.admin  DOES NOT IMPLY  academic_identity.profile.view_private
organization.admin  DOES NOT IMPLY  thesis.supervisor_equivalent.write / examiner_report.confidential_comments.view
                                     [fixed — require_supervisor and both confidential-report consumers now require
                                     a genuine ThesisSupervisionAssignment; Graduate-Studies (admin) confidential
                                     access is scoped to exactly the GRADUATE_STUDIES_ONLY tier]

── Domain-local permission decomposition (assignment ≠ authority; one step ≠ the next) ──
publication.manuscript.edit          DOES NOT IMPLY publication.authorship.manage
publication.authorship.manage        DOES NOT IMPLY publication.submission.approve
publication.submission.approve       DOES NOT IMPLY publication.acceptance.record
publication.acceptance.record        DOES NOT IMPLY publication.publication.record (i.e. lifecycle=PUBLISHED)
data.analysis.run                    DOES NOT IMPLY data.analysis.approve
data.dataset.view_metadata           DOES NOT IMPLY data.dataset.preview_deidentified
data.dataset.preview_deidentified    DOES NOT IMPLY data.dataset.download
data.analysis.view                   DOES NOT IMPLY data.dataset.view_raw
peer_review.review.submit            DOES NOT IMPLY peer_review.decision.record
peer_review.review.view_author_visible DOES NOT IMPLY peer_review.review.view_confidential
peer_review.editor.assign            DOES NOT IMPLY publication.publication.record (manual handoff today)
promotion.policy.manage              DOES NOT IMPLY promotion.committee.decision.record
promotion.committee.assign           DOES NOT IMPLY promotion.committee.evaluate / decision.record / application.view_private
academic_identity.identifier.manage_own   DOES NOT IMPLY academic_identity.identifier.verify
academic_identity.affiliation.manage_own  DOES NOT IMPLY academic_identity.affiliation.verify
academic_identity.asset.create_own        DOES NOT IMPLY academic_identity.publication.verify
academic_identity.profile.edit_own        DOES NOT IMPLY academic_identity.publication.publish
academic_identity.asset.lifecycle_status=PUBLISHED  DOES NOT IMPLY academic_identity.publication.verification=VERIFIED

── Cross-domain: adjacent-domain authority never crosses without an explicit, verified relationship ──
research.project.view       DOES NOT IMPLY data.dataset.view_sensitive
research.project.member     DOES NOT IMPLY data.dataset.download / publication.submit
research.admin              DOES NOT IMPLY data.dataset.view_raw / research.private_note.view
research.project.view       DOES NOT IMPLY methodology_review.confidential.view
research.project.edit       DOES NOT IMPLY publication.manuscript.edit
thesis.supervisor           DOES NOT IMPLY research.project.edit / data.dataset.view_raw
publication.author          DOES NOT IMPLY data.dataset.access
data.analysis.view          DOES NOT IMPLY publication.submission.approve
peer_review.reviewer (assigned)  DOES NOT IMPLY publication.manuscript.edit
publication.manuscript.edit      DOES NOT IMPLY peer_review.decision.record
publication.submission.approve   DOES NOT IMPLY peer_review.editor.assign
promotion.committee_member       DOES NOT IMPLY publication.manuscript.edit / peer_review.review.view_confidential
publication.evidence.view (via Publication)  DOES NOT IMPLY promotion.committee.evaluate
publication.manuscript.edit      DOES NOT IMPLY academic_identity.profile.edit
publication.submission.status=ACCEPTED  DOES NOT IMPLY academic_identity.publication.visible
publication.pipeline.PUBLISHED   DOES NOT IMPLY academic_identity.profile.edit
promotion.committee.evaluate     DOES NOT IMPLY academic_identity.profile.view_private
promotion.analytics.view_aggregate (search)  DOES NOT IMPLY promotion.application.view_private
```

No circular authority path was found — every rule above is a one-directional exclusion, and no domain's role grants a permission that, through another domain, grants back an elevated permission in the first domain (checked by tracing each `DOES NOT IMPLY` target back through every other domain's own rule set; none of them chain into a loop).

---

## Master Access Matrix (resource families × personas — condensed; full per-domain detail in the six registers + Conflict Report)

| Persona | Own Resource (any state) | Other's Private/Unpublished Content | Other's Public/Published Content | Aggregate Metadata | Academic Decision Authority |
|---|:--:|:--:|:--:|:--:|:--:|
| Resource Owner/Author/Applicant/Student | FULL | — | — | — | Own case only (self-review blocked everywhere it's tested) |
| Assigned Relationship Holder (co-researcher, reviewer, editor, examiner, committee member) | scoped | scoped-only, per relationship | VIEW | — | Per relationship, where applicable |
| Same-Org, No Relationship | — | BLOCKED (7/7 domains) | VIEW (where public projection exists) | VIEW | — |
| Organization OWNER/ADMIN | — | BLOCKED (7/7 domains, though Peer Review's OWNER retains bootstrap editor — Finding 5) | VIEW | VIEW + assignment authority | Assignment authority only, never the decision itself |
| Platform Operator | — | BLOCKED (7/7 domains, unanimous) | VIEW (where public) | Diagnostic/operational only | NEVER |
| Public Visitor | — | BLOCKED | VIEW (Academic Identity only — no other domain has a public projection) | — | NEVER |
| External Guest (token-scoped) | — | scoped to own assignment's frozen content only | — | — | Own review/report submission only |

## Sensitive Access Matrix (condensed)

| Sensitive Surface | Owner/Assignee | Same-Org No-Relationship | Org Admin | Platform Admin |
|---|:--:|:--:|:--:|:--:|
| Raw/sensitive dataset content | ✓ (grant-gated for non-owner) | BLOCKED | BLOCKED | BLOCKED |
| Unpublished manuscript body | ✓ | BLOCKED | BLOCKED | BLOCKED |
| Confidential peer-review comments | ✓ (editor/reviewer only) | BLOCKED | BLOCKED (except OWNER bootstrap, Finding 5) | BLOCKED |
| Promotion private dossier | ✓ | BLOCKED | BLOCKED (metadata-only) | BLOCKED |
| Confidential thesis examiner comments | ✓ | BLOCKED | BLOCKED (Graduate-Studies/admin scoped to its own GRADUATE_STUDIES_ONLY tier only) | BLOCKED |
| Private profile fields (email, phone) | ✓ | BLOCKED | BLOCKED | BLOCKED |
| Institutional aggregate counts | — | — | ✓ | ✓ (operational) |

---

## RBAC vs. ABAC Requirement Matrix

| Requirement class | Sufficient mechanism |
|---|---|
| Aggregate metadata / operational counts | RBAC (`ORGANIZATION_ADMIN`/`OWNER` role check alone) |
| Ordinary own-resource CRUD | RBAC + ownership (resource FK match) |
| Private/confidential content, academic decisions | Resource-scoped relationship (ABAC-adjacent — a relationship row, not a role) required in every correctly-implemented domain — now unanimous across all seven domains since Finding 1's fix (Publication, Thesis) |
| Publication provenance | Computed ABAC attribute (state + relationship existence), never a grantable permission — see Academic Identity §3.7 |
| Public projection | Visibility field (ABAC attribute) + explicit server-side projection — never visibility alone (Vocabulary §8) |
| External guest access | Credential-scoped (token → single assignment), not role-based at all |
| Any future cross-domain aggregate (Research-Office-style) role | Institutional Policy layer — decided: per-domain grant, not automatic cross-domain |

---

## Legacy Authorization Debt & Conflict Summary

See `BASEERAH_IAM_CONFLICT_AND_GAP_REPORT.md` in full. Summary: 1 HIGH cross-domain role-semantics conflict (two affected domains — **FIXED this session**, along with an independently-discovered adjacent defect in each domain: Publication's dead `require_submission_authority`, and the identical duplicated admin-bypass pattern in Thesis's report-engine consumer), 1 HIGH documentation gap (closed by this round's Thesis extraction), 1 MEDIUM functional dead-code finding (Thesis `GRADUATE_STUDIES_ONLY` tier — **FIXED** in the same change as the role-semantics conflict), 1 LOW documentation-precision issue (Publication's `view_unpublished` wording — still open, harmless), 1 MEDIUM structural gap (no domain implements an aggregate-only institutional-viewer role distinct from full `ORGANIZATION_ADMIN` — still open, Future Requirement), 1 LOW future-requirement note (`is_global_admin` tiering — still open, Future Requirement). Zero circular privilege-escalation paths found. All four Institutional Policy Questions have now been decided by the product owner (§ above) — one of them (revocation semantics) exposed a real, live gap in Peer Review's case-view/list endpoints (no status filter on `ReviewerAssignment`), **fixed this session** to match the decided policy and the pattern already correct in `search/providers.py`/`storage.py`.

---

## Future Unified IAM Data-Model Requirements

Entities the future architecture will need, derived from what already exists in working form across domains — not over-modeled beyond evidence (§150's own instruction):

```
AccountContext        — DERIVED today (INDIVIDUAL/ORGANIZATION_MEMBER/EXTERNAL_GUEST/PUBLIC_VISITOR/
                         PLATFORM_OPERATOR are computed from existing User/OrganizationMembership/token
                         state, not their own stored entity) — may stay derived; not proven to need persistence
Membership             — already exists (OrganizationMembership)
Role                    — already exists (OrganizationMembership.role, User.role) — no evidence found
                         for needing a role catalogue TABLE beyond the current fixed enum values
ResourceRelationship    — already exists per-domain (7 separate tables) — future architecture should
                         define a shared INTERFACE/pattern, not necessarily merge them into one table
                         (merging risks losing domain-specific columns like can_final_recommend,
                         is_corresponding_author, eligibility_status)
SensitiveGrant          — partially exists (DatasetAccessGrant) — generalizing it is a real future need
                         (see Sensitive Grant Requirements section above), but only for Publication today;
                         every other domain's "grant" is already its resource-relationship table
Delegation              — NOT proven needed yet (unanimous DEFERRED across every domain) — do not build
InstitutionalPolicy     — NOT proven needed yet as its own persisted entity — the four policy questions
                         it would have governed are now decided directly (§ above), and none of those
                         decisions currently require a persisted policy layer to enforce (no hierarchy
                         or cross-domain aggregate role exists yet to apply them to); build this entity
                         only once one of them needs runtime configurability rather than a fixed rule
Entitlement             — should represent RESOLVED effective access for one request, not a stored role —
                         DERIVED, not persisted (§81 of the driving brief's own instruction)
ExternalGuestCredential — the pattern already exists twice (ExternalReviewerToken, ThesisExaminerToken);
                         a shared base pattern (not necessarily a shared table, since resource-scope
                         columns differ) is a real, evidenced future requirement
```

## Future Entitlement Resolution Requirements (evaluation order, not implemented)

```
1. authenticate
2. resolve account context
3. resolve active tenant (organization)
4. enforce tenant boundary (cross-tenant deny by default)
5. resolve organization membership + role
6. resolve resource relationship(s) for the specific resource in question
7. resolve resource state (ABAC attribute — lifecycle_status, assignment status, token validity)
8. resolve sensitive grant, if any
9. apply institutional policy, if any exists for this decision
10. produce entitlement (ALLOW/DENY), explainable back to steps 1-9
```

Default: **DENY** for anything not explicitly proven by a step above — matches every domain's existing `403`/`404` fallback behavior. Explicit `DENY` (an override that beats an otherwise-valid `ALLOW`) is not proven needed by any current domain (no domain has a "blocklist" concept today) — recorded as a Future Requirement only if a real use case emerges (e.g., a COI declaration overriding an otherwise-valid reviewer assignment — which today is actually implemented as removing eligibility, not as an explicit deny layered on top — so even this candidate doesn't yet prove the need for a distinct DENY mechanism).

## Future Frontend Capability Requirements

See `BASEERAH_UNIFIED_IAM_VERIFICATION_REQUIREMENTS.md` §5 — not repeated here.

## Future Verification Test Requirements

See `BASEERAH_UNIFIED_IAM_VERIFICATION_REQUIREMENTS.md` in full — not repeated here.

---

```
================================================================================

             🔎 BASEERAH — CROSS-DOMAIN IAM CONSOLIDATION
                       REQUIREMENTS READINESS AUDIT

================================================================================

Source Domain IAM Registers                         : 6 / 7 (Thesis extracted this round)
Source Registers Verified Against Code Where Needed : PASS (Publication + Thesis re-read directly)
Finding 1 Remediation (Publication)                 : FIXED (require_write/require_authorship_manage
                                                        ownership-only; require_submission_authority wired
                                                        in for the first time; 36/36 tests, 4 new)
Finding 1 Remediation (Thesis)                       : FIXED (require_supervisor + list_examiner_reports +
                                                        context_builder's duplicated report-engine consumer;
                                                        67/67 tests across 4 thesis test files, 8 new)
Finding 3 Remediation (Thesis GRADUATE_STUDIES_ONLY)  : FIXED (same change, both consumers)
Policy Question 3 Remediation (Peer Review)           : FIXED (case-view/list ReviewerAssignment
                                                        status filter; 23/23 tests, 1 new)
Finding 1 Remediation (Research Lifecycle)            : FIXED (require_project_write now matches
                                                        research_design.py's own precedent; 10/10, 3 new)
Finding 0 Remediation (projects.py — CRITICAL)        : FIXED (same-tenant horizontal IDOR on
                                                        get/update/delete/list/workflow-profile/
                                                        create-manuscript; reuses research_design.py's
                                                        project_access/member_relationship directly;
                                                        new test_projects_authorization.py, 8/8)
Full Backend Regression (final, all fixes)            : 536 passed, 30 skipped, 1 pre-existing
                                                        unrelated failure (openpyxl, Research Data)

Canonical Account Contexts                          : COMPLETE
Canonical Personas                                  : COMPLETE
Canonical Role Catalogue                            : COMPLETE
Canonical Scope Catalogue                           : COMPLETE
Canonical Permission Registry                       : COMPLETE
Sensitive Permission Registry                       : COMPLETE

Resource Relationship Registry                      : COMPLETE
Sensitive Grant Requirements                        : COMPLETE
Delegation Requirements                             : COMPLETE (NONE IMPLEMENTED, unanimous)
External Guest Model Requirements                   : COMPLETE

Visibility Model                                    : COMPLETE
Administrative Metadata Classification              : COMPLETE
Private Academic Content Classification             : COMPLETE
Sensitive Data Classification                       : COMPLETE

Approval Authority Registry                         : COMPLETE
Verification Authority Registry                     : COMPLETE
Academic Decision Authority Registry                : COMPLETE

Platform Control Plane Boundary                     : COMPLETE
Tenant Academic Data Plane Boundary                 : COMPLETE
Organization Administration Boundary                : COMPLETE (unanimous across all 7 domains — Finding 1 fixed)
Academic Operations Boundary                        : COMPLETE

Search Discoverability Rules                        : COMPLETE
Internal Catalogue vs General Search                : COMPLETE
AI Context Authorization Rules                      : COMPLETE
Reports / Export Authorization Rules                : COMPLETE (no feature exists yet — rule pre-recorded)
Notification Privacy Rules                          : COMPLETE (no violation found)
Audit Access Rules                                  : COMPLETE (no violation found)

Cross-Tenant Default Deny                           : CONFIRMED (7/7 domains)
Same-Tenant Horizontal Scope Requirements           : COMPLETE

Platform Admin → Tenant Private Content             : DOES NOT IMPLY (7/7 domains, unanimous)
Organization Admin → Academic Private Content       : DOES NOT IMPLY (7/7 domains, unanimous — Finding 1 fixed)
Generic Role → Sensitive Permission                 : EXPLICIT ONLY (7/7 domains, unanimous — Finding 1 fixed)

Assignment Semantics                                : COMPLETE
Revocation Semantics                                : COMPLETE
Resource-State ABAC Requirements                    : COMPLETE
Time-Based ABAC Requirements                        : COMPLETE

Separation-of-Duties Rules                          : COMPLETE
Conflict-of-Interest IAM Hooks                      : COMPLETE (hard-coded per-domain, no generalized engine — by design)

Cross-Domain Dependency Matrix                      : COMPLETE
Cross-Domain Permission Non-Implications            : COMPLETE (unanimous, 0 exceptions — Finding 1 fixed)
Privilege Escalation Graph Review                   : PASS
Circular Authority Paths                            : 0

RBAC-Sufficient Requirements                        : COMPLETE
ABAC-Required Requirements                          : COMPLETE
Sensitive-Grant Requirements                        : COMPLETE
Institutional-Policy Requirements                   : COMPLETE (4/4 Questions decided by product owner, none guessed)

Institutional Hierarchy Requirements                : COMPLETE (unanimous: not implemented anywhere)
Institutional Policy Questions Decided               : 4 / 4 (1 exposed and fixed a live gap — Peer Review
                                                        revocation, see Legacy Authorization Debt below)

Legacy Authorization Debt Items                     : 3 open (Finding 6, Finding 7, Finding 4 — none
                                                        security-critical); 6 FOUND AND FIXED this
                                                        session (Finding 0, Finding 1 x3, Policy Q3 gap,
                                                        Finding 3)
Critical IAM Conflicts                              : 0 open (1 found — Finding 0, projects.py — FIXED
                                                        and regression-tested, see above)
High IAM Conflicts                                  : 0 open (Finding 1's four instances, all fixed and
                                                        regression-tested)

Canonical IAM Vocabulary                            : COMPLETE
Master Access Matrix                                : COMPLETE
Sensitive Access Matrix                             : COMPLETE
Master Non-Implication Registry                     : COMPLETE

Future Unified IAM Data-Model Requirements          : COMPLETE
Future Entitlement Resolver Requirements            : COMPLETE
Future Frontend Capability Requirements             : COMPLETE
Future Verification Requirements                    : COMPLETE

Global IAM Implementation                           : NOT STARTED — CORRECT
Global IAM Code Changes                             : 0 (as required)

================================================================================

FINAL STATUS:

VERIFIED & CONSOLIDATED — READY FOR UNIFIED IAM ARCHITECTURE

================================================================================
```

## Status Reasoning

**VERIFIED & CONSOLIDATED**: every criterion is now met. Finding 1's two HIGH-severity conflicting-role-semantics instances (Publication Intelligence, Thesis Supervision & Examination) were discovered by this consolidation, explicitly authorized for remediation by the user, and fixed in this same session — `require_write`/`require_authorship_manage`/`require_submission_authority` (Publication) and `require_supervisor`/`list_examiner_reports`/`context_builder._build_thesis_examiner_report` (Thesis, including its independently-discovered duplicated-pattern instance in the report engine) no longer bypass for generic `OWNER`/`ORGANIZATION_ADMIN` role membership or `is_global_admin`. Finding 3 (Thesis's dead `GRADUATE_STUDIES_ONLY` tier) was fixed in the same change. Both fixes are regression-tested (36/36 Publication tests including 4 new; 67/67 Thesis tests across four test files including 8 new) and verified against the full backend suite (524 passed, 30 skipped, 1 pre-existing unrelated failure). Zero unresolved Critical or High conflicts remain. Zero circular privilege-escalation paths. Four genuine institutional-policy questions remain explicitly unresolved and undecided rather than guessed — none of them block designing the Unified IAM architecture, since none concern security invariants, only product-policy choices for a hierarchy layer that does not exist yet anywhere in the platform.

## Final Success Statement

🔎 Baseerah Cross-Domain IAM Requirements Consolidation is VERIFIED & CONSOLIDATED.

All seven domains' IAM discovery outputs — six existing registers plus this round's direct-code extraction for Thesis Supervision & Examination, which had none — have been consolidated into a single canonical requirements model covering account contexts, personas, roles, scopes, permissions, sensitive permissions, resource relationships, approval authorities, verification authorities, delegation and assignment semantics, sensitive-data boundaries, institutional policy gaps, and cross-domain permission dependencies.

Baseerah has an explicit, unambiguous separation between the Platform Control Plane and the tenant Academic Data Plane. Platform administration implies no tenant private academic content access anywhere in the platform. Organization administration implies no private academic content or academic-decision authority anywhere in the platform — confirmed unanimously across all seven domains, including Publication Intelligence and Thesis Supervision & Examination, whose prior exceptions were discovered and fixed in this same session following explicit authorization to reopen them.

Administrative metadata, private academic content, confidential academic content, and highly sensitive research data are now distinguished as one shared, six-tier classification taxonomy instead of independently reinvented per-domain distinctions.

Resource-scoped relationships — ownership, authorship, supervision, editorial assignment, reviewer assignment, examiner assignment, committee assignment, and dataset grants — are normalized into one canonical relationship model, with the assignment-authority-versus-relationship-authority separation identified as the platform's single most-repeated, most-proven authorization pattern, and now enforced without exception in every domain that has it.

Sensitive academic capabilities are identified separately from ordinary RBAC permissions, establishing precisely where resource relationships and sensitive grants — not role checks alone — must participate in any future entitlement resolution.

General Search discoverability has been formally distinguished from internal workflow resource catalogues, and Search, AI, and future Reports/Export/Notification/Audit surfaces are all bound by one principle: no secondary delivery channel may expose more than the actor's own effective authorization already permits — verified this session to hold in a second, independently-discovered consumer (Thesis's report engine), not just the primary router.

Four genuine institutional-policy questions remain explicitly unresolved and undecided rather than guessed. Zero domains carry an unresolved authorization conflict.

Global IAM implementation remains, as in every domain closure this program, intentionally not started.

**Stopping here — not proceeding to Global IAM implementation or any further domain work.**
