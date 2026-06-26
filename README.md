# 毛府酒庄订单与 CRM 管理后台（Docker 版）

基于 [maofu-crm-main](../maofu-crm-main) 模板创建，面向 **Docker / Docker Compose** 服务器部署。

## 技术栈

- Next.js 16 + TypeScript + Tailwind CSS
- Prisma 7 + SQLite
- JWT 会话认证 + 角色权限控制
- Docker 多阶段构建 + 数据卷持久化

## 服务器代码目录

```
/data/service/maofu/maofu_crm/maofu_crm_main
```

## 本地开发

> Node.js 要求 **20.19+** 或 **22.x**

```bash
cd maofu_crm_main
npm install
cp .env.example .env
npx prisma db push
npm run db:seed
npm run dev
```

访问 http://localhost:3001

## Docker 部署（推荐）

完整说明见 **[docs/DOCKER.md](./docs/DOCKER.md)**。

```bash
cd /data/service/maofu/maofu_crm/maofu_crm_main
cp .env.example .env
docker compose up -d --build
```

## 演示账号（密码均为 `123456`）

| 角色 | 用户名 | 权限 |
|------|--------|------|
| 管理员 | admin | 全功能 |
| 销售 | sales01, sales02 | 客户、下单、业绩、跟进 |
| 职能 | ops01 | 收款、发货、账期、职能工作台 |

## 主要功能（v0.9.0）

- **两级渠道管理**、**客户管理**（360 视图）、**客户跟进**
- **订单管理**（赠品行、凭证、分享链接、Excel 导出）
- **产品档案**（图片、参数、规格、分享页）
- **职能工作台**、**账期核销**（复核流程）
- **数据概览**、**退款管理**、**权限隔离**
- **移动端适配**、水墨中国风 UI

## 数据持久化

业务数据保存在宿主机目录 **`/data/service/maofu/maofu_crm/maofu_crm_data`**（可在 `.env` 中通过 `DATA_DIR` 修改）：

| 数据 | 宿主机路径 | 容器内路径 |
|------|------------|------------|
| SQLite 数据库 | `maofu_crm_data/db/prod.db` | `/data/prod.db` |
| 上传文件（凭证/产品图） | `maofu_crm_data/uploads/` | `/app/data/uploads/` |

从旧 Docker 命名卷迁移见 `scripts/migrate-docker-volumes-to-host.sh`；日常备份见 `scripts/backup-data.sh`。

## 环境变量（.env）

```env
APP_PORT=3001
JWT_SECRET=...
COOKIE_SECURE=false   # HTTP 访问；HTTPS 后改 true
AUTO_SEED=false
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `docker compose build && docker compose up -d` | 构建并启动 |
| `npm run db:sync-performance` | 回填业绩 |
| `npm run db:sync-customer-status` | 回填客户状态 |
