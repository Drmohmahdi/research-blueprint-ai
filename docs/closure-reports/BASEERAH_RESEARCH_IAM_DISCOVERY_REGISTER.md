# 🔬 Baseerah Research IAM & Institutional Access Requirements Discovery Register

**Source:** Research Design Intelligence closure — actual implementation analysis  
**Date:** 2026-08-25  
**Status:** COMPLETE (ready for Global IAM architecture phase)

---

## 1. Personas Register

| Persona | Workflow | Required future role | Notes |
|---------|----------|---------------------|-------|
| Researcher | Create/edit own research project, define design, submit protocol | `RESEARCHER` | Project owner by default; existing `User.role = "Researcher"` |
| Principal Investigator | Lead a project, manage team, approve protocol, handoff to Data | `PI` | Added as `ResearchProjectMember.relationship = "PI"`; project-scoped |
| Co-Researcher | Contribute to assigned project, edit design sections, view team | `CO_RESEARCHER` | Project-scoped; no cross-project authority |
| Research Assistant | Edit only assigned sections (measurement, literature, etc.) | `RESEARCH_ASSISTANT` | Restricted by `assigned_sections` JSON column |
| Methodology Reviewer | Review exact protocol version, submit findings, recommend | `METHODOLOGY_REVIEWER` | Project-scoped; cannot edit researcher content |
| Data Analyst | View analysis alignment sections, contribute analysis plan | `DATA_ANALYST` | Future: may need dataset access scope |
| Research Administrator | Manage institutional research portfolio, see aggregate stats | `ORGANIZATION_ADMIN` | Existing `OrganizationMembership.role` |
| Research Office Viewer | View institutional research operations aggregate view | `RESEARCH_OFFICE_VIEWER` | Discovered need; not yet implemented |
| Institutional Executive Viewer | View high-level research KPIs across org | `EXECUTIVE_VIEWER` | Future: no entity hierarchy yet |
| Thesis Supervisor | Supervise thesis; must NOT gain automatic research edit access | `THESIS_SUPERVISOR` | Discovered boundary; documented in cross-domain |

---

## 2. Account Context Register

| Persona | Context | Notes |
|---------|---------|-------|
| Researcher | `INDIVIDUAL` | Personal workspace auto-provisioned |
| Principal Investigator | `ORGANIZATION_MEMBER` | Scoped to one organization |
| Co-Researcher | `ORGANIZATION_MEMBER` | Same org as project |
| Research Assistant | `ORGANIZATION_MEMBER` | Same org |
| Methodology Reviewer | `ORGANIZATION_MEMBER` or `EXTERNAL_GUEST` | Future: external reviewer via magic link (like peer review) |
| Data Analyst | `ORGANIZATION_MEMBER` | Same org |
| Research Administrator | `ORGANIZATION_MEMBER` | Org-bound |
| Research Office Viewer | `ORGANIZATION_MEMBER` | Org-bound |
| Thesis Supervisor | `ORGANIZATION_MEMBER` | Org-bound; separate domain |

---

## 3. Scope Register

| Scope | Description | Current implementation |
|-------|-------------|----------------------|
| `OWN_PROJECT` | Access to own project (owner) | `ResearchProject.userId == context.user.id` |
| `ASSIGNED_PROJECT` | Access to project where user is active member | `ResearchProjectMember` with `status=ACTIVE` |
| `PROJECT` | Access to a specific project with membership | Same as above |
| `ASSIGNED_PROTOCOL` | Access to a specific protocol version | Protocol belongs to project; member of project |
| `ASSIGNED_SECTION` | Access to specific design sections only | `ResearchProjectMember.assigned_sections` JSON |
| `ORGANIZATION_AGGREGATE` | Aggregate research KPIs for an org | `ResearchDesignState.organization_id` scoped |
| `PROGRAM` | Future: sub-org program scope | Entity not created; deferred |
| `DEPARTMENT` | Future: department scope | Entity not created; deferred |
| `COLLEGE` | Future: college scope | Entity not created; deferred |

---

## 4. Permission Requirements Register

**Discovered permissions (from actual endpoint enforcement):**

| Permission | Description | Enforced in |
|-----------|-------------|-------------|
| `research.project.view` | View project and its design state | `project_access()` |
| `research.project.create` | Create new project | `projects.py:create_project` |
| `research.project.edit` | Edit project metadata and design | `require_project_edit()` / `can_edit_section()` |
| `research.project.archive` | Delete/archive project | `projects.py:delete_project` |
| `research.team.manage` | Add/remove team members | `add_team_member`/`remove_team_member` |
| `research.member.assign` | Assign specific sections to assistant | `add_project_member` with `assigned_sections` |
| `research.problem.edit` | Edit problem statement section | `can_edit_section(section="problem")` |
| `research.objective.edit` | Edit objectives section | `can_edit_section(section="objectives")` |
| `research.question.edit` | Edit research questions | `can_edit_section(section="question_ext")` |
| `research.hypothesis.edit` | Edit hypotheses | `can_edit_section(section="hypothesis_ext")` |
| `research.variable.edit` | Edit variable registry | `can_edit_section(section="variable_registry")` |
| `research.instrument.manage` | Manage measurement instruments | `can_edit_section(section="measurement")` |
| `research.protocol.create` | Create protocol version | `create_protocol_endpoint` → `_require_edit` |
| `research.protocol.submit` | Submit protocol for review | `submit_protocol` → `_require_edit` |
| `research.protocol.review` | Submit methodology review | `submit_review` → METHODOLOGY_REVIEWER check |
| `research.protocol.recommend` | Recommend protocol readiness | `submit_review` → `recommendation` |
| `research.protocol.approve` | Approve protocol (PI/owner only) | `approve_protocol` → owner/PI check |
| `research.coherence.view` | View coherence analysis | `coherence_view` → `project_access()` |
| `research.readiness.view` | View readiness analysis | `readiness_view` → `project_access()` |
| `research.handoff.create` | Create academic handoff to Data | `require_project_write` |
| `research.private_note.view` | View private research notes | NOT IMPLEMENTED (no private notes model) |
| `research.analytics.view_aggregate` | View institutional aggregate | `research_office_operations` → `OWNER`/`ORGANIZATION_ADMIN` |

---

## 5. Sensitive Permission Requirements

| Permission | Requires explicit grant | Discovered in |
|-----------|----------------------|---------------|
| `research.protocol.view_confidential` | View full protocol snapshot | `get_protocol` → `project_access()` |
| `research.private_note.view` | View private research notes | Not implemented; future |
| `data.dataset.view_sensitive` | View sensitive dataset content | Not in Research domain; Data domain |
| `methodology_review.confidential.view` | View confidential methodology review findings | `list_reviews` → reviewer/owner/PI check |
| `research.institutional.executive_view` | View executive-level stats | Not implemented; future |

---

## 6. Resource Relationship Register

| Relationship | Description | Implementation |
|-------------|-------------|----------------|
| `owner_of` | Owns the project | `ResearchProject.userId` |
| `pi_of` | Principal investigator of project | `ResearchProjectMember.relationship = "PI"` |
| `member_of` | Active member of project (any role) | `ResearchProjectMember.status = "ACTIVE"` |
| `contributor_to` | Contributes to project sections | `CO_RESEARCHER`, `DATA_ANALYST` |
| `assistant_on` | Assists on assigned sections | `RESEARCH_ASSISTANT` + `assigned_sections` |
| `methodology_reviewer_of` | Reviews exact protocol version | `METHODOLOGY_REVIEWER` + `MethodologyReview` |
| `supervisor_of` | Supervises thesis (NOT research) | `ThesisSupervisionAssignment` |

---

## 7. Sensitive Boundaries Register

| Boundary | Protection | Policy |
|----------|-----------|--------|
| Private research notes | Not implemented | Must NOT be visible to PI/admin by default |
| Unpublished protocol | `project_access()` + protocol status | Only members + owner can view |
| Confidential methodology review | `list_reviews` visibility check | Findings visible to reviewer, owner, PI only |
| Embargoed research output | Not implemented | Future: publication embargo support |
| Participant-sensitive metadata | Not in Research domain | Data domain responsibility |
| Sensitive dataset references | `ResearchVariableMapping` scoped to project | Variables are project-scoped |
| AI context authorization | `context_builder.py` | Only authorized project context is provided |

---

## 8. Approval Authorities Register

| Operation | Initiates | Reviews | Recommends | Approves | Scope |
|-----------|-----------|---------|------------|----------|-------|
| Project creation | Researcher | — | — | Auto (entitlement check) | Own organization |
| Protocol submission | Editor (owner/PI/co-researcher) | — | — | Auto | Project |
| Methodology review | Methodology reviewer | — | — | Reviewer submits | Protocol version |
| Protocol approval | — | — | Methodology reviewer | PI / Owner | Project |
| Research→Data handoff | Editor | — | — | Owner + analysis approval | Project |
| Collaboration assignment | — | — | — | Owner / PI | Project |
| Aggregate visibility | — | — | — | Organization admin | Organization |

---

## 9. Delegation Requirements

| Scenario | Need | Status |
|----------|------|--------|
| PI temporary delegation to co-researcher | Not yet required | DEFERRED |
| Methodology review reassignment | Possible today (remove/add member) | MANUAL |
| Research Office acting authority | Not yet required | DEFERRED |

---

## 10. Institutional Hierarchy Requirements

| Level | Entity exists? | Notes |
|-------|---------------|-------|
| Organization | `Organization` model | Exists with `parent_id` for hierarchy |
| Program | Not created | DEFERRED |
| Department | Not created | DEFERRED |
| College | Not created | DEFERRED |
| University | `Organization.hierarchy_level = 0` | Exists in concept |
| Research Center | Not created | DEFERRED |

---

## 11. Cross-Domain Permission Dependencies

| Rule | Source | Target | Status |
|------|--------|--------|--------|
| `research.project.view` does NOT imply `data.dataset.view_sensitive` | Research | Data | VERIFIED |
| `thesis.supervisor` does NOT imply `research.project.edit` | Thesis | Research | VERIFIED |
| `research.project.member` does NOT imply `publication.submit` | Research | Publication | VERIFIED |
| `research.admin` does NOT imply `private_note.view` | Research | — | DEFERRED (no private notes) |
| `research.project.view` does NOT imply `methodology_review.confidential.view` | Research | Research | VERIFIED |
| `research.admin` does NOT imply `dataset.view_raw` | Research | Data | VERIFIED |
| `research.handoff.create` requires project edit | Research | Research | VERIFIED |

---

## 12. Research Domain IAM Readiness

**Status:** COMPLETE

The Research domain has been analyzed from real implementation and all IAM requirements are documented. The tables above provide a complete specification for the forthcoming unified Baseerah Identity, Roles & Institutional Access Architecture.

## 13. Global IAM Implementation

**Status:** DEFERRED TO 🔐 Baseerah Identity, Roles & Institutional Access Architecture

The project-scoped collaboration model (`ResearchProjectMember`) is the minimal viable relationship system for the current cycle. A global IAM, role catalog, permission engine, and organization hierarchy are deferred to the dedicated architecture phase.