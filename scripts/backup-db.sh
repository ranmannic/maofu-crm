#!/usr/bin/env bash
# SQLite 数据库备份脚本（生产环境使用）
# 用法: ./scripts/backup-db.sh /var/lib/maofu-crm/prod.db /var/backups/maofu-crm

set -euo pipefail

DB_PATH="${1:-/var/lib/maofu-crm/prod.db}"
BACKUP_DIR="${2:-/var/backups/maofu-crm}"
KEEP_DAYS="${KEEP_DAYS:-30}"

if [[ ! -f "$DB_PATH" ]]; then
  echo "错误: 数据库文件不存在: $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
TARGET="$BACKUP_DIR/prod_${STAMP}.db"

# 使用 SQLite 在线备份，避免复制不完整
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_PATH" ".backup '$TARGET'"
else
  cp -a "$DB_PATH" "$TARGET"
fi

gzip -f "$TARGET"
echo "备份完成: ${TARGET}.gz"

find "$BACKUP_DIR" -name "prod_*.db.gz" -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true
