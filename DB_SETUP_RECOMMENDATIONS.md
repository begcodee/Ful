# Production DB Setup Recommendations

## 1) Provisioning
- Use managed PostgreSQL with automated backups and point-in-time recovery.
- Enforce private networking (VPC peering/private endpoints) and restrict public ingress.
- Create separate databases/users for `dev`, `staging`, and `prod`.

## 2) Access and secrets
- Store `DATABASE_URL` in a secrets manager; never commit credentials.
- Use least-privilege roles:
  - `app_user`: CRUD on app tables only.
  - `migration_user`: DDL permissions.
  - `readonly_user`: reporting-only.
- Rotate credentials on a schedule and after incidents.

## 3) Schema and migrations
- Replace ad-hoc schema execution with versioned migrations (Prisma/Knex/Umzug/Flyway).
- Never run destructive `DROP TABLE` operations in production bootstrap scripts.
- Add `NOT NULL`, `CHECK`, and `FOREIGN KEY` constraints consistently.

## 4) Security
- Hash passwords with bcrypt/argon2 (already moved to bcrypt in backend controller).
- Encrypt sensitive PII columns at rest and in transit (TLS required).
- Add audit tables for identity review decisions and dispute actions.

## 5) Reliability and performance
- Connection pooling: tune PG pool size per instance and database limits.
- Add indexes for high-cardinality filters and joins.
- Monitor slow queries and define SLOs for latency/error rates.

## 6) Observability
- Enable query logs for errors/slow queries.
- Emit health checks (`/healthz`) and integrate with uptime monitors.
- Create alerts for replication lag, storage growth, and connection saturation.

## 7) Data governance
- Define retention policy for documents, transcripts, and dispute evidence.
- Use append-only event logs for legal auditability.
- Implement backup restore drills quarterly.
