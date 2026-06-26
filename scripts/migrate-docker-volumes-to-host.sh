#!/usr/bin/env bash
# 将旧 Docker 命名卷中的数据迁移到宿主机目录 maofu_crm_data
# 用法（在服务器上）:
#   cd /data/service/maofu/maofu_crm/maofu_crm_main
#   bash scripts/migrate-docker-volumes-to-host.sh

set -euo pipefail

DATA_DIR="${DATA_DIR:-/data/service/maofu/maofu_crm/maofu_crm_data}"
OLD_DB_VOLUME="${OLD_DB_VOLUME:-maofu_crm_main_data}"
OLD_UPLOADS_VOLUME="${OLD_UPLOADS_VOLUME:-maofu_crm_main_uploads}"
COMPOSE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "目标目录: $DATA_DIR"
mkdir -p "$DATA_DIR/db" "$DATA_DIR/uploads"

cd "$COMPOSE_DIR"
echo "[1/4] 停止容器..."
docker compose stop app 2>/dev/null || true

echo "[2/4] 迁移数据库..."
if docker volume inspect "$OLD_DB_VOLUME" >/dev/null 2>&1; then
  docker run --rm \
    -v "${OLD_DB_VOLUME}:/from:ro" \
    -v "${DATA_DIR}/db:/to" \
    alpine sh -c "
      if [ -f /from/prod.db ]; then
        cp -a /from/prod.db /from/prod.db-wal /from/prod.db-shm /to/ 2>/dev/null || cp -a /from/prod.db /to/
        ls -lh /to/
      else
        echo '旧卷中无 prod.db，跳过'
      fi
    "
else
  echo "旧数据库卷 $OLD_DB_VOLUME 不存在，跳过"
fi

echo "[3/4] 迁移上传文件..."
if docker volume inspect "$OLD_UPLOADS_VOLUME" >/dev/null 2>&1; then
  docker run --rm \
    -v "${OLD_UPLOADS_VOLUME}:/from:ro" \
    -v "${DATA_DIR}/uploads:/to" \
    alpine sh -c "cp -a /from/. /to/ 2>/dev/null || true; ls -la /to"
else
  echo "旧上传卷 $OLD_UPLOADS_VOLUME 不存在，跳过"
fi

echo "[4/4] 启动容器（使用新目录挂载）..."
docker compose up -d

echo ""
echo "迁移完成。数据目录:"
echo "  数据库: $DATA_DIR/db/prod.db"
echo "  上传:   $DATA_DIR/uploads/"
echo ""
echo "确认无误后，可删除旧卷（请先备份）:"
echo "  docker volume rm $OLD_DB_VOLUME $OLD_UPLOADS_VOLUME"
