# 01. Architecture Overview

## Problem Statement

In financial and transactional networks, webhooks operate under at-least-once delivery guarantees. Network instability, provider retries, and high-concurrency bursts routinely cause duplicate operations (double charges, duplicate refunds), out-of-order events, and cascading gateway failures.

## The Solution

A high-throughput, self-hosted distributed task engine that guarantees exactly-once logical processing via:

1. Multi-tier idempotency locking (Redis fast cache lookup + atomic distributed locks).
2. Asynchronous queue buffering (BullMQ with deterministic job IDs, bounded concurrency, and exponential backoff with full jitter).
3. Automated Dead Letter Queue (DLQ) routing with diagnostic metadata storage and manual/bulk replay.
4. ACID-compliant persistence (PostgreSQL 17 with integer cents precision).
5. Real-time telemetry dashboard (React 19 + Tailwind CSS + Server-Sent Events stream).

## System Boundary & Port Allocation

- **Fastify API Gateway:** `http://0.0.0.0:3100`
  - Swagger Documentation: `http://localhost:3100/docs`
  - Bull-Board Queue UI: `http://localhost:3100/admin/queues`
  - SSE Telemetry Stream: `http://localhost:3100/api/v1/metrics/stream`
- **React 19 SPA Telemetry Dashboard:** `http://localhost:5180`
- **PostgreSQL 17 (Adapter-pg):** Isolated schema `task_engine` on `192.168.1.136:5434`.
- **Redis 7 (ioredis):** Distributed locking and message broker on `192.168.1.136:6379`.
