-- ReconciliationReviewStatus + review fields
ALTER TABLE "CreditReconciliationRecord" ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "CreditReconciliationRecord" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "CreditReconciliationRecord" ADD COLUMN "reviewedByName" TEXT;
ALTER TABLE "CreditReconciliationRecord" ADD COLUMN "reviewedAt" DATETIME;
ALTER TABLE "CreditReconciliationRecord" ADD COLUMN "rejectReason" TEXT;

-- ShippingMethod.ON_SITE_STOCKING is stored as text; no schema change required
