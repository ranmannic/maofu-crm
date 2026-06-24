import fs from "fs";
import path from "path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

function resolveDbPath() {
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  const dbPath = dbUrl.replace(/^file:/, "");
  return path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
}

function getClientVersion() {
  try {
    const schemaStat = fs.statSync(path.join(process.cwd(), "prisma/schema.prisma"));
    const clientStat = fs.statSync(
      path.join(process.cwd(), "src/generated/prisma/internal/class.ts")
    );
    return `${schemaStat.mtimeMs}-${clientStat.mtimeMs}`;
  } catch {
    return "0";
  }
}

export function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({ url: resolveDbPath() });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaVersion?: string;
};

const clientVersion = getClientVersion();

if (
  process.env.NODE_ENV !== "production" &&
  globalForPrisma.prisma &&
  globalForPrisma.prismaSchemaVersion !== clientVersion
) {
  void globalForPrisma.prisma.$disconnect();
  globalForPrisma.prisma = undefined;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaVersion = clientVersion;
}
