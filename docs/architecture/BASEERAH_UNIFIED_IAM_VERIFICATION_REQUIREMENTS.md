# Baseerah Unified IAM Verification Requirements

Future test requirements for the eventual Unified IAM implementation phase — **not implemented here**. This document exists so that phase does not need to rediscover what "correct" looks like; every requirement below is derived from a pattern already proven, at least once, somewhere in this codebase's existing domain test suites.

---

## 1. Required Future Test Matrix (by category)

```
Cross-tenant isolation
  — every resource-fetch endpoint: a user in org B gets 404 (not 403) for org A's resource
  — proven pattern: test_cross_tenant_isolation_promotions, test_search_cross_tenant_zero_leak

Same-tenant horizontal IDOR
  — a user with a resource-scoped relationship on resource X cannot act on resource Y in the
    same org that they hold no relationship to
  — proven pattern: test_committee_member_cannot_review_unassigned_same_tenant_application

Vertical escalation (role spoofing)
  — a lower-privilege org role cannot self-elevate by manipulating request payloads
  — proven pattern: mass-assignment field audits (Promotion §8's PromotionApplicationCreate
    schema check that no client-settable field bypasses server computation)

Scope escalation
  — ORGANIZATION_AGGREGATE-scoped callers cannot obtain OWN_RESOURCE/ASSIGNED_RESOURCE content
    through the same endpoint or an adjacent one (Search, AI, Reports)
  — proven pattern: Promotion §7's Search/AI duplicated-pattern discovery

Assignment / revocation
  — assigning a relationship grants exactly the assignee the resource authority, never the
    assigner (unless the assigner is separately also the assignee)
  — revocation is immediate: same request cycle, no cache/staleness window, removes GET,
    write, Search visibility, and AI context access together
  — proven pattern: test_committee_assignment_revocation_removes_authority,
    test_revoked_committee_member_loses_search_access, test_revoked_committee_member_loses_ai_context

Sensitive-grant expiry / duplicate-grant races
  — proven pattern: test_pg_duplicate_committee_assignment_race_no_duplicate_row (real
    PostgreSQL 16, concurrent connections, unique-constraint-backed)

Platform-admin bypass (must be BLOCKED for private/confidential content in every domain)
  — proven pattern: test_platform_admin_cannot_view_private_promotion_application,
    test_platform_admin_without_case_editor_role_is_blocked_from_editorial_decision

Organization-admin bypass (must be BLOCKED for private/confidential content — see Conflict
Report Finding 1 for the two domains that do not yet pass this)
  — proven pattern: test_organization_admin_retains_read_only_oversight_without_assignment,
    test_organization_admin_without_case_editor_role_is_blocked

Public/private projection
  — the public projection must be a genuinely separate, server-constructed response object,
    never the private object with fields hidden client-side
  — proven pattern: Academic Identity's PublicProfileResponse/PublicScholarlyAssetResponse
    vs. their authenticated counterparts, network-payload field-absence assertions

External guest / magic-link token
  — hash-at-rest (never raw), expiry enforced, revocation enforced, single active token per
    assignment, no cross-resource leak via the token
  — proven pattern: Peer Review's ExternalReviewerToken tests; Thesis's ThesisExaminerToken
    (validate_examiner_token) is structurally identical but currently has no dedicated test
    file discovered this round — a gap for the same future Thesis closure round noted in the
    Conflict Report

AI context authorization
  — AI-summarized content must never exceed what the calling user could see through the
    ordinary API for the same resource
  — proven pattern: test_promotion_ai_privacy, test_rt_human_authority_promotion, and this
    round's confirmation that Academic Identity has zero AI integration to test yet (absence
    is a valid, verified state — not a gap to fabricate coverage for)

Search discoverability
  — must never exceed the searcher's effective access, including through result counts and
    snippets, not just the visible result list
  — proven pattern: this round's test_search_asset_hides_other_users_unpublished_work_same_tenant
    (asserts domain_counts and full result-list emptiness, not just top-level total)

Reports / Export
  — no domain in this codebase currently has a distinct bulk-export feature broader than its
    own resource endpoints; when one is built, it must be tested against the same "≤ effective
    access" rule as Search and AI — recorded as a Future Requirement, not yet a gap, since
    nothing exists yet to under-test

Notification privacy
  — a notification payload must not carry content the recipient is not independently
    authorized to see (no domain currently has a documented violation of this; recorded as a
    standing requirement to re-verify whenever a new notification-triggering event is added)

Audit
  — audit *metadata* (who did what, when) may be visible more broadly than audit *content*
    (the sensitive payload of the action itself); no domain currently exposes a generic-admin
    audit-content read path — recorded as a standing requirement, not a discovered gap
```

---

## 2. Future PostgreSQL Concurrency Requirements

Only where a future Unified IAM entity introduces a genuinely new race-prone constraint — mirroring the exact reasoning already applied domain-by-domain in this codebase (e.g., Academic Identity's decision *not* to add a uniqueness constraint on `identifier_value` while nothing is verified yet, §9 of that domain's register):

```
One active OrganizationMembership per (user, organization) pair — already enforced today;
    reverify if the future Membership model changes shape

One active resource-relationship row per (user, resource) pair, for every relationship type
    that currently has this constraint (PromotionCommitteeAssignment, ThesisCommitteeMember
    seat uniqueness) — reverify under real concurrent PostgreSQL connections whenever a new
    relationship type is introduced, following the exact test pattern already proven in
    test_pg_duplicate_committee_assignment_race_no_duplicate_row

Grant/revoke race for any future SensitiveGrant entity (§Cross-Domain Requirements) — no such
    entity exists yet; this is a Future Requirement, not a current gap

Role-change race (a user's OrganizationMembership.role changing mid-request) — not currently
    tested anywhere in this codebase; recorded as a Future Requirement since no domain's
    current authorization model reads role more than once per request (no race window exists
    today to test), but the future Entitlement Resolver (Cross-Domain Requirements §Future
    Data-Model) must not introduce one
```

---

## 3. Explainability & Auditability Requirements (for the future resolver, not implemented today)

Every sensitive `ALLOW`/`DENY` decision the future Unified IAM resolver produces must be traceable to exactly one of: an explicit resource relationship, a genuine resource ownership match, an active sensitive grant, or an institutional policy — never to a bare role check alone for anything above `INSTITUTIONAL_METADATA` sensitivity (§Canonical Vocabulary §11). This requirement is written *because* Finding 1 of the Conflict Report shows what happens when it is violated: two domains currently cannot explain a `DENY` for a resource-scoped peer domain's equivalent action, because their `ALLOW` is a bare role check with no relationship to point to.

---

## 4. Performance Requirements (for the future resolver)

```
Avoid N+1 permission queries — proven anti-pattern and fix this round: ProfileProvider's
    join eager-load (joinedload(UnifiedAcademicProfile.user)) added specifically to avoid a
    per-result-row lazy query; the future resolver must batch relationship resolution the
    same way when checking authority across a result set, not per-row

Do not cache revocation-sensitive grants beyond the current request — proven requirement:
    every revocation test in this codebase (Promotion, and by the same pattern any future
    domain) asserts same-request-cycle effect, meaning any future caching layer must either
    exclude sensitive relationship lookups or invalidate synchronously on revocation, not on
    a TTL
```

---

## 5. Frontend Capability Requirements (for future work, not implemented today)

```
Frontend must render available actions from server-derived capabilities, never re-derive
    authorization client-side — no domain in this codebase currently violates this (every
    "hide this button" decision found during this program's closures was paired with a real
    server-side check), but this is worth stating as a standing requirement since it is easy
    to violate by accident when a new UI surface is added

Avoid a global permission dump to the frontend — no domain currently sends more than the
    specific resource's own response shape (e.g., Promotion's is_committee_member field,
    Academic Identity's implicit self-vs-public projection); the future capability-projection
    mechanism should preserve this per-resource shape rather than introduce a global
    capabilities blob
```

---

## 6. Readiness Statement

This document defines *what future tests must prove*, not *what currently passes*. Every "proven pattern" cited above is a real, currently-passing test in this codebase, verifiable by name in its domain's own test file — nothing above was invented without a working precedent. The two open items with no proven precedent yet (Reports/Export, Thesis's external-token dedicated test coverage) are explicitly marked as such rather than presented as already covered.
