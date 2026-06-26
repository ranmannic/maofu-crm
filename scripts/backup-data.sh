#!/usr/bin/env bash
# 备份宿主机数据目录（数据库 + 上传文件）
# 用法: ./scripts/backup-data.sh [备份目录]

set -euo pipefail

DATA_DIR="${DATA_DIR:-/data/service/maofu/maofu_crm/maofu_crm_data}"
BACKUP_DIR="${1:-/data/service/maofu/maofu_crm/backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
STAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"

if [ -f "$DATA_DIR/db/prod.db" ]; then
  cp -a "$DATA_DIR/db/prod.db" "$BACKUP_DIR/prod_${STAMP}.db"
  gzip -f "$BACKUP_DIR/prod_${STAMP}.db"
  echo "数据库备份: $BACKUP_DIR/prod_${STAMP}.db.gz"
else
  echo "警告: 未找到 $DATA_DIR/db/prod.db" >&2
fi

if [ -d "$DATA_DIR/uploads" ]; then
  tar czf "$BACKUP_DIR/uploads_${STAMP}.tar.gz" -C "$DATA_DIR/uploads" .
  echo "上传备份: $BACKUP_DIR/uploads_${STAMP}.tar.gz"
fi

find "$BACKUP_DIR" -name "prod_*.db.gz" -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true
