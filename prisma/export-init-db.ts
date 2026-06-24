import "dotenv/config";
import fs from "fs";
import path from "path";

/** 将当前 DATABASE_URL 指向的数据库导出为 prisma/init.db（提交前运行） */
const src = (() => {
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  const dbPath = dbUrl.replace(/^file:/, "");
  return path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
})();

const dest = path.join(process.cwd(), "prisma/init.db");

if (!fs.existsSync(src)) {
  console.error(`源数据库不存在: ${src}`);
  process.exit(1);
}

fs.copyFileSync(src, dest);
const stat = fs.statSync(dest);
console.log(`已导出初始化数据库 → prisma/init.db (${(stat.size / 1024).toFixed(1)} KB)`);
