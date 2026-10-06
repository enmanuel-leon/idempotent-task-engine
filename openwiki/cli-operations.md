# OpenWiki: Operational CLI & Benchmark Commands

This document catalogues the primary operational CLI commands, database management scripts, quality verification gates, and Autocannon benchmark suites for the Idempotent Task Engine.

---

## 1. Benchmarking & Chaos Testing Commands

The repository provides five specialized Autocannon benchmark suites to validate throughput, concurrency collision safety, queue backpressure, and endurance:

| Command | Suite | Workload Profile | Target Pass Criteria |
| :--- | :--- | :--- | :--- |
| `pnpm bench:stress` | **High Concurrency** | 1,000 req/s for 15s with unique idempotency keys | Errors < 0.1%, p95 latency < 150ms |
| `pnpm bench:chaos` | **Chaos Collision** | 1,000 req/s with 100 rotating keys | Exactly 100 DB transactions, 0 duplicates, 100% response consistency |
| `pnpm bench:realistic` | **Heterogeneous Traffic** | 20 unique requests + 10 intentional duplicates | 20 transactions created, 10 intercepted as cache hits |
| `pnpm bench:spike` | **Spike Ingestion** | 10x traffic surge (80 concurrent connections) | Zero dropped connections, errors < 0.1% |
| `pnpm bench:soak` | **Sustained Soak** | 30s continuous steady throughput | Memory delta bounded, p99 latency stable, zero memory leaks |

---

## 2. Database & Schema Operations

All database operations execute strictly within the isolated PostgreSQL schema `task_engine`:

- **Seed Test Merchant (`pnpm db:seed`)**:
  Creates or updates the default test merchant account (`Acme Payments Corp`, ID `00000000-0000-0000-0000-000000000001`) with an initial balance of $10,000.00 (stored as `1000000n` integer cents).
- **Safe Data Purge (`pnpm db:purge` / `pnpm test:reset`)**:
  Executes `apps/api/scripts/reset.ts`:
  1. Deletes all records in `task_engine.Transaction`.
  2. Deletes all records in `task_engine.WebhookEvent`.
  3. Resets `task_engine.MerchantAccount` balance to 1,000,000 cents.
  4. Flushes Redis mutex locks (`engine:lock:*`) and response cache (`engine:response:*`).
  5. Drains and obliterates BullMQ queues (`webhooks-incoming`, `webhooks-dlq`).
  6. Resets in-memory telemetry metrics.
  _The PostgreSQL `public` schema and external demo databases remain completely untouched._
- **Schema Push (`pnpm db:push`)**:
  Synchronizes the Prisma schema directly to the database without generating migration files.
- **Prisma Client Generation (`pnpm prisma:generate`)**:
  Re-generates Prisma Client types following schema changes.

---

## 3. Port & Process Management

- **Free Occupied Ports (`pnpm ports:free`)**:
  Executes `scripts/kill-ports.sh` to safely terminate any lingering processes listening on API port `3100` and Web port `5180`. Automatically executed before launching `pnpm dev`.

---

## 4. Code Quality & Security Verification Matrix

Execute these quality gates before committing code or opening a pull request:

```bash
# Standard verification suite (format check, oxlint, typecheck, vitest)
pnpm check

# Unused code & dependency scanner
pnpm knip

# Security CVE vulnerability audit
pnpm security:audit

# Local secret detection scan (Gitleaks)
pnpm security:secrets

# Comprehensive pre-push verification (format, lint, typecheck, test, audit, build)
pnpm prepush:verify
```
