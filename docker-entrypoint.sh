#!/bin/sh
set -eu

if [ -z "$DATABASE_URL" ]; then
  echo "错误: 未设置 DATABASE_URL 环境变量" >&2
  exit 1
fi

if [ -z "$JWT_SECRET" ]; then
  echo "错误: 未设置 JWT_SECRET 环境变量" >&2
  exit 1
fi

DB_URL="${DATABASE_URL}"
DB_PATH="${DB_URL#file:}"
DB_DIR="$(dirname "$DB_PATH")"
mkdir -p "$DB_DIR"

if [ ! -f "$DB_PATH" ]; then
  if [ "${INIT_DB:-false}" = "true" ] && [ -f prisma/init.db ]; then
    echo "[entrypoint] 数据卷为空，从 prisma/init.db 初始化..."
    cp prisma/init.db "$DB_PATH"
  else
    echo "[entrypoint] 数据卷为空，将创建新数据库..."
  fi
fi

echo "[entrypoint] 执行数据库 migration..."
npx prisma migrate deploy
echo "[entrypoint] migration 状态:"
npx prisma migrate status || true

if [ "$AUTO_SEED" = "true" ]; then
  echo "[entrypoint] AUTO_SEED=true，正在初始化演示数据..."
  npm run db:seed
fi

if [ "${RUN_SYNC:-false}" = "true" ]; then
  echo "[entrypoint] 执行业绩与客户状态回填..."
  npx tsx prisma/sync-performance.ts || true
  npx tsx prisma/sync-customer-status.ts || true
fi

echo "[entrypoint] 启动应用..."
mkdir -p /app/data/uploads/orders /app/data/uploads/products 2>/dev/null || true
exec node server.js
