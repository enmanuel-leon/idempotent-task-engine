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
