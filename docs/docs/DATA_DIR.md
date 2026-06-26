# 毛府 CRM 业务数据目录

本目录由 Docker Compose 挂载，**不要**放入 Git 仓库。

## 目录结构

```
maofu_crm_data/
├── db/
│   └── prod.db          # SQLite 主库
└── uploads/
    ├── orders/          # 订单凭证
    └── products/        # 产品图片
```

## 配置

在 `maofu_crm_main/.env` 中：

```env
DATA_DIR=/data/service/maofu/maofu_crm/maofu_crm_data
```

## 从旧 Docker 卷迁移

```bash
cd /data/service/maofu/maofu_crm/maofu_crm_main
bash scripts/migrate-docker-volumes-to-host.sh
```

## 备份

```bash
cd /data/service/maofu/maofu_crm/maofu_crm_main
bash scripts/backup-data.sh
```
