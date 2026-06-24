#!/usr/bin/env bash
# 从 Docker 数据卷备份 SQLite 数据库
# 用法: ./scripts/backup-docker-db.sh [备份目录]

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
VOLUME_NAME="${VOLUME_NAME:-maofu-crm-data}"
KEEP_DAYS="${KEEP_DAYS:-30}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
TARGET="$BACKUP_DIR/prod_${STAMP}.db"

if ! docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
  echo "错误: Docker 卷不存在: $VOLUME_NAME" >&2
  echo "请先执行 docker compose up -d 创建数据卷" >&2
  exit 1
fi

docker run --rm \
  -v "${VOLUME_NAME}:/data:ro" \
  -v "$(cd "$BACKUP_DIR" && pwd):/backup" \
  alpine sh -c "
    if [ ! -f /data/prod.db ]; then
      echo '错误: /data/prod.db 不存在' >&2
      exit 1
    fi
    cp /data/prod.db /backup/prod_${STAMP}.db
  "

gzip -f "$TARGET"
echo "备份完成: ${TARGET}.gz"

find "$BACKUP_DIR" -name "prod_*.db.gz" -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true
