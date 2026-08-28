# 📊 Baseerah Research Data IAM & Institutional Access Requirements Discovery Register

**Source:** Research Data & Analysis closure — actual implementation analysis  
**Date:** 2026-08-25  
**Status:** COMPLETE (ready for Global IAM architecture phase)

---

## 1. Personas Register

| Persona | Actual workflow | Required future role | Notes |
|---------|-----------------|----------------------|-------|
| Researcher | Import dataset, view own data, run analysis, review own results | `RESEARCHER` | Dataset owner has full access to that dataset |
| Principal Investigator | Lead project, import data, approve cleaning, review analyses | `PI` (project relationship) | Project-scoped; not raw-data authority by itself |
| Co-Researcher | View permitted project data, de-identified preview, run analysis | `CO_RESEARCHER` (project relationship) | No sensitive/raw access without grant |
| Research Assistant | Data entry, metadata, quality tagging on assigned sections | `RESEARCH_ASSISTANT` (project relationship) | No raw download by default |
| Data Analyst | Clean, transform, run analysis, create results | `DATA_ANALYST` (project relationship or grant) | Never approves analysis |
| Statistician / Analysis Reviewer | Review analysis plans, check assumptions, recommend approval | `REVIEW_ANALYSIS` grant or project role | Human authority over approval |
| Data Steward | Classification, access grants, sensitive export governance | `CLASSIFY` + `access.manage` capability | No global role; dataset-scoped |
| Research Office Viewer | See aggregate institutional data operations | `ORGANIZATION_ADMIN` + aggregate scope | Metadata only |
| Institutional Data Viewer | See institution-wide aggregates | `INSTITUTIONAL_DATA_VIEWER` (documented need only) | Not implemented as a role |
| Thesis Supervisor | See analysis status/readiness/provenance | `THESIS_SUPERVISOR` | Never raw/sensitive access automatically |

---

## 2. Account Contexts Register

| Persona | Context |
|---------|---------|
| Researcher | `INDIVIDUAL` (dataset owner) or `ORGANIZATION_MEMBER` |
| PI / Co-Researcher / Assistant / Analyst | `ORGANIZATION_MEMBER` |
| Statistician / Analysis Reviewer | `ORGANIZATION_MEMBER` (or external guest — future) |
| Data Steward | `ORGANIZATION_MEMBER` |
| Research Office Viewer | `ORGANIZATION_MEMBER` |
| Thesis Supervisor | `ORGANIZATION_MEMBER` |
| Institutional Data Viewer | `ORGANIZATION_MEMBER` (future) |

---

## 3. Scope Register

| Scope | Description | Implementation |
|-------|-------------|----------------|
| `OWN_DATASET` | Dataset where user is owner | `ResearchDataset.owner_id` → full capabilities |
| `ASSIGNED_DATASET` | Dataset where user holds a grant | `DatasetAccessGrant` (capability-scoped) |
| `PROJECT_DATASETS` | Datasets of a project the user is a member of | Project relationship → base capabilities |
| `ASSIGNED_ANALYSIS` | Analyses the user may view/review | `VIEW_RESULTS` / `REVIEW_ANALYSIS` capabilities |
| `ASSIGNED_VARIABLES` | Variable dictionary for permitted datasets | `VIEW_DICTIONARY` capability |
| `ORGANIZATION_AGGREGATE` | Institutional data operations aggregates | `ORGANIZATION_ADMIN`/`OWNER` + aggregate endpoint |
| `PROGRAM`/`DEPARTMENT`/`COLLEGE`/`RESEARCH_CENTER` | Future scopes | No entities created; documented as future |

---

## 4. Permission Register

| Permission | Description | Enforced in |
|------------|-------------|-------------|
| `data.dataset.view_metadata` | See name/version/rows/columns/status | All org members |
| `data.dataset.preview_deidentified` | Preview de-identified rows | Project members (base) |
| `data.dataset.view_sensitive` | Preview sensitive/raw values | Owner, global admin, or grant |
| `data.dataset.download` | Download raw dataset | Owner, global admin, or `DOWNLOAD_RAW` grant |
| `data.dataset.upload` | Import dataset | Project owner/PI |
| `data.dataset.classify` | Set sensitivity + classify variables | Owner, global admin, or `CLASSIFY` grant |
| `data.dataset.archive` | Archive dataset | Not implemented; future |
| `data.variable.view` | View data dictionary | Project members (base) |
| `data.variable.edit` | Edit variable metadata | `CLASSIFY` capability |
| `data.variable.classify` | Set identifier/sensitive flags | `CLASSIFY` capability |
| `data.quality.view` | View quality issues | Project members (base) |
| `data.quality.resolve` | Resolve quality issues | `CLEAN` capability |
| `data.cleaning.create` | Create a cleaned version | `CLEAN` capability |
| `data.version.create` | Create a derived version | `CLEAN` / `CREATE_VERSION` |
| `data.analysis.plan` | Get statistical decision | Any authenticated user |
| `data.analysis.run` | Run analysis | `RUN_ANALYSIS` capability |
| `data.analysis.view` | View results | `VIEW_RESULTS` capability |
| `data.analysis.review` | Review an analysis | `REVIEW_ANALYSIS` capability |
| `data.analysis.approve` | Approve an analysis | Owner/global admin, or `APPROVE_ANALYSIS` grant |
| `data.result.export` | Export aggregate/approved results | `VIEW_RESULTS` |
| `data.dataset.export_deidentified` | Export de-identified dataset | `PREVIEW_DEIDENTIFIED` |
| `data.dataset.export_sensitive` | Export sensitive dataset | `EXPORT_SENSITIVE` / `DOWNLOAD_RAW` |
| `data.access.manage` | Grant/revoke dataset capabilities | `CLASSIFY` capability |
| `data.analytics.view_aggregate` | View institutional aggregate | `ORGANIZATION_ADMIN`/`OWNER` |

---

## 5. Sensitive Permissions Register

| Permission | Requires explicit grant | Boundary |
|------------|------------------------|----------|
| `data.dataset.view_sensitive` | Owner / global admin / `VIEW_SENSITIVE` grant | Sensitive column values |
| `data.dataset.download_raw` | Owner / global admin / `DOWNLOAD_RAW` grant | Full raw dataset |
| `data.dataset.export_sensitive` | Owner / global admin / `EXPORT_SENSITIVE` grant | Sensitive CSV export |
| `data.identifier.view` | Owner / global admin / `VIEW_SENSITIVE` | Identifier columns |
| `data.access.manage` | `CLASSIFY` capability | Grant/revoke |
| `data.analysis.approve` | Owner / global admin / `APPROVE_ANALYSIS` | Analysis approval |

---

## 6. Resource Relationships Register

| Relationship | Implementation |
|--------------|----------------|
| `owner_of_dataset` | `ResearchDataset.owner_id` |
| `member_of_project` | `ResearchProjectMember` |
| `data_analyst_of` | `ResearchProjectMember.relationship = "DATA_ANALYST"` |
| `statistician_of` | `REVIEW_ANALYSIS` grant (project relationship or grant) |
| `reviewer_of_analysis` | `REVIEW_ANALYSIS` capability |
| `steward_of_dataset` | `CLASSIFY` capability (owner/grant) |
| `granted_access_to` | `DatasetAccessGrant` |
| `supervisor_of_thesis` | Thesis domain (no research/data authority) |

---

## 7. Sensitive Boundaries Register

| Boundary | Protection |
|----------|------------|
| Direct identifiers | Excluded from de-identified preview/export |
| Quasi-identifiers | Classified via `identifier` flag |
| Sensitive variables | Excluded unless `VIEW_SENSITIVE` |
| Raw participant records | Only with `DOWNLOAD_RAW` |
| De-identified preview | Project members |
| Dataset downloads | Owner / `DOWNLOAD_RAW` |
| Exported datasets | De-identified or sensitive per capability |
| Unapproved statistical results | `VIEW_RESULTS` required |
| Confidential analysis review | Reviewer-only visibility |
| AI data context | Aggregates/schema only; never participant rows |

---

## 8. Approval Authorities Register

| Operation | Initiates | Edits | Reviews | Approves | Export/Grant |
|-----------|-----------|-------|---------|----------|--------------|
| Dataset upload | Researcher/PI | — | — | Auto (import) | — |
| Sensitivity classification | Owner/PI | Owner/Steward | — | Owner/Steward | — |
| Sensitive access grant | Owner | Owner/Steward | — | Owner/Steward | — |
| Cleaning | Analyst/PI | — | — | Auto (non-destructive version) | — |
| Version finalization | Analyst | — | — | Auto | — |
| Analysis execution | Analyst | — | — | — | — |
| Analysis review | — | — | Reviewer | Reviewer recommends | — |
| Analysis approval | — | — | Reviewer | Owner/Approve-capable | — |
| Sensitive export | User | — | — | Capability check | Audit |
| Archive/delete | Owner | — | — | Owner | Audit |

---

## 9. Delegation Requirements

| Scenario | Need | Status |
|----------|------|--------|
| Temporary Data Steward delegation | Not required yet | DEFERRED |
| Analysis reviewer reassignment | Possible via grant revoke/re-grant | MANUAL |
| PI delegation | Not required | DEFERRED |
| Sensitive-access approval delegation | Not required | DEFERRED |

---

## 10. Institutional Hierarchy Requirements

| Level | Entity exists? | Notes |
|-------|---------------|-------|
| Organization | Yes | Aggregate scope |
| Program / Department / College / Research Center | No | Documented as future |

---

## 11. Cross-Domain Permission Dependencies

| Rule | Verified |
|------|----------|
| `research.project.view` does NOT imply `data.dataset.view_sensitive` | TESTED |
| `research.project.member` does NOT imply `data.dataset.download` | TESTED |
| `thesis.supervisor` does NOT imply `data.dataset.view_raw` | TESTED |
| `organization.admin` does NOT imply `data.dataset.view_sensitive` | TESTED |
| `data.analysis.run` does NOT imply `data.analysis.approve` | TESTED |
| `data.dataset.view_metadata` does NOT imply `data.dataset.preview` | TESTED |
| `data.dataset.preview_deidentified` does NOT imply `data.dataset.download` | TESTED |
| `data.analysis.view` does NOT imply `data.dataset.view_raw` | TESTED |
| `publication.author` does NOT imply `data.dataset.access` | BY DESIGN |
| `platform.admin` does NOT imply `data.dataset.view_sensitive` | TESTED (FD-1) |
| `platform.admin` does NOT imply `data.dataset.download_raw` | TESTED (FD-1) |
| `platform.admin` does NOT imply `data.dataset.export_sensitive` | TESTED (FD-1) |

---

## 12. Data Access Matrix (from implementation + policy)

| Capability | Researcher (owner) | PI | Co-Researcher | Data Analyst | Statistician/Reviewer | Steward | Research Admin |
|------------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| View metadata | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View dictionary | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| De-identified preview | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Sensitive preview | ✓ | grant | grant | grant | grant | grant | — |
| Download raw | ✓ | grant | grant | grant | grant | grant | — |
| Run analysis | ✓ | ✓ | ✓ | ✓ | grant | grant | — |
| Clean / transform | ✓ | ✓ | grant | ✓ | — | ✓ | — |
| Review analysis | ✓ | ✓ | — | — | ✓ | — | — |
| Approve analysis | ✓ | grant | — | — | grant | — | — |
| Export sensitive | ✓ | grant | grant | grant | grant | grant | — |
| Aggregate operations | — | — | — | — | — | — | ✓ |

✓ = by default from relationship; "grant" = requires `DatasetAccessGrant`; — = no access.

## 13. Sensitive Access Matrix

| Data surface | Metadata-only user | De-identified user | Sensitive grant | Raw grant | Admin |
|--------------|:--:|:--:|:--:|:--:|:--:|
| Dataset name/version/rows | ✓ | ✓ | ✓ | ✓ | ✓ |
| Data dictionary (flags) | ✓ | ✓ | ✓ | ✓ | ✓ |
| De-identified preview | — | ✓ | ✓ | ✓ | — |
| Sensitive columns | — | — | ✓ | ✓ | — |
| Raw rows | — | — | — | ✓ | — |
| CSV export (de-identified) | — | ✓ | ✓ | ✓ | — |
| CSV export (sensitive) | — | — | — | ✓ | — |
| AI context | metadata/schema | schema + de-identified stats | + approved results | + approved results | schema |

---

## 14. Platform / Global Admin Semantics (Resolved)

**Discovery:** `is_global_admin` = `User.role` in `{SYSTEMADMIN, ADMIN, SUPERADMIN, DEVELOPER}` — these are **platform/SaaS operator** roles, not academic institutional roles.

**Boundary enforced in code** (`data_authz.resolve_capabilities`):

```
platform.admin
DOES NOT IMPLY data.dataset.view_sensitive
DOES NOT IMPLY data.dataset.download_raw
DOES NOT IMPLY data.dataset.export_sensitive
DOES NOT IMPLY data.analysis.run
DOES NOT IMPLY data.dataset.clean
```

Platform operators receive `VIEW_METADATA` only (operational diagnostics) plus any explicit `DatasetAccessGrant`. A prior defect where `is_global_admin` inherited full sensitive/raw access was **fixed and tested** (see Findings FD-1). Platform operators also cannot import datasets into academic projects (FD-2).

## 15. Dataset Owner Semantics (Resolved)

**Decision (current product policy, documented and auditable):** Dataset ownership implies full access to *that dataset* for its owner — including sensitive/raw/download/classify. Classification does **not** override ownership for the owner in the current policy. This is explicitly recorded here; a future institutional policy may override ownership via classification, and the capability resolver is the single place such a change would be made.

## 16. Support / Break-Glass Access

No support/break-glass mechanism exists in the codebase, and no operational use case is proven for this development cycle. Documented as **N/A / not implemented**; requirements (if needed later) must be: explicit, resource-scoped, capability-scoped, reason-required, audited, revocable, time-limited, with no implicit inheritance.

## 17. Research Data Domain IAM Readiness

**Status:** COMPLETE

## 18. Global IAM Implementation

**Status:** DEFERRED TO 🔐 Baseerah Identity, Roles & Institutional Access Architecture
