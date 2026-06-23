-- Refund fields, performance records, reconciliation performance tracking

-- AlterTable Order - refund fields
ALTER TABLE "Order" ADD COLUMN "refundStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Order" ADD COLUMN "refundAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "refundedAt" DATETIME;

-- AlterTable CreditReconciliationRecord
ALTER TABLE "CreditReconciliationRecord" ADD COLUMN "performanceAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "CreditReconciliationRecord" ADD COLUMN "paidAt" DATETIME;

-- CreateTable PerformanceRecord
CREATE TABLE "PerformanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "salesId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "eventAt" DATETIME NOT NULL,
    "reconciliationRecordId" TEXT,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PerformanceRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PerformanceRecord_reconciliationRecordId_fkey" FOREIGN KEY ("reconciliationRecordId") REFERENCES "CreditReconciliationRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PerformanceRecord_reconciliationRecordId_key" ON "PerformanceRecord"("reconciliationRecordId");
CREATE INDEX "PerformanceRecord_salesId_eventAt_type_idx" ON "PerformanceRecord"("salesId", "eventAt", "type");
CREATE INDEX "PerformanceRecord_orderId_idx" ON "PerformanceRecord"("orderId");
