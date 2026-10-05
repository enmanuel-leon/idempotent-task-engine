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
