# 05. Telemetry Dashboard & SSE Specifications

## Minimalist Telemetry Dashboard (React 19 + Tailwind CSS)

Accessible at `http://localhost:5180`.

### Real-Time KPIs Emitted Every 500ms via SSE (`/api/v1/metrics/stream`)

- **Requests Per Second (RPS):** Current rolling ingestion rate.
- **Deduplication Efficiency (%):**
  $$100 \times \frac{\text{Intercepted Duplicates}}{\text{Total Ingestion Requests}}$$
- **Latency Percentiles:** Rolling p95 and p99 processing duration in milliseconds.
- **Active DLQ Count:** Current number of dead-lettered jobs pending replay.
- **Queue Backlog:** Active and waiting jobs in BullMQ.

### Performance & UI Guardrails (AGENTS.md Compliant)

- **STRICT BAN ON TABLE POLLING:** No `refetchInterval` or background intervals for listings.
- **Server-Sent Events:** High-frequency KPI metrics arrive via a single multiplexed SSE connection.
- **Manual Reload Button:** Tables and execution history have an explicit refresh button with spinner.
- **No Raw Emojis:** Exclusively Lucide React vector icons.
- **Zero Ternaries:** Clean `if/else` and pre-computed branches throughout.

## Historical Deduplication Events Endpoint (`GET /api/v1/events`)

- **Server-Side Pagination:** Accepts `page` (default 1) and `pageSize` (default 10, max 50).
- **Filtered State:** Optional filter by `status` (`PENDING`, `PROCESSING`, `COMPLETED`, `DEAD_LETTER`).
- **Standard Envelope:** Returns `{ data: [...], pagination: { total, page, pageSize, totalPages } }`.
- **Dual-Pane View with Visual Parity:** Left panel provides Live Ingestion Buffer (capped at 15 items to prevent DOM bloat) alongside Idempotency Audit Log, styled with fixed-height container parity matching the Settled Financial Ledger.
- **Semantic Status Color System:** Standardized visual feedback:
  - **Green:** Successful settlements and cache hits (`HIT`, `COMPLETED`).
  - **Cyan:** Leader execution (`LEADER (MISS)`).
  - **Amber:** Concurrent listeners and in-flight locks (`CONCURRENT HIT`, `TIMEOUT (WAITING)`).
  - **Rose:** Negative amounts (refunds) and failures (`DEAD_LETTER`, `DLQ`).

## Safe Action Guards (Confirmation Modals)

Per AGENTS.md rule 5.3, all native browser dialogs are banned. Accessible confirmation modal components guard:

- **Reset Test Data:** Requires explicit confirmation before executing schema purges.
- **Dead Letter Queue Replay:** Guards bulk DLQ re-queue operations.
- **High Concurrency Burst (>= 25x):** Confirms before triggering high-concurrency contention loads.
