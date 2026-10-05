# OpenWiki: Interactive Developer & SRE Console (`pnpm cli`)

Launch the interactive Clack CLI console at any time:

```bash
pnpm cli
```

---

## 🗄️ Database Operations (PostgreSQL)

- **Connection Diagnostics**: Verifies PostgreSQL connection, database name, table count, and latency.
- **Schema Sync & Seed (`pnpm db:push`)**: Applies Prisma schema changes non-destructively and seeds countries and timezones. It does not create users or organizations.
- **Create Administrator User**: Prompts for validated administrator credentials and creates the admin user, default organization, and welcome item independently from the reference seed.
- **Full Database Reset (`pnpm db:reset`)**: Wipes the local database, recreates the schema, and seeds only reference data. Administrator creation remains a separate operation.

---

## ⚡ Redis & Cache Operations

- **Redis Health Ping**: Verifies Redis server connectivity and ping latency.
- **Flush Keys**: Clears Redis cache keys.

---

## 🐳 Docker & Infrastructure Operations

- **Start Infra (`pnpm infra:up`)**: Spins up local PostgreSQL, Redis, and MinIO containers.
- **Stop Infra (`pnpm infra:down`)**: Stops local Docker containers.
- **Container Status (`pnpm infra:ps`)**: Displays running Docker containers.
- **SMTP Diagnostic Test**: Sends a test email to verify SMTP transporter credentials and Resend integration.

---

## 🧪 Code Quality & Verification

- **Quality Checks (`pnpm check`)**: Runs format check, linter, typecheck, and vitest suite.
- **Knip Scanner (`pnpm knip`)**: Scans for dead code, unused exports, and missing dependencies.
