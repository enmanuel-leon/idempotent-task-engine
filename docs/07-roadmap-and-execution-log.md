# 07. Roadmap & Execution Log

## Execution Roadmap

- [x] **Phase 1: Foundation & Isolation**
  - Duplicated repository structure to `idempotent-task-engine`
  - Reset Git history (`git init -b main`)
  - Configured PostgreSQL schema isolation (`task_engine`)
  - Configured custom network ports (API: 3100, Web: 5180)
  - Documented architectural blueprints in `docs/`
- [ ] **Phase 2: Dependency & Code Purge**
  - Remove Better Auth, S3, MinIO, and legacy models/routes/tests
- [ ] **Phase 3: BullMQ & Schema Setup**
  - Install BullMQ and Bull-board
  - Create and apply Prisma schema for `MerchantAccount`, `Transaction`, and `WebhookEvent`
  - Seed test merchant account
- [ ] **Phase 4: Core Engine Implementation**
  - Redis distributed locking and Pub/Sub double-check synchronization
  - BullMQ worker with full jitter backoff formula
  - Webhook ingestion route with Zod validation
  - DLQ replay route and Bull-Board mounting
- [ ] **Phase 5: Telemetry Dashboard & Benchmarks**
  - Fastify SSE metrics stream
  - React 19 dashboard with live KPIs, event feed, and chaos switches
  - Autocannon stress & collision benchmark scripts
- [ ] **Phase 6: Quality Verification & Git Review**
  - Execute `pnpm check` (oxfmt, oxlint, typecheck, vitest)
  - Execute `pnpm audit`
  - Mandatory Git confirmation protocol
