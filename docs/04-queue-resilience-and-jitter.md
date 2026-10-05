# 04. Queue Resilience & Jitter Implementation

## Full Jitter Exponential Backoff Formula

To prevent the "thundering herd" problem where thousands of retrying jobs hammer an upstream service at identical intervals, we apply Full Jitter:

$$T_{\text{wait}} = \text{random}(0, \; \text{delay}_{\text{base}} \times 2^{\text{attempt}})$$

- Base Delay: 1,000ms
- Multiplier: 2
- Max Attempts: 5

## Dead Letter Queue (DLQ) Lifecycle

1. When attempts exceed 5, the job is permanently marked failed in BullMQ primary queue (`webhooks-incoming`).
2. Diagnostic metadata (error stack trace, attempt counts, execution timeline, raw payload) is recorded in PostgreSQL with status `DEAD_LETTER`.
3. The job payload is moved to `webhooks-dlq`.
4. Administrators can inspect the DLQ via Bull-Board UI (`http://localhost:3100/admin/queues`) or trigger bulk replay via `POST /api/v1/admin/dlq/replay`.
