# Baseerah Canonical IAM Vocabulary

Consolidated from six existing domain IAM discovery registers (`BASEERAH_RESEARCH_IAM_DISCOVERY_REGISTER.md`, `BASEERAH_DATA_IAM_DISCOVERY_REGISTER.md`, `BASEERAH_PUBLICATION_IAM_DISCOVERY_REGISTER.md`, `BASEERAH_PEER_REVIEW_IAM_DISCOVERY_REGISTER.md`, `BASEERAH_PROMOTION_IAM_DISCOVERY_REGISTER.md`, `BASEERAH_ACADEMIC_IDENTITY_IAM_DISCOVERY_REGISTER.md`) plus direct code verification where the registers disagreed with each other (see `BASEERAH_IAM_CONFLICT_AND_GAP_REPORT.md`). Thesis Supervision & Examination had no dedicated register; its authorization surface was extracted directly from code for this consolidation (§2.9, §7 below). This is a **vocabulary reference**, not an implementation — nothing here has been wired into a permission engine.

---

## 1. Canonical Account Contexts

| Context | Meaning | Present in |
|---|---|---|
| `INDIVIDUAL` | A user acting on their own resource, no organization required (e.g. a personal research project, own profile) | Research, Research Data, Academic Identity |
| `ORGANIZATION_MEMBER` | A user acting within an active organization context (`X-Organization-ID` / `TenantContext.organization`) | Every domain |
| `EXTERNAL_GUEST` | No Baseerah account; identified solely by a hashed, single-purpose, time-limited token | Peer Review (`ExternalReviewerToken`), Thesis (external examiner token — same pattern, see §7) |
| `PUBLIC_VISITOR` | Unauthenticated, gated to an explicit public-projection endpoint only | Academic Identity (`/public/{username}`) |
| `PLATFORM_OPERATOR` | Platform-wide staff (`User.role` / `TenantContext.is_global_admin`), independent of any organization membership | Every domain (as the *subject* of a non-implication rule, not as a grantee of content access) |

**Account Context ≠ Role.** `PLATFORM_OPERATOR` describes *where* a session is acting from, not *what* it may do — every domain register independently confirms platform-operator status alone grants no academic content access (§3 below).

---

## 2. Canonical Persona Inventory (deduplicated, by layer)

### Layer 1 — Researcher Workspace

| Canonical Persona | Aliases found across domains | Domains |
|---|---|---|
| Researcher | "Researcher / Primary Author", "Profile Owner" | Research, Research Data, Publication, Academic Identity |
| Principal Investigator (PI) | — | Research, Research Data |
| Co-Researcher | "Co-Author" (Publication) | Research, Research Data, Publication |
| Research Assistant | — | Research, Research Data |
| Graduate Student | (Thesis — candidate/student role, see §7) | Thesis |

### Layer 2 — Academic Operations

| Canonical Persona | Aliases found across domains | Domains |
|---|---|---|
| Methodology Reviewer | — | Research |
| Data Analyst | — | Research Data |
| Statistician / Analysis Reviewer | — | Research Data |
| Data Steward | — | Research Data |
| Corresponding Author | resource-scoped, `PublicationManuscriptAuthorship.is_corresponding_author` | Publication |
| Publication Coordinator | resource-scoped, not a global role | Publication |
| Reviewer (internal) | — | Peer Review |
| External Reviewer | — | Peer Review (magic-link) |
| Editor | case-scoped (`PeerReviewCase.editor_user_id`) | Peer Review |
| Thesis Supervisor | — | Thesis, cross-referenced (non-implication only) in Research, Research Data |
| Thesis Committee Member / Examiner (internal, external) | — | Thesis |
| Promotion Applicant | — | Promotion |
| Promotion Committee Member | application-scoped (`PromotionCommitteeAssignment`) | Promotion |

### Layer 3 — Institutional Governance & Intelligence

| Canonical Persona | Aliases found across domains | Domains |
|---|---|---|
| Organization OWNER | "Organization Owner", bootstrap authority | Every domain — **meaning varies, see Conflict Report §1** |
| Organization Admin | "Research Administrator", "Committee Administrator" | Every domain — **meaning varies, see Conflict Report §1** |
| Research Office Viewer | — | Research, Research Data (documented need, not implemented as a distinct role) |
| Institutional/Executive Viewer | "Institutional Data Viewer", "Institutional Publication Viewer" | Research, Research Data, Publication (documented need, not implemented as a distinct role in any domain) |
| Promotion Committee Administrator | resource-adjacent — assigns committee members, does not itself gain member authority | Promotion |
| Graduate Studies (institutional oversight of Thesis) | — | Thesis (see §7 — assumed by analogy to Promotion's pattern, not yet confirmed implemented as a distinct capability) |

### Layer 4 — Platform Control Plane

| Canonical Persona | Aliases found across domains | Domains |
|---|---|---|
| Platform Operator / SystemAdmin | "Platform Support", "Platform Super Admin" (aliases anticipated, not distinctly implemented — `User.role` currently only distinguishes `is_global_admin` true/false, not tiers within it) | Every domain |

**No domain implements a Research Office / Executive Viewer / Institutional Aggregate Viewer as a real, distinct, grantable role today** — every register that mentions one marks it "documented need, not implemented." This is recorded once here rather than repeated per domain; see the Deferred Capabilities section of `BASEERAH_CROSS_DOMAIN_IAM_REQUIREMENTS.md`.

---

## 3. Canonical Role Catalogue

Two independent, orthogonal role axes exist in the actual codebase today — confirmed identically in every domain register:

```
OrganizationMembership.role  (per-organization):  RESEARCHER, SUPERVISOR, ORGANIZATION_ADMIN, OWNER
User.role                    (platform-wide):     resolved to a single boolean, TenantContext.is_global_admin
```

There is no third axis. Every "persona" in §2 is a mapping from these two role values plus zero or more **resource relationships** (§6) — never a role value alone for anything sensitive (§5, §Hard Invariant EscalationRule).

**Role composition**: a user's effective authority in any one request is `OrganizationMembership.role` (for that active org) + `is_global_admin` (platform-wide, independent) + whichever resource relationships apply to the specific resource being accessed. A user can simultaneously be `RESEARCHER` in their org role and hold a `ThesisCommitteeMember` relationship on one thesis and a `PromotionCommitteeAssignment` on one promotion application — these compose additively per-resource, never as a blanket elevation.

---

## 4. Canonical Scope Catalogue

| Scope | Meaning |
|---|---|
| `SELF` | The caller's own account/profile — no resource relationship needed |
| `OWN_RESOURCE` | A resource the caller owns outright (project, dataset, manuscript, scholarly asset, application) |
| `ASSIGNED_RESOURCE` | A resource the caller holds an explicit, resource-scoped relationship to (member, reviewer, editor, examiner, committee member, grantee) |
| `ORGANIZATION_AGGREGATE` | Counts/status/metadata only, no resource content, scoped to one organization |
| `ORGANIZATION_CATALOGUE` | Broader org-wide *internal* visibility for collaboration tooling (e.g. `ScholarlyAsset` internal catalogue) — deliberately distinct from `ORGANIZATION_AGGREGATE` (which is metadata-only) and from `PUBLIC` (§ Academic Identity §13.1's formal separation) |
| `PUBLIC` | Unauthenticated, explicitly-projected, visibility-gated |
| `PLATFORM` | Platform-operator scope — control-plane operations only, never tenant academic content (§ Hard Invariant) |

`PROGRAM`/`DEPARTMENT`/`COLLEGE`/`RESEARCH_CENTER` scopes are named as **future-only** in every register that mentions them (Research, Research Data, Publication) — no entity or enforcement exists for any of them today.

---

## 5. Canonical Permission Registry (domain.resource.action)

Consolidated and renamed to one convention; each entry traces to the exact permission name used in its source register.

```
research.project.view / .create / .edit / .archive
research.team.manage / .member.assign
research.protocol.create / .submit / .review / .recommend / .approve
research.coherence.view / .readiness.view / .handoff.create
research.analytics.view_aggregate

data.dataset.view_metadata / .preview_deidentified / .view_sensitive / .download
data.dataset.upload / .classify / .archive
data.variable.view / .edit / .classify
data.quality.view / .resolve
data.cleaning.create / .version.create
data.analysis.plan / .run / .view / .review / .approve
data.result.export / .dataset.export_deidentified / .export_sensitive
data.access.manage
data.analytics.view_aggregate

publication.manuscript.view / .edit / .create_version
publication.authorship.view / .manage / .confirm
publication.submission.prepare / .approve / .record
publication.acceptance.record
publication.journal.search / .shortlist
publication.analytics.view_aggregate

peer_review.case.create / .view / .view_aggregate
peer_review.editor.assign
peer_review.round.create
peer_review.reviewer.invite / .accept / .decline
peer_review.review.save_draft / .submit / .view_author_visible / .view_confidential
peer_review.reviewer_identity.view / .author_identity.view_blind_context
peer_review.revision.upload
peer_review.decision.record
peer_review.operations.view_aggregate
peer_review.ai.review_summary

promotion.application.create / .view_own / .edit_own / .submit
promotion.evidence.manage_own
promotion.evaluation.run_own / .view_own
promotion.policy.view / .manage
promotion.committee.assign / .view / .evaluate / .decision.record
promotion.application.view_admin_metadata / .view_private
promotion.analytics.view_aggregate

academic_identity.profile.view_own / .edit_own / .view_public
academic_identity.identifier.manage_own / .affiliation.manage_own
academic_identity.asset.create_own / .edit_own / .view_own / .view_public / .view_org_catalogue
academic_identity.visibility.manage_own
academic_identity.publication.verify (server-computed only, not grantable — see §9)

thesis.* — see §7 (extracted this round, not yet a stable named registry; treat as provisional)
```

---

## 6. Canonical Resource Relationships

| Canonical Relationship | Domain-specific implementations |
|---|---|
| `owner_of` | `ResearchProject.userId`, `ResearchDataset.owner_id`, `ScholarlyAsset.owner_user_id`, `UnifiedAcademicProfile.user_id` |
| `pi_of` | `ResearchProjectMember.relationship == "PI"` |
| `member_of_project` | `ResearchProjectMember.status == "ACTIVE"` |
| `assistant_on` | `ResearchProjectMember` + `assigned_sections` JSON |
| `reviewer_of` (methodology) | `MethodologyReview` |
| `reviewer_of` (peer review) | `ReviewerAssignment.reviewer_user_id` |
| `external_reviewer_of` | `ExternalReviewerToken → ReviewerAssignment` |
| `editor_of` | `PeerReviewCase.editor_user_id` |
| `author_of` / `coauthor_of` / `corresponding_author_of` | `PublicationManuscriptAuthorship` |
| `granted_access_to` (dataset) | `DatasetAccessGrant` (capability-scoped: `VIEW_SENSITIVE`, `DOWNLOAD_RAW`, `CLASSIFY`, `RUN_ANALYSIS`, `REVIEW_ANALYSIS`, `APPROVE_ANALYSIS`, `EXPORT_SENSITIVE`) |
| `steward_of_dataset` | `CLASSIFY` capability (owner or grant) |
| `committee_member_of` (promotion) | `PromotionCommitteeAssignment`, status `ACTIVE` |
| `committee_administrator_of` | `OWNER`/`ORGANIZATION_ADMIN` acting on `PromotionCommitteeAssignment` — assignment authority, not membership |
| `supervisor_of` (thesis) | `ThesisSupervisionAssignment` (name inferred from cross-references; see §7) |
| `committee_member_of` / `examiner_of` (thesis) | `ThesisCommitteeMember` / `ThesisExaminerAssignment` (names inferred from cross-references; see §7) |
| `publication_pipeline_link` | `PublicationSubmission.asset_id → ScholarlyAsset.id` — the authority that makes a scholarly asset's lifecycle pipeline-owned and its provenance `BASEERAH_PIPELINE_VERIFIED` |

**Pattern observed across every domain that has one**: an *assignment authority* (who may assign/revoke a resource relationship) is always modeled as a distinct capability from the relationship itself — assigning a committee member/editor/examiner never itself grants the assigning administrator the member/editor/examiner's own content authority. This is the single most-repeated design pattern across the whole platform (Promotion §4, Peer Review §9, and — per this round's discovery — apparently intended but not yet confirmed for Thesis, §7).

---

## 7. Thesis Supervision & Examination — Provisional Vocabulary (extracted this round)

No dedicated IAM register existed for this domain before this consolidation. Personas, relationships, and the generic-org-admin-boundary question were extracted directly from `thesis_workflow.py`/`external_thesis_examiners.py`/`models.py` this round — see `BASEERAH_IAM_CONFLICT_AND_GAP_REPORT.md` for the full extraction and the specific finding on whether Thesis follows the same "org-admin ≠ private content" pattern as every other domain.

---

## 8. Visibility Classes

```
PUBLIC              — unauthenticated-reachable, explicit server-side projection
INSTITUTIONAL       — intended for same-organization visibility (used as a stored value in
                       UnifiedAcademicProfile.visibility_status; NOT currently honored by
                       Unified Search — a documented, safe-by-default functional gap, not a leak)
PRIVATE             — owner-only
ORGANIZATION_INTERNAL — the internal-catalogue scope (§4 ORGANIZATION_CATALOGUE) — distinct from
                       INSTITUTIONAL, which is a profile-visibility value; this is a data-scope concept
```

**Visibility ≠ Authorization.** Every domain that has a visibility field enforces it as one input to an access decision alongside relationship/role checks — never as the sole gate (confirmed: Academic Identity's public endpoint still requires `lifecycle_status == PUBLISHED` in addition to `visibility == PUBLIC`, §Academic Identity Core Finding 3.3).

---

## 9. Authority Classes

```
Academic Decision Authority     — editorial decisions, committee promotion decisions, protocol approval,
                                   analysis approval, examination outcomes — always a resource-scoped
                                   human relationship, never a generic role, never AI, never platform admin
Administrative Approval         — committee/editor/examiner assignment, policy configuration — a distinct
                                   capability from the academic decision itself (§6's repeated pattern)
Verification Authority          — see §10 below; currently near-universally NONE except Publication's own
                                   pipeline for its own manuscripts
Configuration Authority         — policy/bylaws management (promotion.policy.manage, etc.) — OWNER/
                                   ORGANIZATION_ADMIN or platform admin, since this is platform/org
                                   configuration, not academic content
Platform Operation              — tenant provisioning, billing, system config — control plane, see
                                   the Cross-Domain Requirements doc's Control Plane / Data Plane section
```

## 10. Verification Authorities (consolidated)

```
Identifier/Affiliation verification (Academic Identity):  NONE — no ORCID OAuth or equivalent exists
Publication provenance for pipeline-linked assets:         Publication Intelligence's own editorial
                                                             state machine (PublicationSubmission) —
                                                             the only real, live verification authority
                                                             anywhere in this codebase today
Self-declared publication claims:                          Not verified by anyone — honestly labeled
                                                             SELF_DECLARED (Academic Identity §3.7)
External bibliometric/citation data:                        NONE — no Scopus/WoS/Google Scholar/Crossref
                                                             integration exists
```

---

## 11. Sensitive Data Classification Taxonomy

```
PUBLIC                  — explicitly server-projected for unauthenticated access
INSTITUTIONAL_METADATA  — administrative/workflow metadata: status, counts, ids, dates, assignment
                           existence — visible to org-level oversight without exposing content
PRIVATE_ACADEMIC        — the actual scholarly/administrative content: manuscript body, dataset
                           de-identified preview, evaluation snapshot, protocol content
CONFIDENTIAL_ACADEMIC   — content requiring a specific resource relationship even among people who
                           can see PRIVATE_ACADEMIC content for the same resource: confidential
                           peer-review comments, examiner deliberation notes, committee decision notes
HIGHLY_SENSITIVE_RESEARCH — raw participant data, direct/quasi-identifiers, sensitive dataset columns
SYSTEM_OPERATIONAL      — platform configuration, billing, tenant provisioning — control plane only
```

Every domain's "Administrative Metadata vs. Private Academic Content" distinction (Promotion §1, Academic Identity throughout, Peer Review's aggregate-vs-content split, Research Data's metadata-vs-sensitive-vs-raw split) maps onto this same six-tier taxonomy — this section formalizes what was independently reinvented per-domain into one shared vocabulary.
