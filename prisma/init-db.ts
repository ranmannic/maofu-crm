import "dotenv/config";
import fs from "fs";
import path from "path";

function resolveDbPath() {
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  const dbPath = dbUrl.replace(/^file:/, "");
  return path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
}

const src = path.join(process.cwd(), "prisma/init.db");
const dest = resolveDbPath();

if (!fs.existsSync(src)) {
  console.error("未找到 prisma/init.db，请确认仓库已包含初始化数据库文件");
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log(`已从 prisma/init.db 初始化数据库 → ${dest}`);
console.log("提示：生产环境首次部署后请修改默认账号密码");
