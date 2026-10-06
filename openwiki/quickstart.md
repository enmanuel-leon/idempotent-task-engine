# OpenWiki: Architecture & Quickstart Guide

Welcome to the **Idempotent Task Engine** OpenWiki documentation hub.

---

## 1. System Topology & Dedicated Network Ports

The Idempotent Task Engine runs on dedicated, non-conflicting network ports across its ingestion gateway, real-time dashboard, queue administration, and state tiers:

| Component | Port | Interface / Purpose | Endpoint / Connection URI |
| :--- | :---: | :--- | :--- |
| **Fastify API Server** | `3100` | Ingestion Gateway & SRE Endpoints | `http://localhost:3100` |
| **OpenAPI / Swagger** | `3100` | Interactive API Documentation | `http://localhost:3100/docs` |
| **Bull-Board UI** | `3100` | BullMQ Visual Queue Dashboard | `http://localhost:3100/admin/queues` |
| **SSE Metrics Stream** | `3100` | 500ms Real-Time Push Telemetry | `http://localhost:3100/api/v1/metrics/stream` |
| **React 19 SPA Client** | `5180` | Live Telemetry & Simulation Dashboard | `http://localhost:5180` |
| **PostgreSQL 17** | `5434` / `5432` | Database (`task_engine` schema) | `postgresql://.../app_template_db?schema=task_engine` |
| **Redis 7** | `6379` | Key-Value Cache, Locks & Pub/Sub | `redis://127.0.0.1:6379` |

---

## 2. Key Capabilities Out-of-the-Box

1. **Multi-Tier Distributed Idempotency Protocol**: Sub-millisecond response cache (TTL 24h), distributed mutex locks (`SET engine:lock:{key} {token} NX EX 45`), Lua atomic unlock scripts, and Pub/Sub channel synchronization for concurrent in-flight waiters.
2. **Resilient Asynchronous Queueing (BullMQ)**: Worker pipeline with bounded concurrency, AWS/Stripe-grade Full Jitter exponential backoff, and automatic Dead Letter Queue (`webhooks-dlq`) routing after 5 failed attempts.
3. **ACID Persistence & Schema Isolation**: All tables, sequences, indexes, and migrations reside strictly within schema `task_engine`. Financial amounts are stored strictly as 64-bit integer cents (`balanceCents`, `amountCents`).
4. **Live SSE Telemetry & Chaos Engineering**: Real-time Server-Sent Events stream updating at 500ms intervals, paired with a React 19 dashboard featuring Zero Ternary Operators, rolling window buffers (15 items max), and interactive chaos injection switches.
5. **Operational SRE & Administration**: Mounted Bull-Board queue inspector at `/admin/queues`, automated DLQ replay endpoint, safe database reset endpoint, and comprehensive benchmark test suites.

---

## 3. Step-by-Step Quickstart

### Step 1: Verify Prerequisites

- **Node.js**: `>= 24.0.0`
- **pnpm**: `>= 10.33.0` (Workspace uses pnpm 11)
- **PostgreSQL 17**: Running on port `5434` (or `5432`) with an accessible database
- **Redis 7**: Running on port `6379`

### Step 2: Configure Environment Variables

```bash
# Backend environment
cp apps/api/.env.example apps/api/.env

# Frontend environment
cp apps/web/.env.example apps/web/.env
```

Ensure `DATABASE_URL` in `apps/api/.env` includes the strict schema parameter:
```env
DATABASE_URL=postgresql://root:root@192.168.1.136:5434/app_template_db?schema=task_engine
REDIS_URL=redis://192.168.1.136:6379
```

### Step 3: Apply Database Schema & Seed Initial Merchant

```bash
# Push Prisma schema to task_engine namespace
pnpm db:push

# Seed test merchant account (Acme Payments Corp with $10,000.00 / 1,000,000 cents)
pnpm db:seed
```

### Step 4: Start Development Servers

```bash
# Free occupied ports (3100, 5180) and launch Turbo dev pipeline
pnpm dev
```

Once running:
- **Telemetry Dashboard**: Open `http://localhost:5180` in your browser.
- **OpenAPI Documentation**: Open `http://localhost:3100/docs`.
- **Bull-Board Queue UI**: Open `http://localhost:3100/admin/queues`.

### Step 5: Execute Benchmark & Chaos Verification

```bash
# Run high-concurrency stress test (1,000 req/s, unique keys)
pnpm bench:stress

# Run concurrency collision test (1,000 req/s, 100 rotating keys, 0 duplicates)
pnpm bench:chaos
```

---

## 4. OpenWiki Documentation Hub Pages

- [Environment Variables Architecture & Priority](./environment-variables.md)
- [Operational CLI & Benchmark Commands](./cli-operations.md)
- [Kubernetes Production Deployment Guide (`k8s/`)](./kubernetes-deployment.md)
- [TODO Configuration Checklist](./todo-configuration.md)
- [Operational Administration & Reset Runbook](../docs/08-operational-administration-and-reset.md)
