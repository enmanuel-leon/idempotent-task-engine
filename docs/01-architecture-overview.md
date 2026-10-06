# 01. Architecture Overview & System Topology

## Problem Statement

In financial networks and transactional webhooks, delivery guarantees are at-least-once. Network instability, upstream retries, and concurrent bursts routinely trigger duplicate operations (duplicate payments, double refunds), out-of-order events, and cascading gateway failures.

---

## Architectural Topology & Component Architecture

```mermaid
flowchart TB
    subgraph ClientTier ["Frontend Presentation Tier (Port 5180)"]
        SPA["React 19 SPA Telemetry Dashboard<br/>(Vite 8 • Tailwind CSS • Lucide Icons)"]
    end

    subgraph APITier ["Fastify 5 Application Gateway (Port 3100)"]
        Gateway["Fastify Ingestion Gateway<br/>POST /api/v1/webhooks/epayco"]
        SSE["Server-Sent Events Stream<br/>GET /api/v1/metrics/stream"]
        EventsAPI["Paginated Audit & Ledger Endpoints<br/>GET /api/v1/events • GET /api/v1/transactions"]
        AdminAPI["Operational SRE Endpoints<br/>POST /api/v1/admin/reset • POST /api/v1/admin/dlq/replay"]
        BullBoard["Bull-Board Monitoring Interface<br/>GET /admin/queues"]
        Swagger["OpenAPI Documentation<br/>GET /docs"]
    end

    subgraph WorkerTier ["Background Asynchronous Worker Engine"]
        Worker["BullMQ Worker Process<br/>(Concurrency: 5 • Full Jitter Backoff Strategy)"]
    end

    subgraph StateTier ["State, Caching & Storage Infrastructure"]
        subgraph RedisCluster ["Redis 7 (192.168.1.136:6379)"]
            Cache["Response Cache Store<br/>engine:response:* (TTL: 24h)"]
            Locks["Distributed Mutex Locks<br/>engine:lock:* (TTL: 45s)"]
            PubSub["Pub/Sub Synchronization Channels<br/>engine:channel:*"]
            Queues["BullMQ Queues<br/>webhooks-incoming • webhooks-dlq"]
        end

        subgraph PostgresCluster ["PostgreSQL 17 (192.168.1.136:5434 / app_template_db)"]
            Schema["Schema: task_engine (Strict Isolation)<br/>───────────────────────<br/>• MerchantAccount (Integer Cents Balance)<br/>• WebhookEvent (Idempotency Audit Log)<br/>• Transaction (Financial Settlement Ledger)"]
        end
    end

    SPA -->|SSE Metrics Connection| SSE
    SPA -->|HTTP Webhook Bursts| Gateway
    SPA -->|Paginated Audit Queries| EventsAPI
    SPA -->|Purge & Replay Triggers| AdminAPI
    SPA -.->|Direct Operator Link| BullBoard

    Gateway -->|Lock Acquisition & Cache Lookup| Locks
    Gateway -->|Fast-Path Cache Hit| Cache
    Gateway -->|Subscribe to In-Flight Worker| PubSub
    Gateway -->|Push Task (jobId = normalizedKey)| Queues
    Gateway -->|Write Initial Audit Record| Schema

    Queues -->|Dispatch Job to Worker| Worker
    Worker -->|ACID DB Transaction Increment| Schema
    Worker -->|Persist Response Payload| Cache
    Worker -->|Broadcast Completion Event| PubSub
    Worker -->|Release Distributed Mutex| Locks
    Worker -->|Dead-Letter Failed Tasks (> 5 tries)| Queues
```

---

## Dedicated Port Allocations

| Component               |  Port  | Interface / Purpose               | Public URL                                    |
| :---------------------- | :----: | :-------------------------------- | :-------------------------------------------- |
| **Fastify API Server**  | `3100` | Ingestion Gateway & SRE Endpoints | `http://localhost:3100`                       |
| **OpenAPI / Swagger**   | `3100` | Interactive API Documentation     | `http://localhost:3100/docs`                  |
| **Bull-Board UI**       | `3100` | BullMQ Queues Visual Dashboard    | `http://localhost:3100/admin/queues`          |
| **SSE Metrics Stream**  | `3100` | 500ms Real-Time Push Telemetry    | `http://localhost:3100/api/v1/metrics/stream` |
| **React 19 SPA Client** | `5180` | Live Telemetry & Simulation UI    | `http://localhost:5180`                       |
| **PostgreSQL 17**       | `5434` | Database (`task_engine` schema)   | `192.168.1.136:5434/app_template_db`          |
| **Redis 7**             | `6379` | Key-Value Cache, Locks & Broker   | `192.168.1.136:6379`                          |

---

## Core Operational Guarantees

1. **Strict Database Isolation:** All models, migrations, and tables live exclusively within schema `task_engine`. The default `public` schema and external demo databases remain untouched.
2. **Financial Integer Precision:** All currency amounts and merchant balances are stored strictly as 64-bit integer cents (`balanceCents`, `amountCents`). Division by 100 occurs solely at the UI display boundary.
3. **No Unbounded DOM Growth:** The live telemetry stream enforces a rolling window buffer (capped at 15 items max). Historical browsing is delegated to server-side paginated queries (`GET /api/v1/events`).
4. **Self-Healing Mutex Locks:** All Redis distributed locks include an active 45-second TTL, preventing permanent system deadlocks in the event of an ungraceful worker termination.
