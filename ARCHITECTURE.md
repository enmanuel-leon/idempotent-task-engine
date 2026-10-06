# Architecture & Design Standards — Idempotent Task Engine

This document defines the core technical architecture, invariants, and performance non-functional requirements (NFRs) for the Idempotent Task Engine.

---

## 1. System Architecture Overview

Idempotent Task Engine is a high-throughput, self-hosted distributed task engine that guarantees exactly-once logical processing and financial settlement across distributed networks with at-least-once delivery guarantees.

```
                       [Load & Chaos Client: Autocannon / Browser]
                                           │
                                           │ POST /api/v1/webhooks/epayco
                                           │ (Headers: Idempotency-Key, x-api-key)
                                           ▼
                 ┌───────────────────────────────────────────────────┐
                 │       Fastify 5 Application Gateway (:3100)       │
                 │                                                   │
                 │  • Zod Schema & API Key Validation                │
                 │  • Normalized Key: sha256(merchantId:key)         │
                 │  • Multi-Tier Distributed Idempotency Guard       │
                 │  • OpenAPI (/docs) & Bull-Board (/admin/queues)   │
                 │  • SSE Telemetry Stream (/api/v1/metrics/stream)  │
                 └─────────────┬───────────────────────┬─────────────┘
                               │                       │
            [Cache Hit / Lock] │                       │ [Job Enqueue]
                               ▼                       ▼
             ┌───────────────────────────┐   ┌───────────────────────────┐
             │       Redis 7 Cluster     │   │    BullMQ Primary Queue   │
             │                           │   │    (webhooks-incoming)    │
             │ • SET NX EX 45 (Locks)    │   └─────────────┬─────────────┘
             │ • Pub/Sub Waiters Channel │                 │
             │ • Response Cache (TTL 24h)│                 ▼
             └───────────────────────────┘   ┌───────────────────────────┐
                           ▲                 │   Distributed Worker Pool │
                           │                 │   (Concurrency: 5-20)     │
                           └─────────────────┤                           │
                           [Publish Done]    │ • Full Jitter Backoff     │
                                             │ • Chaos Simulation Switch │
                                             └─────────────┬─────────────┘
                                                           │
                                           ┌───────────────┴───────────────┐
                                           │                               │
                                   [Retries Exhausted]          [Settlement Committed]
                                           │                               │
                                           ▼                               ▼
                             ┌───────────────────────────┐   ┌───────────────────────────┐
                             │     BullMQ DLQ Queue      │   │   PostgreSQL 17 Ledger    │
                             │      (webhooks-dlq)       │   │   (schema: task_engine)   │
                             │                           │   │                           │
                             │ • Error Stack Storage     │   │ • MerchantAccount Balance │
                             │ • SRE Replay Endpoint     │   │ • Transaction Record      │
                             │ • Bull-Board Dashboard    │   │ • WebhookEvent Audit Log  │
                             └───────────────────────────┘   └───────────────────────────┘
```

### 1.1 Backend Application Gateway (`apps/api`)

- **Framework**: Fastify 5 with plugin encapsulation running on port `3100`.
- **OpenAPI / Swagger Documentation**: Interactive API documentation auto-generated and served at `/docs`.
- **Queue Administration**: Bull-Board visual queue monitoring dashboard mounted at `/admin/queues`.
- **Real-Time Telemetry Stream**: Server-Sent Events (SSE) endpoint at `/api/v1/metrics/stream` broadcasting ingestion rates (RPS), deduplication efficiency, p95/p99 latencies, and queue backlogs every 500ms.
- **SRE Administration**: Dedicated operational endpoints for data purge (`POST /api/v1/admin/reset`) and dead-letter replay (`POST /api/v1/admin/dlq/replay`).
- **Global Error Handling**: Custom Fastify error handler mapping Prisma error codes (`P2002`, `P2025`, `P2003`) and Zod schema validation errors into standardized RFC-compliant error payloads.

### 1.2 Database & Persistence Layer (`PostgreSQL 17` + `Prisma 7`)

- **Strict Schema Namespace Isolation**: All tables, sequences, indexes, and migrations reside exclusively inside the `task_engine` schema (`?schema=task_engine`). The PostgreSQL `public` schema and external demo databases remain completely untouched.
- **Integer Cents Financial Precision**: All currency amounts and merchant balances are stored strictly as 64-bit signed integers (`BIGINT` / `balanceCents`, `amountCents`). Floating-point types are strictly prohibited. Division by 100 occurs exclusively at the presentation boundary.
- **Domain Data Models**:
  - `MerchantAccount`: Multi-tenant merchant entity holding credentials (`apiKey`), business identity, ISO currency, and balance in integer cents.
  - `WebhookEvent`: Ingestion audit log tracking idempotency keys, execution statuses (`PENDING`, `PROCESSING`, `COMPLETED`, `DEAD_LETTER`), raw payloads, cached responses, attempt counts, and error stack traces.
  - `Transaction`: Immutable double-entry financial settlement ledger record referencing the settled `WebhookEvent` (unique 1:1 relation) and `MerchantAccount`.

### 1.3 State, Locking & In-Memory Coordination (`Redis 7` via `ioredis`)

- **Distributed Mutex Lock**: Atomic concurrency acquisition via `SET engine:lock:{normalizedKey} {token} NX EX 45`. The 45-second TTL provides guaranteed self-healing against orphaned locks if a node abruptly halts.
- **Atomic Lock Release**: Safe lock release executed via Lua script ensuring a worker only releases the lock if its token matches, preventing accidental release of locks acquired by subsequent runs.
- **Pub/Sub Waiter Synchronization**: Secondary concurrent requests encountering an active lock subscribe to `engine:channel:{normalizedKey}`. When the leader finishes, it broadcasts the payload, unblocking waiters without database polling.
- **Double-Checked Subscription**: Concurrent waiters immediately re-verify the cache after subscribing, closing sub-millisecond race windows where the leader completed between lock check and subscription.
- **Response Cache Store**: Settled payloads are stored at `engine:response:{normalizedKey}` with a 24-hour TTL (`EX 86400`), guaranteeing sub-millisecond responses for repeated idempotent requests.

### 1.4 Asynchronous Worker Engine & Queue Resilience (`BullMQ`)

- **Queue Architecture**: Primary queue `webhooks-incoming` handles ingestion; dead-letter queue `webhooks-dlq` isolates unrecoverable jobs.
- **Deterministic Deduplication**: Jobs are scheduled with `jobId: normalizedKey` to prevent duplicate enqueuing during ingestion bursts.
- **Resilient Retry & Full Jitter Backoff**: Failed jobs retry up to 5 times using AWS/Stripe-grade Full Jitter exponential backoff:
  $$\text{delay} = \text{random}(0, \min(\text{cap}, \text{base} \times 2^{\text{attempt}}))$$
  Full Jitter decorrelates worker retries and prevents thundering herd catastrophes on upstream services.
- **Dead Letter Queue (DLQ) Routing**: After exhausting 5 attempts, jobs automatically route to `webhooks-dlq`. The database record transitions to `DEAD_LETTER` with the full error trace preserved for SRE inspection.

### 1.5 Frontend Presentation Tier (`apps/web`)

- **Framework**: React 19 + Vite 8 SPA running on port `5180`.
- **Styling & UI**: Tailwind CSS v4 with Lucide React vector icons exclusively (no emojis in code or UI).
- **Custom Hook Component Pattern**: Every view is strictly decoupled into:
  - `page.tsx`: Presentation-only JSX with clean, declarative rendering.
  - `use-page.ts`: Logic hook encapsulating queries, mutations, state, and callbacks.
  - `index.ts`: Barrel export exporting the presentation component only.
- **Rolling Window Ingestion Buffer**: The live ingestion stream maintains a strict rolling buffer capped at 15 items maximum to prevent unbounded DOM node growth and memory leaks.
- **Server-Side Pagination**: Deep audit log analysis consumes `GET /api/v1/events` with server-side `page` and `pageSize` parameters. Client-side slicing of unbounded datasets is prohibited.
- **Data Caching & Transitions**: TanStack Query 5 caching (`staleTime: 60000`, `placeholderData: keepPreviousData`) maintains state stability and prevents visual layout flickering during navigation.
- **Accessible Confirmation Dialogs**: Destructive operations (Reset Test Data, Replay DLQ, Concurrency Bursts) require explicit user confirmation via native HTML5 `<dialog open aria-modal="true">` components.

---

## 2. Environment Variables Architecture & Precedence

Configuration follows strict scoping. Root `.env` configures local infrastructure containers, `apps/api/.env` configures backend runtime parameters, and `apps/web/.env` provides frontend build-time parameters.

### 2.1 Precedence Hierarchy

1. **System & OS / Container Process Variables** (`process.env`, Kubernetes Secrets/ConfigMaps, Docker) **[Highest Priority]**
2. **Application-Specific `.env`** (`apps/api/.env` or `apps/web/.env`)
3. **Monorepo Root `.env`** (`/.env`)
4. **Code Defaults & Fallbacks** (`env.ts` / Zod defaults) **[Lowest Priority]**

### 2.2 Runtime vs Build-Time Evaluation

- **Backend (`apps/api`)**: Evaluated dynamically at **runtime** on application startup and request processing.
- **Frontend (`apps/web`)**: Evaluated at **build-time** by Vite (`pnpm build`). Only variables prefixed with `VITE_` are compiled into the static client bundle.

### 2.3 Variable Matrix

| Variable       | Scope     | Target Layer | Description                              | Default / Example                                     |
| :------------- | :-------- | :----------- | :--------------------------------------- | :---------------------------------------------------- |
| `NODE_ENV`     | API / Web | Global       | Runtime execution environment            | `development`                                         |
| `PORT`         | API       | Backend      | Fastify HTTP server listener port        | `3100`                                                |
| `HOST`         | API       | Backend      | Network interface binding address        | `0.0.0.0`                                             |
| `CORS_ORIGIN`  | API       | Backend      | Allowed CORS origins (comma-delimited)   | `http://localhost:5180,http://127.0.0.1:5180`         |
| `DATABASE_URL` | API       | Backend      | PostgreSQL connection string with schema | `postgresql://.../app_template_db?schema=task_engine` |
| `REDIS_URL`    | API       | Backend      | Redis 7 connection string                | `redis://127.0.0.1:6379`                              |
| `VITE_API_URL` | Web       | Frontend     | API backend target for client requests   | `http://localhost:3100` (empty in dev for proxy)      |

---

## 3. Non-Negotiable Invariants & Quality Guardrails

### 3.1 The "Zero Ternary Operators" Rule

Ternary conditional expressions (`condition ? a : b`) are **strictly prohibited** across all `.ts`, `.tsx`, and `.py` files.

- **In TypeScript logic (`.ts`, `.py`)**: Use standard `if/else` control flow blocks with clean, early returns.
- **In React rendering (`.tsx`)**: Pre-calculate render branches inside local helper variables before the `return` statement, or use safe boolean `&&` logical guards.
- **In conditional styling**: Always use class merger utilities: `cn("base", isActive && "active-style")`.

### 3.2 Financial Precision: Integer Cents Invariant

- All currency amounts, balances, and transaction amounts must be stored and processed as **integer cents (`balanceCents`, `amountCents`)**.
- Floating-point representations (`float`, `double`) are strictly prohibited for monetary values.
- Monetary division (`cents / 100`) is permitted exclusively at the UI presentation boundary for localized currency formatting.

### 3.3 Strict PostgreSQL Schema Isolation

- All migrations, tables, sequences, and queries must execute within schema `task_engine`.
- Accessing, modifying, or dropping objects in the `public` schema or adjacent namespaces is strictly prohibited.

### 3.4 Strict Ban on Table Polling

- Automated background polling loops (`refetchInterval`, recursive `setTimeout`, `setInterval`) on data listings are strictly banned.
- All data tables must provide an explicit, visible refresh button with an animated spinner during refetching.
- Real-time updates are driven exclusively by the push-based Server-Sent Events (SSE) telemetry stream.

### 3.5 SonarLint Quality & Cognitive Complexity (≤ 15)

- All functions must maintain a Sonar Cognitive Complexity score of **15 or lower** (orchestrators ≤ 5).
- Functions must never accept more than 7 positional parameters. When 4 or more parameters are required, bundle them into a typed parameter object (`Readonly<Params>`).
- Cryptographic randomness is mandatory: `Math.random()` is strictly banned. Backend services use `node:crypto` (`randomInt`, `randomUUID`), and frontend hooks use Web Crypto (`crypto.randomUUID()`).
