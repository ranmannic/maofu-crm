import "dotenv/config";
import { syncPerformanceData } from "../src/lib/performance";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("开始同步业绩历史数据...");
  await syncPerformanceData();
  const count = await prisma.performanceRecord.count();
  const recCount = await prisma.creditReconciliationRecord.count({
    where: { performanceAmount: { gt: 0 } },
  });
  console.log(`同步完成：PerformanceRecord ${count} 条，已回填核销业绩 ${recCount} 条`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
