# Idempotent Task Engine

> **A high-throughput, self-hosted distributed task engine that guarantees exactly-once logical processing via multi-tier idempotency locking, asynchronous queue buffering with exponential backoff and full jitter, and automated Dead Letter Queue (DLQ) routing.**

Directly backs up real-world claims in payment gateway reliability and high-throughput asynchronous task orchestration.

---

## 1. Problem Statement & Value Proposition

In financial and transactional networks, webhooks operate under **at-least-once delivery guarantees**. Unstable networks, retries, and high-concurrency bursts routinely cause duplicate operations (double credits, phantom orders, duplicate refunds), out-of-order events, and cascading gateway failures.

**Idempotent Task Engine** solves this by establishing a multi-layer barrier:

- **Fast In-Memory Layer:** Redis response caching (TTL 24h) for sub-millisecond duplicate response return.
- **Distributed Concurrency Guard:** Atomic Redis locking (`SET lock:key <uuid> NX EX 45`) and Pub/Sub channel synchronization for in-flight runners.
- **Resilient Queue Engine:** Bounded concurrency BullMQ workers with AWS/Stripe-grade Full Jitter exponential backoff.
- **Audit Ledger:** ACID-compliant PostgreSQL persistence with integer cents currency precision.
- **Live Telemetry & Chaos:** Real-time Server-Sent Events (SSE) telemetry dashboard and chaos engineering injection switches.

---

## 2. Technical Stack Matrix

| Layer              | Technology                                | Primary Function                                                                |
| :----------------- | :---------------------------------------- | :------------------------------------------------------------------------------ |
| **API Gateway**    | Node.js 24 + Fastify 5 + TypeScript (ESM) | Low-overhead HTTP ingestion, Zod validation, connection lifecycle               |
| **State & Locks**  | Redis 7 (Alpine) via `ioredis`            | Atomic distributed locking (`SET NX EX`), Pub/Sub coordination, response cache  |
| **Message Broker** | BullMQ                                    | Job scheduling, bounded concurrency (20), full-jitter backoff, DLQ routing      |
| **Persistence**    | PostgreSQL 17 + Prisma 7 (Adapter-pg)     | ACID transaction ledger, execution audit trail, isolated schema (`task_engine`) |
| **UI & Telemetry** | React 19 + Vite 8 + Tailwind CSS v4 + SSE | Sub-second visual metrics, deduplication efficiency, chaos toggles              |
| **Observability**  | Bull-Board UI + Structured Pino Logger    | Queue introspection, active job state tracking, manual DLQ replaying            |
| **Benchmarking**   | Autocannon                                | 1,000+ req/s stress testing, concurrent key collision tests                     |
| **Deployment**     | Docker & Docker Compose                   | 100% self-hosted, reproducible execution                                        |

---

## 3. High-Level System Architecture

```
                       [Load & Chaos Harness: Autocannon]
                                          │
                                          │ POST /api/v1/webhooks/epayco
                                          │ (Header: Idempotency-Key)
                                          ▼
                ┌───────────────────────────────────────────────────┐
                │             Fastify Ingestion Gateway             │
                │                                                   │
                │  1. Zod Request Validation                        │
                │  2. Key Normalization: sha256(merchantId:key)     │
                │  3. Multi-Phase Idempotency Middleware            │
                └─────────────┬───────────────────────┬─────────────┘
                              │                       │
           [Cache Hit / Lock] │                       │ [Job Enqueue]
                              ▼                       ▼
            ┌───────────────────────────┐   ┌───────────────────────────┐
            │       Redis Cluster       │   │    BullMQ Primary Queue   │
            │                           │   │    (webhooks-incoming)    │
            │ - SET NX EX 45 (Locks)    │   └─────────────┬─────────────┘
            │ - Pub/Sub (Waiters)       │                 │
            │ - Response Cache (TTL 24h)│                 ▼
            └───────────────────────────┘   ┌───────────────────────────┐
                          ▲                 │   Distributed Worker Pool │
                          │                 │   (Concurrency: 20)       │
                          └─────────────────┤                           │
                          [Publish Done]    │ - Exponential Backoff     │
                                            │ - Full Jitter (Max 5 tries│
                                            │ - Mock Flaky Bank Gateway │
                                            └─────────────┬─────────────┘
                                                          │
                                          ┌───────────────┴───────────────┐
                                          │                               │
                                  [All Retries Exhausted]      [Processing Succeeded]
                                          │                               │
                                          ▼                               ▼
                            ┌───────────────────────────┐   ┌───────────────────────────┐
                            │     BullMQ DLQ Queue      │   │   PostgreSQL 17 Ledger    │
                            │      (webhooks-dlq)       │   │                           │
                            │                           │   │ - Account Balance Update  │
                            │ - Error Stack Storage     │   │ - Transaction Record      │
                            │ - Admin Replay Endpoint   │   │ - Status: COMPLETED       │
                            └───────────────────────────┘   └───────────────────────────┘
```

---

## 4. Distributed Idempotency Protocol

```
Incoming Request (Key: "k_123")
          │
          ▼
Does Redis Cache exist? ─── YES ───► Return Cached Payload immediately (HTTP 200, X-Cache: HIT)
          │
          NO
          ▼
Execute: SET lock:k_123 <uuid> NX EX 45
          │
   ┌──────┴──────────────────────────────────────┐
   ▼ (Lock Acquired = Leader)                    ▼ (Lock Denied = Concurrent In-Flight Runner)
1. Write DB Webhook record: PENDING           1. Subscribe to Redis Channel: "complete:k_123"
2. Push Job to BullMQ (jobId = "k_123")       2. DOUBLE-CHECK: Query cache "response:k_123"
3. Worker executes transactional pipeline     3. Await completion signal (timeout: 3,000ms):
4. Worker saves Response Cache (TTL 24h)         ├─ Event Received: Return Cached Response (HTTP 200)
5. Worker publishes to "complete:k_123"          └─ Timeout Elapsed: Return HTTP 504 (No duplicate job)
6. Leader returns HTTP 202 (Accepted)
```

---

## 5. Resilience & Fault Tolerance Pipeline

### Full Jitter Exponential Backoff

To eliminate synchronized retry storms, retry delays follow:
$$T_{\text{wait}} = \text{random}(0, \; 1000 \times 2^{\text{attempt}})$$

### Dead Letter Queue (DLQ)

Jobs that exceed 5 attempts are automatically transitioned to `webhooks-dlq` with stacktrace and diagnostic payload. Bulk or single replay is available via `POST /api/v1/admin/dlq/replay`.

---

## 6. Port Allocation & Quickstart

- **Fastify API:** `http://localhost:3100`
- **React Telemetry Dashboard:** `http://localhost:5180`
- **Bull-Board Queue UI:** `http://localhost:3100/admin/queues`
- **OpenAPI Swagger:** `http://localhost:3100/docs`

### Development Setup

```bash
# 1. Install workspace dependencies
pnpm install

# 2. Synchronize PostgreSQL task_engine schema
pnpm db:push

# 3. Seed test merchant credentials
pnpm db:seed

# 4. Start concurrent development stack (API + Worker + Web Dashboard)
pnpm dev
```

### Running Verification Suite

```bash
# Run format, lint, typecheck, vitest
pnpm check

# Run pre-push verification (including build)
pnpm prepush:verify

# Run Knip dead-code scanner
pnpm knip
```

### Automated Benchmarks

```bash
# Suite A: 1,000 req/s stress test (unique keys)
pnpm bench:stress

# Suite B: Chaos collision test (100 rotating keys, 0 duplicate records)
pnpm bench:chaos
```
