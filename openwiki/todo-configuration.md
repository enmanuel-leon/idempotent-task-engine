# OpenWiki: Configuration & Hardening Checklist

Use this checklist when onboarding or hardening a new environment for the Idempotent Task Engine:

---

## 1. PostgreSQL Schema Isolation Verification

- [ ] **Dedicated Schema Parameter**: Ensure `DATABASE_URL` explicitly sets `?schema=task_engine`.
  ```env
  DATABASE_URL=postgresql://root:root@192.168.1.136:5434/app_template_db?schema=task_engine
  ```
- [ ] **Multi-Tenant Protection**: Verify that the PostgreSQL `public` schema and external demo databases remain completely untouched.
- [ ] **Schema Synchronization**: Apply Prisma schema changes using `pnpm db:push` or `pnpm db:migrate:deploy`.
- [ ] **Merchant Account Seeding**: Run `pnpm db:seed` and verify `MerchantAccount` is initialized with `$10,000.00` (`1000000n` integer cents).
- [ ] **Financial Precision Check**: Confirm all monetary amounts are stored as 64-bit integer cents (`BIGINT`). Floating-point types are banned.

---

## 2. Redis Connection & Eviction Policy

- [ ] **Redis 7 Connectivity**: Verify connection to Redis server on port 6379 via `REDIS_URL`.
- [ ] **Eviction Policy**: Ensure Redis `maxmemory-policy` is configured to `noeviction` or `volatile-lru` so active distributed mutex locks are not prematurely evicted.
- [ ] **Lock Auto-Expiry (TTL)**: Confirm distributed locks are created with `SET engine:lock:{key} {token} NX EX 45` (45-second self-healing expiration).
- [ ] **Response Cache TTL**: Confirm completed response payloads are cached for 24 hours (`EX 86400`).
- [ ] **Pub/Sub Channel Coordination**: Confirm concurrent in-flight waiters subscribe to `engine:channel:{key}` and unblock without database polling.

---

## 3. BullMQ Worker Configuration & Resilience

- [ ] **Worker Concurrency**: Verify worker concurrency configuration in `apps/api/src/worker.ts` (default: 5; production: 20).
- [ ] **Full Jitter Exponential Backoff**: Verify retry policy employs Full Jitter algorithm:
  $$\text{delay} = \text{random}(0, \min(\text{cap}, \text{base} \times 2^{\text{attempt}}))$$
- [ ] **Dead Letter Queue (DLQ)**: Confirm tasks failing 5 consecutive attempts route to `webhooks-dlq`.
- [ ] **Bull-Board UI Access**: Verify the visual monitoring interface is accessible at `http://localhost:3100/admin/queues`.

---

## 4. Chaos Settings & Telemetry Verification

- [ ] **Chaos Injection Endpoints**: Verify that chaos switches respond correctly:
  - `POST /api/v1/chaos/flaky-gateway` (injects 25% artificial 500 errors).
  - `POST /api/v1/chaos/db-latency` (injects artificial 800ms delays).
- [ ] **SSE Metrics Stream**: Confirm Server-Sent Events stream emits rolling KPIs every 500ms at `/api/v1/metrics/stream`.
- [ ] **Rolling Buffer Boundary**: Verify the frontend Live Ingestion Buffer strictly caps display at 15 items to prevent DOM bloat.
- [ ] **Confirmation Modals**: Verify destructive operations (Reset Data, Replay DLQ, High Concurrency Bursts) prompt user confirmation via accessible modal dialogs.

---

## 5. Benchmark Execution & Baseline Calibration

- [ ] **Stress Test**: Run `pnpm bench:stress` to establish baseline throughput (target: 1,000 req/s, errors < 0.1%, p95 < 150ms).
- [ ] **Chaos Collision Test**: Run `pnpm bench:chaos` with 100 rotating keys and verify 100% deduplication (exactly 100 DB transactions, 0 duplicates).
- [ ] **Realistic Mixed Workload**: Run `pnpm bench:realistic` and confirm 20 unique transactions and 10 intercepted duplicates.
- [ ] **Spike & Soak Verification**: Run `pnpm bench:spike` and `pnpm bench:soak` to ensure memory stability and connection safety under surge conditions.

---

## 6. Network Ports & Kubernetes Readiness

- [ ] **Port Reservation**: Verify port `3100` (Fastify API) and port `5180` (React SPA) are unblocked using `pnpm ports:free`.
- [ ] **Kubernetes Namespace**: Verify namespace is set to `task-engine` across all manifests in `k8s/`.
- [ ] **Secrets & ConfigMap**: Ensure `DATABASE_URL` with `?schema=task_engine` and `REDIS_URL` are configured in `k8s/secrets.yaml`.
- [ ] **Ingress Routing**: Verify routes for API (`/api/v1`, `/docs`, `/admin/queues`) and Web (`/`) are correctly directed.
