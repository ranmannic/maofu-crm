# 毛府酒庄 CRM — Docker 部署指南

本文档适用于 **线上 Docker / Docker Compose** 部署（阿里云 ECS、轻量应用服务器等），介绍从零部署、版本更新、数据备份与迁移策略。

> **备选方案**：不使用 Docker 时，见 [附录 A：PM2 传统部署](#附录-apm2-传统部署)。

---

## 目录

1. [架构概览](#1-架构概览)
2. [环境要求](#2-环境要求)
3. [首次部署](#3-首次部署)
4. [环境变量](#4-环境变量)
5. [日常运维](#5-日常运维)
6. [版本更新](#6-版本更新)
7. [生产数据保护与迁移](#7-生产数据保护与迁移)
8. [备份与恢复](#8-备份与恢复)
9. [回滚方案](#9-回滚方案)
10. [常见问题](#10-常见问题)

---

## 1. 架构概览

```
用户浏览器
    │
    ▼
Nginx 容器 (:80)  ──可选──▶  maofu-crm 容器 (:3000)
    │                              │
    │         或宿主机 Nginx 反代 ───┘
    ▼
Docker Volume: maofu-crm-data
    └── /data/prod.db   （SQLite，持久化）
```

| 组件 | 说明 |
|------|------|
| `Dockerfile` | 多阶段构建 Next.js standalone + Prisma |
| `docker-compose.yml` | 应用容器 + 可选 Nginx |
| `docker/entrypoint.sh` | 启动前自动 `migrate deploy`，支持空卷初始化 |
| SQLite | 数据库文件挂载在命名卷 `/data/prod.db`，**不随镜像更新丢失** |

---

## 2. 环境要求

| 项目 | 最低建议 |
|------|----------|
| 规格 | 2 vCPU / 2 GB 内存 |
| 系统 | Alibaba Cloud Linux 3 / Ubuntu 22.04+ / 任意支持 Docker 的 Linux |
| Docker | **24+** |
| Docker Compose | **v2+**（`docker compose` 命令） |
| 磁盘 | 40 GB+（含镜像、数据卷、备份） |
| 安全组 | 放行 22（SSH）、80/443（HTTP/S） |

### 2.1 安装 Docker（阿里云 Linux 3 示例）

```bash
sudo yum install -y docker docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER   # 重新登录后生效
docker --version
docker compose version
```

---

## 3. 首次部署

### 3.1 拉取代码

```bash
sudo mkdir -p /opt/maofu-crm
sudo chown -R $USER:$USER /opt/maofu-crm
cd /opt/maofu-crm
git clone https://github.com/ranmannic/maofu-crm.git .
```

### 3.2 配置环境变量

```bash
cp .env.docker.example .env
nano .env
```

**必改项：**

```env
JWT_SECRET=替换为 openssl rand -base64 32 生成的值
INIT_DB=true          # 首次部署空数据卷设为 true
RUN_SYNC=false
APP_PORT=3000
```

生成 JWT 密钥：

```bash
openssl rand -base64 32
```

### 3.3 构建并启动

**方式 A：仅应用容器**（宿主机已有 Nginx / 负载均衡反代 3000 端口）

```bash
docker compose up -d --build
```

**方式 B：应用 + 内置 Nginx 容器**（直接对外 80 端口）

```bash
docker compose --profile nginx up -d --build
```

### 3.4 验证

```bash
docker compose ps
docker compose logs -f app --tail 50
curl -I http://127.0.0.1:3000/login
```

浏览器访问 `http://服务器IP:3000`（或 Nginx 80 端口）。

### 3.5 宿主机 Nginx 反代（可选）

若使用方式 A，在宿主机配置：

```nginx
# /etc/nginx/conf.d/maofu-crm.conf
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

HTTPS 推荐使用 certbot 或阿里云证书服务。

### 3.6 首次初始化说明

容器启动时 `entrypoint.sh` 会：

1. 若数据卷为空且 `INIT_DB=true` → 从 `prisma/init.db` 复制内置业务快照（含当前演示环境的全部业务数据）
2. 执行 `npx prisma migrate deploy` 同步表结构（若快照 schema 略旧，会自动补齐 migration）
3. 若 `RUN_SYNC=true` → 执行业绩与客户状态回填

**维护初始化快照**（开发机有最新演示数据时，发布前执行）：

```bash
# 确保本地 dev.db 已 migrate 且数据完整
npx prisma migrate deploy
npm run db:export-init   # 将 dev.db 复制为 prisma/init.db
git add prisma/init.db
```

> `prisma/init.db` 仅含 SQLite 业务数据，**不含** `data/uploads/` 下的凭证图片/PDF 文件。新环境首次部署后凭证需重新上传，或另行备份 uploads 目录。

**首次部署完成后**，请将 `.env` 中改为：

```env
INIT_DB=false
```

> ⚠️ **已有业务数据的环境切勿设 `INIT_DB=true`**，否则会覆盖数据卷中的 `prod.db`。

### 3.7 修改默认密码

登录后使用演示账号 `admin / 123456`，**立即在「账号管理」修改全部默认密码**。

---

## 4. 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `JWT_SECRET` | 是 | 会话签名密钥，至少 32 位随机字符串 |
| `INIT_DB` | 首次 | `true` 时空数据卷从 `prisma/init.db` 初始化（含演示客户、订单、跟进、收货地址等）；之后必须为 `false` |
| `RUN_SYNC` | 否 | `true` 时每次启动执行业绩/客户状态回填（升级时可临时开启） |
| `APP_PORT` | 否 | 宿主机映射端口，默认 `3000` |
| `NGINX_HTTP_PORT` | 否 | Nginx profile 对外端口，默认 `80` |

容器内固定：

```env
DATABASE_URL=file:/data/prod.db
```

数据库文件位于 Docker 命名卷 `maofu-crm-data`，与镜像、代码目录分离。

---

## 5. 日常运维

```bash
cd /opt/maofu-crm

# 查看状态
docker compose ps

# 查看日志
docker compose logs -f app
docker compose logs -f nginx   # 若启用了 nginx profile

# 重启
docker compose restart app

# 停止 / 启动
docker compose down
docker compose up -d
```

### 容器内执行维护命令

```bash
# 业绩回填
docker compose exec app npx tsx prisma/sync-performance.ts

# 成交客户状态同步
docker compose exec app npx tsx prisma/sync-customer-status.ts

# 查看 migration 状态
docker compose exec app npx prisma migrate status
```

> ⚠️ **禁止**在生产环境执行 `db:init` / `db:seed` / `db:reset`（会覆盖或清空数据）。

---

## 6. 版本更新

每次发布新版本：

```bash
cd /opt/maofu-crm

# 1. 备份数据库（必做，见第 8 节）
./scripts/backup-docker-db.sh

# 2. 拉取新代码
git fetch origin && git pull origin main

# 3. 重建镜像并滚动重启
docker compose build --no-cache
docker compose up -d

# 4. 若本次含 schema 变更或业绩/跟进模块升级，执行回填
docker compose exec app npx tsx prisma/sync-performance.ts
docker compose exec app npx tsx prisma/sync-customer-status.ts

# 5. 验证
docker compose logs app --tail 50
curl -I http://127.0.0.1:3000/login
```

### 更新检查清单

- [ ] 已备份数据卷中的 `prod.db`
- [ ] 已阅读本次 commit / 版本说明
- [ ] 确认是否涉及 `prisma/schema.prisma` 变更（entrypoint 会自动 `migrate deploy`）
- [ ] **未**设置 `INIT_DB=true`（除非明确要重置空库）
- [ ] 镜像重建成功、`docker compose ps` 显示 healthy
- [ ] v0.3+ 升级：已执行 `sync-performance`
- [ ] v0.5+ 升级：已执行 `sync-customer-status`
- [ ] v0.6+ 升级：确认收货地址、订单凭证、客户生日等新表已 migrate（entrypoint 自动执行）
- [ ] 抽查：首页统计、订单、账期核销、客户跟进、**收货信息**、**订单凭证**、**客户生日提醒**

### 6.1 临时开启启动时自动回填

在 `.env` 中设置 `RUN_SYNC=true`，执行 `docker compose up -d` 一次，完成后改回 `false`。

---

## 7. 生产数据保护与迁移

### 7.1 核心原则

| 原则 | 说明 |
|------|------|
| **数据在 Volume 中** | `prod.db` 存于 `maofu-crm-data` 卷，重建镜像/容器不丢数据 |
| **先备份再更新** | 每次 `git pull` + 重建镜像前备份 |
| **INIT_DB 仅首次** | 空库首次部署用 `INIT_DB=true`，之后永久 `false` |
| **禁止 seed/reset** | 勿在容器内执行 `db:seed` / `db:reset` / `db:init` |
| **单实例 SQLite** | 不要水平扩展多个写实例挂载同一库 |

### 7.2 Migration 机制

容器每次启动自动执行 `npx prisma migrate deploy`。  
开发侧变更 schema 后需提交 `prisma/migrations/` 到 Git，线上拉代码重建镜像即可。

### 7.3 版本特性与回填命令

| 版本 | 关键变更 | 升级后额外命令 |
|------|----------|----------------|
| v0.3+ | 业绩按收款时间、退款 | `sync-performance` |
| v0.4+ | 订单赠品、账期已结清 | 通常仅需 migrate |
| v0.5+ | 客户跟进、线索/成交状态 | `sync-customer-status` + `sync-performance`（若首页无数据） |
| v0.6+ | 客户收货地址、订单发货方式、订单凭证、客户生日 | 通常仅需 migrate；凭证文件存于 `data/uploads/`（不随 init.db 打包） |

详细字段说明见历史版本记录；当前仓库版本 **v0.6.0**。

### 7.4 生产允许 / 禁止的命令

| 命令 | Docker 生产环境 |
|------|-----------------|
| `docker compose exec app npx tsx prisma/sync-performance.ts` | ✅ 推荐 |
| `docker compose exec app npx tsx prisma/sync-customer-status.ts` | ✅ v0.5+ 推荐 |
| `docker compose exec app npm run db:init` | ❌ 覆盖全部数据 |
| `docker compose exec app npm run db:seed` | ❌ 禁止 |
| `docker compose exec app npm run db:reset` | ❌ 禁止 |

---

## 8. 备份与恢复

### 8.1 手动备份（推荐脚本）

```bash
chmod +x scripts/backup-docker-db.sh
./scripts/backup-docker-db.sh ./backups
```

脚本会从 `maofu-crm-data` 卷复制 `prod.db` 并 gzip 压缩。

### 8.2 定时备份（crontab）

```bash
crontab -e
```

```cron
0 3 * * * /opt/maofu-crm/scripts/backup-docker-db.sh /var/backups/maofu-crm >> /var/log/maofu-backup.log 2>&1
```

### 8.3 恢复数据库

```bash
cd /opt/maofu-crm
docker compose down

# 解压备份到临时文件
gunzip -c /var/backups/maofu-crm/prod_YYYYMMDD_HHMMSS.db.gz > /tmp/prod.db

# 写回数据卷
docker run --rm \
  -v maofu-crm-data:/data \
  -v /tmp/prod.db:/backup/prod.db:ro \
  alpine sh -c "cp /backup/prod.db /data/prod.db"

docker compose up -d
```

恢复后验证客户数、订单数与关键业务。

### 8.4 异地备份

定期将 `/var/backups/maofu-crm/*.gz` 上传至阿里云 OSS 或云盘快照。

---

## 9. 回滚方案

```bash
cd /opt/maofu-crm

# 1. 停止
docker compose down

# 2. 回滚代码
git log --oneline -5
git checkout <上一版本commit或tag>

# 3. 若数据库 migration 不可逆，恢复备份（见 8.3）

# 4. 重建并启动
docker compose build
docker compose up -d
```

---

## 10. 常见问题

### Q1：容器启动后立即退出

```bash
docker compose logs app
```

常见原因：`JWT_SECRET` 未设置、migration 失败、端口被占用。

### Q2：页面 502 / 无法访问

```bash
docker compose ps
curl -I http://127.0.0.1:3000/login
docker compose logs app --tail 100
```

确认 healthcheck 通过、安全组已放行端口。

### Q3：更新后 API 500 / Unknown field

entrypoint 已执行 migrate；若仍报错：

```bash
docker compose build --no-cache
docker compose up -d
docker compose exec app npx prisma migrate status
```

### Q4：首页数据为 0

1. 管理员首页默认「本月」统计，确认当月有订单/业绩
2. 执行 `sync-performance` 回填历史业绩

### Q5：客户跟进页无数据

确认已拉取 v0.5+ 代码并重建镜像；检查日志是否有 migration 错误。

### Q6：如何查看数据库文件

```bash
docker volume inspect maofu-crm-data
docker compose exec app ls -la /data/
```

### Q7：better-sqlite3 相关错误

镜像构建阶段已安装编译依赖；若自行修改 Dockerfile，需保留 `python3 make g++`。

---

## 附录 A：PM2 传统部署

不使用 Docker 时，可参考以下要点（完整步骤见 Git 历史或自行维护）：

- Node.js **22.x** + PM2 + 宿主机 Nginx
- 数据库路径：`/var/lib/maofu-crm/prod.db`
- 首次初始化：`npx prisma migrate deploy` → `npm run db:init`
- 更新：`git pull` → `npm ci` → `migrate deploy` → `npm run build` → `pm2 restart`

配置文件：`deploy/ecosystem.config.cjs`、`deploy/nginx-maofu-crm.conf.example`

---

## 附录 B：目录结构

```
/opt/maofu-crm/
├── Dockerfile
├── docker-compose.yml
├── docker/
│   └── entrypoint.sh
├── .env                    # 从 .env.docker.example 复制（不提交 Git）
├── deploy/
│   ├── nginx-docker.conf   # Compose nginx profile
│   └── nginx-maofu-crm.conf.example  # 宿主机 Nginx
├── prisma/
│   ├── init.db             # 首次 INIT_DB 用快照
│   └── migrations/
└── scripts/
    └── backup-docker-db.sh

Docker Volume: maofu-crm-data → /data/prod.db

凭证文件（若已上传）位于容器内 `/app/data/uploads/orders/`，**未**纳入 `init.db`。生产环境建议将 `data/uploads` 挂载为独立卷或定期备份。
```

---

## 附录 C：演示账号

| 角色 | 用户名 | 初始密码 |
|------|--------|----------|
| 管理员 | admin, liuyc | 123456 |
| 销售 | sales01, sales02 | 123456 |
| 职能 | ops01 | 123456 |

**上线后务必修改全部默认密码。**

`INIT_DB=true` 首次启动后，内置 `prisma/init.db` 快照（v0.6.0）含：

| 内容 | 说明 |
|------|------|
| 账号 | admin、liuyc（管理员），sales01/02（销售），ops01（职能），初始密码均为 `123456` |
| 客户 | 演示客户及渠道、跟进记录、部分客户生日 |
| 订单 | 含赠品、发货方式、收货地址快照、账期核销样例 |
| 收货地址 | 客户收货信息（`CustomerShippingAddress`） |
| 业绩 / 账期 | 历史收款、核销、业绩记录 |

凭证截图/PDF 需上线后自行上传（不在 init.db 中）。

---

GitHub Issues：https://github.com/ranmannic/maofu-crm/issues
