# 02. Database Schema & Isolation

## Shared Database Isolation Policy

The target PostgreSQL instance (`192.168.1.136:5434/app_template_db`) hosts other live demonstrations. Under no circumstances may tables in `public` or other schemas be dropped, altered, or accessed.

### Dedicated Schema: `task_engine`

All tables, sequences, indexes, and migrations for this project are created strictly within the dedicated namespace:

```sql
CREATE SCHEMA IF NOT EXISTS "task_engine";
```

Connection URI:

```
postgresql://root:root@192.168.1.136:5434/app_template_db?schema=task_engine
```

## Data Model Specifications

All monetary values follow the non-negotiable **Integer Cents Invariant** (stored as `BigInt` or `Int` cents, never floating point numbers).

### 1. `MerchantAccount`

- `id`: UUID (Primary Key)
- `apiKey`: VARCHAR(128) (Unique, Index)
- `name`: VARCHAR(100)
- `balanceCents`: BIGINT (Current ledger balance in integer cents)
- `currency`: VARCHAR(3) (e.g., "USD")
- `createdAt` / `updatedAt`: TIMESTAMPTZ

### 2. `Transaction`

- `id`: UUID (Primary Key)
- `merchantId`: UUID (Foreign Key -> `MerchantAccount.id`)
- `webhookEventId`: UUID (Unique Foreign Key -> `WebhookEvent.id`)
- `amountCents`: BIGINT (Transaction amount in integer cents)
- `reference`: VARCHAR(100) (Unique transaction identifier)
- `createdAt`: TIMESTAMPTZ

### 3. `WebhookEvent`

- `id`: UUID (Primary Key)
- `merchantId`: UUID (Foreign Key -> `MerchantAccount.id`)
- `idempotencyKey`: VARCHAR(255)
- `eventType`: VARCHAR(50) (e.g., `PAYMENT_SUCCEEDED`, `CHARGE_REFUNDED`)
- `status`: VARCHAR(20) (`PENDING`, `PROCESSING`, `COMPLETED`, `DEAD_LETTER`)
- `payload`: JSONB
- `responseBody`: JSONB (Nullable)
- `attempts`: INT (Default 0)
- `lastError`: TEXT (Nullable)
- `processedAt`: TIMESTAMPTZ (Nullable)
- `createdAt` / `updatedAt`: TIMESTAMPTZ

Constraints:

- Compound Unique Index: `[merchantId, idempotencyKey]`
- Status Index: `[status, createdAt]`
