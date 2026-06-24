#!/bin/sh
set -eu

DB_URL="${DATABASE_URL:-file:/data/prod.db}"
DB_PATH="${DB_URL#file:}"

mkdir -p "$(dirname "$DB_PATH")"

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

if [ "${RUN_SYNC:-false}" = "true" ]; then
  echo "[entrypoint] 执行业绩与客户状态回填..."
  npx tsx prisma/sync-performance.ts || true
  npx tsx prisma/sync-customer-status.ts || true
fi

echo "[entrypoint] 启动应用..."
exec "$@"
