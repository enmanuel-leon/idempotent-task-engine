-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "task_engine";

-- CreateTable
CREATE TABLE IF NOT EXISTS "merchant_account" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "api_key" VARCHAR(128) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "balance_cents" BIGINT NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "transaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "merchant_id" UUID NOT NULL,
    "webhook_event_id" UUID NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "reference" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "webhook_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "merchant_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "response_body" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_account_api_key_key" ON "merchant_account"("api_key");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "transaction_webhook_event_id_key" ON "transaction"("webhook_event_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "transaction_reference_key" ON "transaction"("reference");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "transaction_merchant_id_idx" ON "transaction"("merchant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "webhook_event_status_created_at_idx" ON "webhook_event"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_event_merchant_id_idempotency_key_key" ON "webhook_event"("merchant_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_webhook_event_id_fkey" FOREIGN KEY ("webhook_event_id") REFERENCES "webhook_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_event" ADD CONSTRAINT "webhook_event_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
