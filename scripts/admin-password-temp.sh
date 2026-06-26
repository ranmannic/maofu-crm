#!/usr/bin/env bash
# 用户密码临时切换：备份哈希 → 123456 → 恢复
# 用法:
#   bash scripts/admin-password-temp.sh backup [用户名]    # 默认 admin
#   bash scripts/admin-password-temp.sh reset [用户名]     # 改为 123456
#   bash scripts/admin-password-temp.sh restore [用户名]   # 恢复原哈希
#   bash scripts/admin-password-temp.sh status [用户名]
#
# 示例（liuyc）:
#   bash scripts/admin-password-temp.sh backup liuyc
#   bash scripts/admin-password-temp.sh reset liuyc
#   bash scripts/admin-password-temp.sh restore liuyc

set -euo pipefail

ACTION="${1:-status}"
USERNAME="${2:-${USER:-admin}}"

if ! [[ "$USERNAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "错误: 用户名只能包含字母、数字、下划线、连字符" >&2
  exit 1
fi

BACKUP_IN_CONTAINER="/data/password_hash_${USERNAME}.bak"
DATA_HOST="\${DATA_DIR:-/data/service/maofu/maofu_crm/maofu_crm_data}/db/password_hash_${USERNAME}.bak"

cd "$(dirname "$0")/.."

run_node() {
  docker compose exec -T app node -e "$1"
}

echo "账号: $USERNAME"

case "$ACTION" in
  backup)
    run_node "
      const username='${USERNAME}';
      const Database=require('better-sqlite3');
      const fs=require('fs');
      const db=new Database('/data/prod.db');
      const r=db.prepare('SELECT password FROM User WHERE username=?').get(username);
      if(!r){console.error('用户不存在: '+username);process.exit(1);}
      fs.writeFileSync('${BACKUP_IN_CONTAINER}', r.password);
      console.log('backup ok -> ${BACKUP_IN_CONTAINER}');
    "
    echo "宿主机路径: $DATA_HOST"
    ;;
  reset)
    run_node "
      const username='${USERNAME}';
      const bcrypt=require('bcryptjs');
      const Database=require('better-sqlite3');
      bcrypt.hash('123456', 10).then(h => {
        const db=new Database('/data/prod.db');
        const r=db.prepare('UPDATE User SET password=? WHERE username=?').run(h, username);
        if(r.changes===0){console.error('用户不存在: '+username);process.exit(1);}
        console.log(username+' password set to 123456, updated rows:', r.changes);
      });
    "
    ;;
  restore)
    run_node "
      const username='${USERNAME}';
      const Database=require('better-sqlite3');
      const fs=require('fs');
      if(!fs.existsSync('${BACKUP_IN_CONTAINER}')){
        console.error('未找到备份 ${BACKUP_IN_CONTAINER}，请先执行 backup ${USERNAME}');
        process.exit(1);
      }
      const hash=fs.readFileSync('${BACKUP_IN_CONTAINER}','utf8').trim();
      const db=new Database('/data/prod.db');
      const r=db.prepare('UPDATE User SET password=? WHERE username=?').run(hash, username);
      if(r.changes===0){console.error('用户不存在: '+username);process.exit(1);}
      console.log('restored '+username+' original password hash, updated rows:', r.changes);
    "
    ;;
  status)
    if docker compose exec -T app test -f "$BACKUP_IN_CONTAINER" 2>/dev/null; then
      echo "备份存在: $BACKUP_IN_CONTAINER"
    else
      echo "备份不存在，请先: bash scripts/admin-password-temp.sh backup $USERNAME"
    fi
    ;;
  *)
    echo "用法: $0 {backup|reset|restore|status} [用户名]" >&2
    echo "示例: $0 reset liuyc" >&2
    exit 1
    ;;
esac
