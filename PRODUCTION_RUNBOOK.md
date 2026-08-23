# Baseerah Production Runbook

## Deployment prerequisites

- Node.js 24 and Python 3.14.
- PostgreSQL and an application database/user.
- HTTPS reverse proxy forwarding `Host`, `X-Forwarded-Proto`, and `X-Forwarded-For` only from trusted proxy addresses.
- `backend/.env` created from `backend/.env.production.example`; never commit the populated file.

The service refuses to start in `ENVIRONMENT=production` when SQLite, HTTP `APP_URL`, wildcard CORS/hosts, insecure cookies, or automatic table creation are configured.

## Deploy

```bash
npm ci
python -m pip install -r backend/requirements.txt
npm run build
cd backend
python -m alembic upgrade head
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Run migrations as a distinct deployment step before starting new application processes. Production startup must not call `create_all`.

## Health and readiness

- `GET /health`: process liveness only.
- `GET /readiness`: bounded database readiness plus truthful optional-provider status.
- `X-Request-ID`: include this UUID in incident reports to correlate JSON logs.

Optional AI, payment, email, S3, malware scanning, and external error monitoring are not readiness dependencies unless a deployment policy explicitly makes them mandatory.

## Logs and first incident checks

Application logs are JSON on stdout. Collect them with systemd/journald or the deployment platform. Never log request bodies, cookies, authorization headers, AI prompts, reviewer comments, file content, or provider secrets.

First checks:

```bash
curl -fsS https://api.example.com/health
curl -fsS https://api.example.com/readiness
cd backend && python -m alembic current && python -m alembic heads
```

Filter logs by `request_id`, then inspect `status_code`, `duration_ms`, route, database availability, storage failures, AI provider failures, notification delivery failures, and payment webhook failures.

## Backup

For PostgreSQL, use a credential source outside shell history:

```bash
pg_dump --format=custom --no-owner --file=/secure-backups/baseerah-$(date +%F-%H%M).dump "$DATABASE_URL"
```

Snapshot the configured local storage root or object-storage bucket at the same logical recovery point. Retain an encrypted SHA-256 manifest and restrict backup access. The local SQLite/storage verification command is:

```bash
python scripts/verify-backup-restore.py
```

## Restore verification

Never test restoration over the live database. Create an isolated PostgreSQL database, restore, migrate forward only when required, compare the Alembic revision and representative tenant-scoped counts, then verify uploaded-file hashes against the manifest.

```bash
createdb baseerah_restore_verify
pg_restore --exit-on-error --no-owner --dbname=baseerah_restore_verify /secure-backups/baseerah.dump
DATABASE_URL=postgresql://.../baseerah_restore_verify python -m alembic current
```

## Rollback

Roll back the application artifact first. Do not automatically downgrade the database: migrations can be destructive and require an approved, revision-specific plan. If the new code cannot operate on the migrated schema, restore into an isolated database and follow the incident migration plan.

## Deployment smoke checklist

- `/health` alive and `/readiness` ready.
- Alembic current equals the single head.
- Login/logout and a protected route.
- Project dashboard, search, file list/upload/download, and notifications.
- AI status reports live or fallback truthfully.
- Billing reports sandbox/live truthfully; never execute a real smoke payment.
- External-review invalid token fails without leaking details.
- Security headers and CORS allowed/disallowed origins.
- Recent JSON logs contain request IDs and no secret markers.
