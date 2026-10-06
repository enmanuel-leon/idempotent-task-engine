# 03. Distributed Idempotency Protocol (Stripe-Grade)

## Execution Protocol

```
Incoming Request (Idempotency-Key: "k_123", Merchant: "m_1")
         │
         ▼
Key Normalization: sha256("m_1:k_123") -> "hash_123"
         │
         ▼
Does Redis Key "response:hash_123" exist? ─── YES ───► Return Cached Payload (HTTP 200, X-Cache: HIT)
         │
         NO
         ▼
Execute: SET lock:hash_123 <uuid> NX EX 45
         │
  ┌──────┴──────────────────────────────────────┐
  ▼ (Lock Acquired = Leader)                    ▼ (Lock Denied = Concurrent In-Flight Runner)
1. Write WebhookEvent record: PENDING         1. Subscribe to Redis Channel: "complete:hash_123"
2. Push Job to BullMQ (jobId = "hash_123")    2. DOUBLE-CHECK: Check "response:hash_123"
3. Worker executes transactional pipeline     3. Await completion signal (timeout: 3,000ms):
4. Worker saves Response Cache (TTL 24h)         ├─ Event Received: Return Cached Response (HTTP 200)
5. Worker publishes to "complete:hash_123"       └─ Timeout Elapsed: Return HTTP 504 (No duplicate job)
6. Leader returns HTTP 202 (Accepted)
```

## Double-Checked Locking Rationale

When concurrent identical requests strike during sub-millisecond windows, Request B could attempt to subscribe AFTER the worker has already finished and published. By subscribing FIRST, then immediately checking the response cache, Request B guarantees zero missed notifications.

## Edge Case Test Suite (`apps/api/tests/unit/idempotency.test.ts`)

Targeted unit and integration tests formally verify four critical edge conditions:

1. **Deterministic Normalization:** Deterministic SHA256 hashing across merchant and idempotency key pairs.
2. **Cache Integrity & Graceful Deserialization:** Key existence checks, roundtrip payload verification, and corrupted JSON tolerance.
3. **Distributed Lock TTL & Mutex Isolation:** Strict `SET NX EX` mutexing, key TTL enforcement, and Lua script atomicity ensuring only token owners release locks.
4. **Race Condition Timeouts & Subscriber Cleanup:** Sub-second timeout resolution, listener unregistration (`off('message')`), fast-path double-check cache return, and zero subscriber memory leaks.
