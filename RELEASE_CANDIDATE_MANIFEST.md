# Release Candidate Manifest

- Candidate identity: the Git commit containing this manifest (`git rev-parse HEAD` is authoritative).
- Scope: reviewed Phase 01–13 source, migrations, tests, configuration, lockfiles, deployment definitions, and operational documentation.
- Database authority: Alembic; single head `c5d6e7f8a9b0` with 18 revisions. The additional release migration closes the discovered two-table ORM/migration drift.
- Excluded state: local databases, runtime storage, backups, logs, caches, build output, Playwright reports, test results, coverage, environment secrets, and virtual environments.
- Required clean-clone gates: locked dependency installation, fresh migration, 68/68/68 schema alignment, full backend regression, frontend lint/type/build, Playwright/axe/repeated critical runs, production fail-closed checks, dependency and secret scans, and representative isolated recovery.
- Required production-like gate: isolated PostgreSQL migration, critical tests, query-plan review, and concurrency verification.
- Traffic gate: external monitoring or an explicitly approved operational equivalent must be configured and test-alert evidence recorded.
- Commercial boundary: technical pilot readiness is separate from paid launch; paid collection stays disabled until a live provider and commercial approvals exist.

The repository commit is necessary but not sufficient for Phase 14 authorization. The final gate decision must reflect the executed environment checks without substituting documentation for missing PostgreSQL or monitoring evidence.
