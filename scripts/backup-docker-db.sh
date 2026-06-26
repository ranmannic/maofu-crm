#!/usr/bin/env bash
# 兼容旧脚本：优先备份宿主机 DATA_DIR，否则尝试 Docker 卷
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$ROOT/scripts/backup-data.sh" ]; then
  exec bash "$ROOT/scripts/backup-data.sh" "$@"
fi
echo "请使用 scripts/backup-data.sh" >&2
exit 1
