# Operational Monitoring Plan

This plan is the minimum operational equivalent required before production traffic. It does not claim that an external monitoring service or alert channel is already configured.

| Signal | Trigger | Owner | Alert channel | Immediate response |
| --- | --- | --- | --- | --- |
| HTTP 5xx | sustained errors or sharp increase | On-call application engineer | `PRODUCTION_ALERT_CHANNEL` (must be approved/configured) | correlate request IDs, inspect structured logs, roll back or isolate the failing path |
| Readiness | any consecutive readiness failures | On-call SRE | same | stop new traffic, verify database/network dependencies |
| Process down | health endpoint unreachable | On-call SRE | same | restart safely, inspect process and platform events |
| Disk/storage | warning at 75%, critical at 90%, or write failure | Storage owner | same | halt nonessential uploads, expand capacity or remediate growth |
| Database | connection failure, saturation, or migration mismatch | Database owner | same | remove traffic, inspect PostgreSQL and migration state |
| Backup | scheduled backup or verification failure | Recovery owner | same | preserve last verified backup and rerun isolated verification |

Before traffic, the release owner must record the selected monitor, polling interval, destinations, named on-call owner, and a successful test alert in the deployment change record. Until that evidence exists, `Monitoring Before Traffic` is **FAIL** and Phase 14 entry remains denied.

## Capability matrix

| Capability | Production configuration | UI/API behavior when absent |
| --- | --- | --- |
| AI | real provider and key required | API returns unavailable; fake provider is blocked |
| Payment | live provider required | checkout unavailable; sandbox/null adapters cannot collect payment |
| Email | configured delivery adapter required | delivery recorded as `NOT_CONFIGURED`, never fake `SENT` |
| S3 | explicit S3 configuration required | local secure storage remains the declared non-S3 mode |
| Malware scanner | scanner integration required for a scanned claim | files remain explicitly `UNSCANNED`; no clean claim is made |
| Monitoring | configured external monitor or approved equivalent | production traffic prohibited until recorded |

Paid collection is disabled without a live payment provider. Repository pricing is technical/demo configuration until separately approved for commercial launch.
