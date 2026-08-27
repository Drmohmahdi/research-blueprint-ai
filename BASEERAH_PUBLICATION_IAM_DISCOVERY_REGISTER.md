# 📖 Baseerah Publication IAM & Institutional Access Requirements Discovery Register

**Source:** Publication Intelligence & Journal Matching closure — actual implementation  
**Date:** 2026-08-26  
**Status:** COMPLETE (ready for Global IAM architecture phase)

---

## 1. Personas Register

| Persona | Actual workflow | Future role | Notes |
|---------|-----------------|-------------|-------|
| Researcher / Primary Author | Create manuscript, edit, confirm own authorship | `PUBLICATION_AUTHOR` | Technical owner of the manuscript |
| Co-Author | View manuscript, confirm own authorship, contribute | `CO_AUTHOR` (manuscript-scoped) | No authorship-management / submission authority |
| Corresponding Author | Authorize submissions, coordinate | `CORRESPONDING_AUTHOR` (manuscript-version-scoped) | Resource authority, not global role |
| Publication Coordinator | Prepare packages, track status (resource-scoped) | `publication_coordinator_of` | Documented; not a global role |
| Research Office Viewer | See aggregate publication operations | `ORGANIZATION_ADMIN` + aggregate scope | Metadata only |
| Institutional Publication Viewer | See institution-wide publication aggregates | `INSTITUTIONAL_PUBLICATION_VIEWER` (future) | Not implemented as role |
| Platform Operator | Manage tenants/subscriptions/config | `PLATFORM_OPERATOR` | Never manuscript content by default |

## 2. Account Contexts

`INDIVIDUAL` (author), `ORGANIZATION_MEMBER` (co-author/coordinator/office), `PLATFORM_OPERATOR` (system admin), `EXTERNAL_GUEST` (future; documented only).

## 3. Scope Register

`OWN_MANUSCRIPT`, `ASSIGNED_MANUSCRIPT` (co-author), `CORRESPONDING_AUTHOR_MANUSCRIPT`, `ASSIGNED_SUBMISSION`, `ORGANIZATION_AGGREGATE`. Program/Department/College: future only.

## 4. Permission Register

| Permission | Enforced in |
|------------|-------------|
| `publication.manuscript.view` | asset_or_404 (org-bound) |
| `publication.manuscript.edit` | require_write (owner/admin/platform) |
| `publication.manuscript.create_version` | add_version → require_write |
| `publication.authorship.view` | get_authorship (version access) |
| `publication.authorship.manage` | require_authorship_manage (owner/admin/platform) |
| `publication.authorship.confirm` | confirm_author (self or owner) |
| `publication.submission.prepare` | add_submission → require_write + readiness |
| `publication.submission.approve` | require_submission_authority (corresponding author) |
| `publication.submission.record` | set_submission_status → require_write |
| `publication.acceptance.record` | record_acceptance → require_write + ACCEPTED |
| `publication.journal.search` | journal endpoints (any authenticated) |
| `publication.journal.shortlist` | shortlist → require_write |
| `publication.analytics.view_aggregate` | organization/operations (admin) |

## 5. Sensitive Permissions

`publication.manuscript.view_unpublished`, `publication.authorship.manage`, `publication.submission.approve`, `publication.acceptance.record`, `publication.private_declaration.view`.

## 6. Resource Relationships

`author_of`, `coauthor_of`, `corresponding_author_of`, `contributor_to_manuscript`, `publication_coordinator_of`, `assigned_to_submission`.

## 7. Sensitive Boundaries

Unpublished manuscript body, authorship changes, private declarations, submission package, external submission identifiers, confidential revision material, confidential peer-review content, embargoed publication metadata.

## 8. Approval Authorities

| Operation | Initiates | Confirms | Approves | Records | Scope |
|-----------|-----------|----------|----------|---------|-------|
| Authorship finalization | Owner | Authors (self) | Owner | Owner | Manuscript version |
| Corresponding-author designation | Owner | — | Owner | Owner | Manuscript version |
| Final journal selection | Author(s) | — | Owner/Corresponding | Owner | Manuscript |
| Submission approval | Coordinator | — | Corresponding author | — | Submission |
| Submission recording | Coordinator | — | Corresponding | Coordinator | Submission |
| Acceptance recording | Coordinator | — | — | Owner/Admin | Submission |
| Identity handoff | — | — | — | Auto after PUBLISHED | Publication |
| Promotion candidate | — | — | — | Auto (candidate only) | Publication |

## 9. Delegation Requirements

Corresponding-author delegation and coordinator reassignment are documented as future needs; no delegation engine implemented.

## 10. Institutional Hierarchy Requirements

Organization is the only scope entity. Program/Department/College: future only.

## 11. Cross-Domain Permission Dependencies

```
research.project.edit  DOES NOT IMPLY publication.manuscript.edit        (BY DESIGN)
data.analysis.view     DOES NOT IMPLY publication.submission.approve     (BY DESIGN)
publication.manuscript.edit  DOES NOT IMPLY publication.authorship.manage (ENFORCED)
publication.authorship.manage DOES NOT IMPLY publication.submission.approve (ENFORCED)
publication.submission.approve DOES NOT IMPLY publication.acceptance.record (ENFORCED)
publication.acceptance.record DOES NOT IMPLY publication.publication.record (ENFORCED)
organization.admin     DOES NOT IMPLY publication.manuscript.view_unpublished (ENFORCED)
platform.admin         DOES NOT IMPLY publication.manuscript.view_unpublished (ENFORCED)
peer_review.reviewer   DOES NOT IMPLY publication.manuscript.edit         (BY DESIGN)
promotion.committee_member DOES NOT IMPLY publication.manuscript.edit     (BY DESIGN)
```

## 12. Publication Access Matrix

| Capability | Author (owner) | Co-Author | Corresponding | Coordinator | Org Admin | Platform |
|-----------:|:--:|:--:|:--:|:--:|:--:|:--:|
| View manuscript | ✓ | ✓ | ✓ | ✓ | ✓ | metadata only |
| Edit manuscript | ✓ | — | — | — | ✓ | — |
| Manage authorship | ✓ | — | — | — | ✓ | — |
| Confirm own authorship | ✓ | ✓ | ✓ | — | — | — |
| Approve submission | ✓ | — | ✓ | — | ✓ | — |
| Record submission status | ✓ | — | ✓ | ✓ | ✓ | — |
| Record acceptance | ✓ | — | — | — | ✓ | — |
| Aggregate operations | — | — | — | — | ✓ | ✓ |

## 13. Sensitive Access Matrix

| Data surface | Co-Author | Org Admin | Platform Admin |
|--------------|:--:|:--:|:--:|
| Unpublished manuscript body | ✓ (own) | ✓ | — |
| Authorship management | — | ✓ | — |
| Private declarations | own | ✓ | — |
| Submission package | ✓ (own) | ✓ | — |
| External submission ID | ✓ (own) | ✓ | — |
| Confidential review material | — | — | — |
| Institutional aggregate | — | ✓ | ✓ |

## 14. Publication Domain IAM Readiness

**Status:** COMPLETE

## 15. Global IAM Implementation

**Status:** DEFERRED TO 🔐 Baseerah Identity, Roles & Institutional Access Architecture
