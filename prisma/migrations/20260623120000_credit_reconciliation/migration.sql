-- CreateTable
CREATE TABLE "ChannelType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChannelType_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ChannelType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderAuditLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerInventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productSpecId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "specName" TEXT NOT NULL,
    "unitType" TEXT NOT NULL DEFAULT 'BOTTLE',
    "unreconciledQty" INTEGER NOT NULL DEFAULT 0,
    "reconciledQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerInventory_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderCreditLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productSpecId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "specName" TEXT NOT NULL,
    "unitType" TEXT NOT NULL DEFAULT 'BOTTLE',
    "orderQty" INTEGER NOT NULL,
    "unreconciledQty" INTEGER NOT NULL DEFAULT 0,
    "reconciledQty" INTEGER NOT NULL DEFAULT 0,
    "badDebtRecoveredQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderCreditLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditReconciliationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditReconciliationRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "channelId" TEXT,
    "address" TEXT,
    "salesId" TEXT NOT NULL,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Customer_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ChannelType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Customer_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Customer" ("address", "createdAt", "id", "name", "phone", "salesId", "updatedAt") SELECT "address", "createdAt", "id", "name", "phone", "salesId", "updatedAt" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "salesId" TEXT NOT NULL,
    "handlerId" TEXT,
    "productAmount" REAL NOT NULL DEFAULT 0,
    "shippingFee" REAL NOT NULL DEFAULT 0,
    "otherFee" REAL NOT NULL DEFAULT 0,
    "calculatedAmount" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL,
    "amountAdjustReason" TEXT,
    "productCostTotal" REAL NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "isShipped" BOOLEAN NOT NULL DEFAULT false,
    "orderedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    "notes" TEXT,
    "deletedAt" DATETIME,
    "creditStatus" TEXT,
    "badDebtAmount" REAL,
    "badDebtGoodsRecovered" BOOLEAN,
    "badDebtNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_handlerId_fkey" FOREIGN KEY ("handlerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("createdAt", "customerId", "customerName", "handlerId", "id", "isPaid", "isShipped", "notes", "orderNo", "orderedAt", "paidAmount", "paidAt", "salesId", "totalAmount", "updatedAt") SELECT "createdAt", "customerId", "customerName", "handlerId", "id", "isPaid", "isShipped", "notes", "orderNo", "orderedAt", "paidAmount", "paidAt", "salesId", "totalAmount", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNo_key" ON "Order"("orderNo");
CREATE TABLE "new_OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productSpecId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "specName" TEXT NOT NULL,
    "unitType" TEXT NOT NULL DEFAULT 'BOTTLE',
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL,
    "unitCost" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_productSpecId_fkey" FOREIGN KEY ("productSpecId") REFERENCES "ProductSpec" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_OrderItem" ("id", "orderId", "productId", "productName", "productSpecId", "quantity", "specName", "unitCost", "unitPrice") SELECT "id", "orderId", "productId", "productName", "productSpecId", "quantity", "specName", "unitCost", "unitPrice" FROM "OrderItem";
DROP TABLE "OrderItem";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
CREATE TABLE "new_ProductSpec" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitType" TEXT NOT NULL DEFAULT 'BOTTLE',
    "bottlesPerUnit" INTEGER NOT NULL DEFAULT 1,
    "price" REAL NOT NULL,
    "cost" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductSpec_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProductSpec" ("cost", "createdAt", "id", "name", "price", "productId", "updatedAt") SELECT "cost", "createdAt", "id", "name", "price", "productId", "updatedAt" FROM "ProductSpec";
DROP TABLE "ProductSpec";
ALTER TABLE "new_ProductSpec" RENAME TO "ProductSpec";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ChannelType_name_key" ON "ChannelType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerInventory_customerId_productSpecId_key" ON "CustomerInventory"("customerId", "productSpecId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderCreditLine_orderItemId_key" ON "OrderCreditLine"("orderItemId");

