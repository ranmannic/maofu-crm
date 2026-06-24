-- Customer status: LEAD (线索) / CLOSED (成交)

ALTER TABLE "Customer" ADD COLUMN "customerStatus" TEXT NOT NULL DEFAULT 'LEAD';

UPDATE "Customer"
SET "customerStatus" = 'CLOSED'
WHERE "id" IN (
  SELECT DISTINCT "customerId"
  FROM "Order"
  WHERE "deletedAt" IS NULL
    AND "paymentStatus" IN ('PAID', 'PARTIAL')
    AND "paidAmount" > 0
);
