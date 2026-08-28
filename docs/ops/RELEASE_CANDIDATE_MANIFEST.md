# Release Candidate Manifest

- Candidate identity: the Git commit containing this manifest (`git rev-parse HEAD` is authoritative).
- Scope: reviewed Phase 01–13 source, migrations, tests, configuration, lockfiles, deployment definitions, and operational documentation.
- Database authority: Alembic; single head `d6e7f8a9b0c1` with 19 revisions. The release migrations close the discovered ORM/migration drift and enforce organization-scoped AI-run idempotency.
- Excluded state: local databases, runtime storage, backups, logs, caches, build output, Playwright reports, test results, coverage, environment secrets, and virtual environments.
- Required clean-clone gates: locked dependency installation, fresh migration, 68/68/68 schema alignment, full backend regression, frontend lint/type/build, Playwright/axe/repeated critical runs, production fail-closed checks, dependency and secret scans, and representative isolated recovery.
- Required production-like gate: isolated PostgreSQL migration, critical tests, query-plan review, and concurrency verification.
- Traffic gate: external monitoring or an explicitly approved operational equivalent must be configured and test-alert evidence recorded.
- Commercial boundary: technical pilot readiness is separate from paid launch; paid collection stays disabled until a live provider and commercial approvals exist.

The repository commit is necessary but not sufficient for Phase 14 authorization. The final gate decision must reflect the executed environment checks without substituting documentation for missing PostgreSQL or monitoring evidence.

## Final blocker-closure evidence

- Backend SQLite baseline: 250 passed; PostgreSQL-only concurrency tests are separately gated.
- PostgreSQL: 16.15 isolated environment; fresh migration and 68/68/68 alignment passed; expanded regression 159/159 passed; four independent-connection concurrency scenarios passed.
- Alembic: 19 revisions, one head, `d6e7f8a9b0c1`.
- Recovery: custom-format `pg_dump` and isolated `pg_restore` passed with representative records.
- Frontend baseline: Playwright 5/5, axe accessibility passed, critical browser scenarios 4/4 repeated three times, Oxlint/TypeScript/production build passed.
- Dependency audits: npm reported zero vulnerabilities; `pip-audit 2.10.1 --no-deps -r backend/requirements.txt` reported no known vulnerabilities in the fully pinned input set.
- Provider boundary: live AI, live payment, email, S3, and malware scanning remain unconfigured/disabled; verified local storage remains the declared storage mode.
- Monitoring: Uptime Kuma is documented, but off-host status, `/readiness`, an approved real alert destination, delivered failure/recovery alerts, and backup-staleness alert evidence remain unverified. This is an open release blocker, not a passed gate.

The commit containing this section is the candidate identity; no SHA embedded inside the manifest supersedes `git rev-parse HEAD`.
