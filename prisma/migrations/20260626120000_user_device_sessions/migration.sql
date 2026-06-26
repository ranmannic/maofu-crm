-- 每用户按设备类型（移动端/电脑端）各保留一个有效会话
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "deviceKind" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserSession_userId_deviceKind_key" ON "UserSession"("userId", "deviceKind");
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");
