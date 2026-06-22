import { prisma } from "./prisma";

export async function logOrderChange(
  orderId: string,
  userId: string,
  userName: string,
  action: string,
  changes?: Record<string, unknown>
) {
  await prisma.orderAuditLog.create({
    data: {
      orderId,
      userId,
      userName,
      action,
      changes: changes ? JSON.stringify(changes) : null,
    },
  });
}
