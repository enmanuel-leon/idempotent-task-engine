# 06. Benchmarks & Chaos Testing

## Chaos Engineering Controls

- **Toggle Flaky Gateway (`POST /api/v1/chaos/flaky-gateway`):** Injects artificial 500 errors (25% frequency) into simulated downstream payment gateways.
- **Toggle DB Latency Spike (`POST /api/v1/chaos/db-latency`):** Injects artificial 800ms delays into PostgreSQL write operations.

## Benchmark Test Suites

- **Suite A: High Concurrency Stress Test (`npm run bench:stress`):**
  - Target: 1,000 requests/sec for 30s with unique idempotency keys.
  - Success Criteria: Zero failed requests (< 0.1%), p95 latency < 150ms.
- **Suite B: Chaos Concurrency Collision (`npm run bench:chaos`):**
  - Target: 1,000 requests/sec with a constrained pool of 100 rotating idempotency keys.
  - Success Criteria: Exactly 100 database transactions created, 0 duplicate ledger entries, 100% response consistency.

## Concurrency vs. True Parallelism Architecture

### Concurrency (Async Event Loop Interleaving)

Fastify and Node.js handle thousands of concurrent network connections via non-blocking asynchronous I/O (libuv). When high-concurrency bursts arrive:

1. TCP connections are accepted concurrently.
2. Async I/O dispatches (Redis atomic locks, DB queries) are interleaved without blocking the thread.
3. Redis acts as the centralized atomic synchronization coordinator: the first packet to arrive acquires the lock (`SET NX EX`), and subsequent packets are rejected as concurrent runners.

### True Hardware Parallelism (Multi-Core Execution)

To achieve simultaneous multi-core instruction execution, the engine supports three decoupled scaling tiers:

1. **Multi-Process Worker Pool:** Spawn multiple isolated worker OS processes running `apps/api/src/worker.ts`. BullMQ uses Redis atomic primitives to coordinate job leasing across all parallel processes with zero race conditions.
2. **Containerized Worker Replicas:** In production (`docker-compose.yml`), scale workers horizontally with `deploy.replicas: 4`.
3. **Gateway Clustering:** Fastify can be clustered across CPU cores using Node.js `node:cluster`, sharing port 3100 via OS kernel socket balancing.

## Complete Benchmark Command Matrix

| Suite                       | Command                | Profile                               | Target Pass Condition                        |
| :-------------------------- | :--------------------- | :------------------------------------ | :------------------------------------------- |
| **High Concurrency**        | `pnpm bench:stress`    | 1,000 req/s for 15s (unique keys)     | Errors < 0.1%, p95 latency < 150ms           |
| **Chaos Collision**         | `pnpm bench:chaos`     | 1,000 req/s (100 rotating keys)       | Exactly 100 DB transactions, 0 duplicates    |
| **Realistic Heterogeneous** | `pnpm bench:realistic` | 20 unique + 10 intentional duplicates | 20 transactions created, 10 intercepted      |
| **Spike Ingestion**         | `pnpm bench:spike`     | 10x traffic surge (80 connections)    | Zero dropped connections, errors < 0.1%      |
| **Sustained Soak**          | `pnpm bench:soak`      | 30s continuous steady throughput      | Memory delta bounded, p99 stable, zero leaks |
