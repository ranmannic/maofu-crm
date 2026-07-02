# 毛府酒庄 CRM — Docker 部署指南

本文档适用于 **线上 Docker / Docker Compose** 部署（阿里云 ECS、轻量应用服务器等），介绍从零部署、版本更新、数据备份与迁移策略。

> **备选方案**：不使用 Docker 时，见 [附录 A：PM2 传统部署](#附录-apm2-传统部署)。

---

## ⚠️ 数据安全必读（部署前请通读）

| 场景 | 正确做法 | 错误做法（可能导致数据丢失或灌入演示数据） |
|------|----------|---------------------------------------------|
| **首次部署（空服务器）** | `.env` 设 `INIT_DB=true`，启动后**立即改回** `INIT_DB=false` | 长期保持 `INIT_DB=true`（误删库后会自动恢复为演示快照） |
| **已有业务数据的生产环境** | `INIT_DB=false`；更新前**先备份** `prod.db` 与 uploads 卷 | 执行 `db:init` / `db:seed` / `db:reset` |
| **版本更新** | `git pull` → 备份 → `docker compose build` → `up -d`；由 entrypoint 自动 `migrate deploy` | 在容器内 `prisma db push --accept-data-loss` |
| **开发机维护 init 快照** | 仅在**无生产数据**的开发库上 `npm run db:export-init`，用于新环境演示 | 用含真实客户手机号的 prod.db 导出并提交 `init.db` |

**核心原则：生产数据只存在于 Docker 卷中，不在 Git 仓库里。** 任何会「覆盖整库」或「清空表」的命令，都只能在本地开发环境使用。

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

Docker Volume: maofu-crm-uploads
    └── /app/data/uploads/   （订单凭证、产品相册等上传文件）
```

| 组件 | 说明 |
|------|------|
| `Dockerfile` | 多阶段构建 Next.js standalone + Prisma |
| `docker-compose.yml` | 应用容器 + 可选 Nginx |
| `docker/entrypoint.sh` | 启动前自动 `migrate deploy`，支持空卷初始化 |
| SQLite | 数据库文件挂载在命名卷 `/data/prod.db`，**不随镜像更新丢失** |
| 上传文件 | 产品相册、订单凭证等存于 `maofu-crm-uploads` 卷 `/app/data/uploads/`，**需与数据库一并备份** |

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

### 3.6 首次初始化说明（重要）

容器启动时 `entrypoint.sh` 会：

1. **仅当数据卷中不存在 `prod.db` 时**，若 `INIT_DB=true` → 从 `prisma/init.db` 复制内置演示快照
2. 若数据卷为空且 `INIT_DB=false` → 创建空库，再执行 migration
3. 若 **`prod.db` 已存在** → **不会**因 `INIT_DB=true` 而覆盖（但仍建议生产永久设 `false`，避免误删库后自动灌入演示数据）
4. 执行 `npx prisma migrate deploy` 同步表结构
5. 若 `RUN_SYNC=true` → 执行业绩与客户状态回填

#### 初始化流程示意

```
空数据卷首次启动
    │
    ├─ INIT_DB=true  ──▶ 复制 prisma/init.db → /data/prod.db（演示数据）
    │
    └─ INIT_DB=false ──▶ 创建空 prod.db
            │
            ▼
    prisma migrate deploy（补齐表结构）
            │
            ▼
    应用启动（需自行创建账号或通过 seed，生产推荐 INIT_DB=true 仅用于演示/内测）
```

#### 维护开发侧 init 快照（可选，发布前）

仅用于**新环境快速体验**，快照内为演示数据，**不得**含真实客户隐私：

```bash
# 在开发机：确保 dev.db 已 migrate 且仅为演示/测试数据
npx prisma migrate deploy
npm run db:export-init   # 将 dev.db 复制为 prisma/init.db
git add prisma/init.db
```

> `prisma/init.db` 仅含 SQLite 业务数据，**不含** `data/uploads/` 下的上传文件。新环境首次部署后凭证、产品相册需重新上传，或从 uploads 卷备份恢复。

#### 首次部署完成后必做

```env
INIT_DB=false
```

并在「账号管理」（普通版）或「系统管理 → 账号管理」（高级版）中**修改全部默认密码**（见 [附录 C](#附录-c演示账号初始密码)）。

> ⚠️ **切勿在生产环境执行** `npm run db:init`：该命令会用 `init.db` **整库覆盖**当前 `DATABASE_URL` 指向的数据库，与 Docker entrypoint 的「空卷复制」不同，对已有 `prod.db` 是毁灭性操作。

---

## 4. 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `JWT_SECRET` | 是 | 会话签名密钥，至少 32 位随机字符串 |
| `INIT_DB` | 首次 | 见 [3.6 节](#36-首次初始化说明重要)。**仅空数据卷**时从 `init.db` 复制；`prod.db` 已存在则不会覆盖。生产环境长期保持 `false` |
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

> ⚠️ **禁止**在生产环境执行 `db:init` / `db:seed` / `db:reset` / `prisma db push --accept-data-loss`（会覆盖、清空或破坏数据）。本地开发可用 `db push`，生产仅依赖 migration。

---

## 6. 版本更新

### 6.0 生产更新安全流程（推荐按顺序执行）

```bash
cd /opt/maofu-crm

# 0. 确认 .env：INIT_DB=false，JWT_SECRET 已设置
grep -E '^INIT_DB|^JWT_SECRET' .env

# 1. 备份（必做）
./scripts/backup-docker-db.sh ./backups
# v0.8+ 同时备份 uploads 卷（见 8.4 节）

# 2. 拉取新代码
git fetch origin && git pull origin main

# 3. 阅读变更：是否含 prisma/migrations/ 新目录、是否需 RUN_SYNC
git log -1 --oneline
ls prisma/migrations/

# 4. 重建并启动（entrypoint 自动 migrate deploy）
docker compose build
docker compose up -d

# 5. 验证 migration 与日志
docker compose exec app npx prisma migrate status
docker compose logs app --tail 80

# 6. 按需回填（见 7.3 版本表）
docker compose exec app npx tsx prisma/sync-performance.ts
docker compose exec app npx tsx prisma/sync-customer-status.ts

# 7. 业务抽查
curl -I http://127.0.0.1:3000/login
# 登录后抽查：订单、账期核销、客户、职能工作台
```

**更新前禁止：**

- 在未备份的情况下 `docker volume rm maofu-crm-data`
- 在容器内 `npm run db:init` / `db:reset` / `db:seed`
- 使用开发命令 `prisma db push --accept-data-loss` 连接生产库

**更新后若异常：**

- 先查 `docker compose logs app` 与 `migrate status`
- Schema 与代码不匹配时，优先回滚代码 + 恢复备份（见第 9 节），勿强行 push

### 6.1 标准更新命令（简版）

每次发布新版本：

```bash
cd /opt/maofu-crm

# 1. 备份数据库与上传文件（必做，见第 8 节）
./scripts/backup-docker-db.sh
# v0.8+ 建议同时备份 uploads 卷（见 8.4 节）

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

- [ ] `.env` 中 **`INIT_DB=false`**（生产环境）
- [ ] 已备份数据卷中的 `prod.db`（及 uploads 卷，v0.8+）
- [ ] 已阅读本次 commit / 版本说明
- [ ] 确认是否涉及 `prisma/schema.prisma` 变更（entrypoint 会自动 `migrate deploy`）
- [ ] **未**执行 `db:init` / `db:seed` / `db:reset`
- [ ] 镜像重建成功、`docker compose ps` 正常
- [ ] `prisma migrate status` 无 failed migration
- [ ] v0.3+ 升级：已执行 `sync-performance`（如首页业绩为 0）
- [ ] v0.5+ 升级：已执行 `sync-customer-status`
- [ ] v0.6+ 升级：收货地址、凭证、生日等新表已 migrate
- [ ] v0.8+ 升级：确认 `maofu-uploads` 卷已挂载并备份
- [ ] v0.9+ 升级：核销审核（`ReconciliationReviewStatus`）、现场铺货发货方式；职能可管理产品、导出订单 Excel
- [ ] v1.0+ 升级：双版本/库存/客户政策/月度固定成本三个迁移已 `migrate deploy`（见 7.3.2）；新字段默认值正常，无需回填
- [ ] v1.1+ 升级：销售提成三个迁移已 `migrate deploy`（见 7.3.3）；高级版导航合并（系统管理、产品展示入口）；建议执行 `sync-performance` 确保提成统计有业绩数据
- [ ] v1.2+ 升级：库存重构四个迁移已 `migrate deploy`（见 [7.3.4](#734-v12-高级版库存重构重要)）；**已备份**；`INIT_DB=false`；升级后核对酒体 SKU、物料、规格库存依据
- [ ] 抽查：订单导出、账期核销待审核、职能工作台「核销待审核」提醒
- [ ] v1.1+ 抽查：高级版「系统管理」（渠道/账号）、「销售提成」规则与月度统计、产品管理→产品展示、职能账号产品展示
- [ ] v1.2+ 抽查：库存管理（酒体/物料/可售数）、销售库存一览、规格配置库存、发货扣库与回库、账期账龄 Tab
- [ ] 上线后登录页无默认密码提示；确认已修改全部账号密码

### 6.2 临时开启启动时自动回填

在 `.env` 中设置 `RUN_SYNC=true`，执行 `docker compose up -d` 一次，完成后改回 `false`。

---

## 7. 生产数据保护与迁移

### 7.1 核心原则

| 原则 | 说明 |
|------|------|
| **数据在 Volume 中** | `prod.db` 存于 `maofu-crm-data` 卷；上传文件存于 `maofu-crm-uploads` 卷，重建镜像/容器不丢数据 |
| **先备份再更新** | 每次 `git pull` + 重建镜像前备份 `prod.db` 与 uploads 卷 |
| **INIT_DB 仅用于空卷** | 只在**首次空数据卷**部署时用 `INIT_DB=true` 灌演示快照；之后永久 `false` |
| **init.db ≠ 生产备份** | `prisma/init.db` 是 Git 中的演示快照，**不能**用来恢复生产事故；生产恢复用 [8.3 节](#83-恢复数据库) 的 gzip 备份 |
| **禁止 seed/reset/init** | 勿在容器内执行 `db:seed` / `db:reset` / `db:init`（`db:init` 会整库覆盖，与 entrypoint 空卷逻辑不同） |
| **生产只用 migrate** | 表结构变更通过 `prisma migrate deploy`；禁止 `db push --accept-data-loss` |
| **单实例 SQLite** | 不要水平扩展多个写实例挂载同一库 |

### 7.1.1 误操作对照

| 操作 | 对已有 prod.db 的影响 |
|------|------------------------|
| `INIT_DB=true` 且 **prod.db 已存在** | 无影响（entrypoint 跳过复制） |
| 删除卷内 `prod.db` 后重启且 `INIT_DB=true` | **整库变为演示快照** |
| `npm run db:init`（任意环境指向 prod） | **整库被 init.db 覆盖** |
| `npm run db:reset` | **清空并重建** |
| `git pull` + `migrate deploy` | 安全（仅增量 DDL） |
| 恢复 gzip 备份到卷 | 安全（明确回滚点） |

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
| v0.7+ | 全站移动端适配（抽屉导航、订单卡片、紧凑筛选/统计） | 无 schema 变更，拉代码重建镜像即可 |
| v0.8+ | 职能工作台、产品相册/零售价/分享、客户 360、订单分享；uploads 卷 | 通常仅需 migrate；**务必挂载并备份 uploads 卷** |
| v0.9+ | 销售核销需审核、现场铺货、订单 Excel 导出、职能产品管理、管理员改客户手机号等 | 通常仅需 migrate（`20260623140000_reconciliation_review_on_site_stocking` 等） |
| v1.0+ | **普通版/高级版双版本**、高级版库存管理、客户政策（拿货价/备注）、首页自定义日期与盈利分析（月度固定成本）、分享改为复制链接/微信分享 | **仅需 migrate**（见下方 7.3.2）；新字段均有默认值，无需手动回填 |
| v1.1+ | **销售提成**（高级版 ADMIN）、高级版导航合并（系统管理、产品展示入口）、职能账号可访问产品展示 | **migrate + 建议 sync-performance**（见 7.3.3） |
| v1.2+ | **高级版库存重构**（酒体瓶/升、物料、规格库存依据、订单出库/回库联动）、账期账龄、销售库存一览、导航返回保留筛选、图片压缩 | **migrate only**（见 [7.3.4](#734-v12-高级版库存重构重要)）；升级前**必须备份**；升级后核对酒体 SKU 与规格库存依据 |

详细字段说明见历史版本记录；当前仓库含 v0.8.0 基线及后续功能迭代（含 v1.0 双版本、v1.1 销售提成、**v1.2 库存重构**）。

### 7.3.2 v1.0 数据结构变更与老数据兼容（重要）

本次升级**全部为增量变更，对已有生产数据安全**，由 entrypoint 的 `prisma migrate deploy` 自动按序执行，无需手动改库或回填：

| 迁移目录 | 变更内容 | 老数据初始化方式 |
|----------|----------|------------------|
| `20260626210000_premium_edition_inventory` | 新建 `AppSetting` 表（版本/试用状态）并写入 `global` 行；`ProductSpec` 新增 `stockQty` | 新表自动插入 `('global','STANDARD')`；`stockQty` 对已有规格 **DEFAULT 0** |
| `20260627041217_add_customer_price_policy_note` | 新建 `CustomerPricePolicyNote` 表（客户政策备注） | 全新表，按需写入；老客户无记录时前端展示「暂无」 |
| `20260627043839_add_monthly_fixed_cost` | `AppSetting` 增加 `monthlyFixedCost` | 表重定义经 `INSERT...SELECT` **保留原有版本/试用字段**；新列对已有行 **DEFAULT 0** |

> ✅ **数据安全要点**：
> - 三个迁移均为「新建表 / 加默认值列 / 表重定义保留旧数据」，不删除业务数据；
> - `add_monthly_fixed_cost` 虽为 SQLite 表重定义（drop+create），但通过 `INSERT INTO new_AppSetting ... SELECT ... FROM AppSetting` 完整保留试用/订阅状态；
> - 升级**无需** `RUN_SYNC`、无需 `sync-performance` / `sync-customer-status`（除非首页业绩历史数据为 0）；
> - 升级前仍**必须**按 [6.0 节](#60-生产更新安全流程推荐按顺序执行) 备份 `prod.db` 与 uploads 卷。

升级后抽查：高级版切换、库存管理（`/inventory`）、客户 360 客户政策、首页「订单毛利」毛利率与「点击盈利分析」、订单/产品「分享」弹窗复制链接。

### 7.3.3 v1.1 销售提成与导航调整（重要）

本次升级**对已有订单/客户/产品等业务数据安全**，由 entrypoint 的 `prisma migrate deploy` 自动按序执行三个迁移：

| 迁移目录 | 变更内容 | 老数据初始化方式 |
|----------|----------|------------------|
| `20260630142550_add_sales_commission_rules` | 新建 `SalesCommissionRule` 表（提成规则） | 全新表，线上默认无数据；不影响现有业务 |
| `20260630144014_commission_rules_sales_targets` | 规则改为「全部销售 / 指定销售」；新建 `SalesCommissionRuleSales` 关联表；移除 `channelId` | 若曾存在带 `salesId` 的旧规则，迁移脚本会写入关联表并将 `appliesToAllSales=false`；`channelId` 废弃（原未上线可忽略） |
| `20260630145235_perf_record_type_eventat_index` | `PerformanceRecord` 增加 `(type, eventAt)` 索引 | 仅加索引，不改数据 |

> ✅ **数据安全要点**：
> - 三个迁移均为「新建表 / 加索引 / 表重定义保留规则数据」，**不删除**订单、客户、业绩等业务数据；
> - 提成统计依赖 `PerformanceRecord`（收款/退款时增量写入）。若历史订单缺少业绩记录，升级后执行一次：
>   ```bash
>   docker compose exec app npx tsx prisma/sync-performance.ts
>   ```
> - **无需** `RUN_SYNC`、**无需** `sync-customer-status`（除非客户状态本身有问题）；
> - 升级前仍**必须**备份 `prod.db` 与 uploads 卷。

**功能与路由变更（高级版）：**

| 模块 | 说明 | 访问路径 |
|------|------|----------|
| 系统管理 | 合并渠道管理 + 账号管理（Tab 切换） | `/system`（**ADMIN**，高级版侧栏） |
| 销售提成 | 按产品/规格/销售配置规则；月度提成统计 | `/commissions`（**ADMIN**，高级版） |
| 产品展示 | 从侧栏隐藏；产品管理页右上角入口 | `/catalog`（ADMIN/OPERATIONS 从 `/products` 进入；SALES 仍保留侧栏） |

升级后抽查：高级版「系统管理」两个 Tab、销售提成规则保存与月度统计、产品管理→产品展示（含职能账号）、普通版侧栏仍为独立「渠道管理」「账号管理」「产品展示」。

### 7.3.4 v1.2 高级版库存重构（重要）

本次为**计划上生产线的版本**，含 4 个新迁移，由 entrypoint 的 `prisma migrate deploy` **按序自动执行**。对订单、客户、产品等核心业务数据为**增量变更**，但涉及 `ProductSpec` 表重定义与库存模型切换，**升级前必须备份**。

| 迁移目录 | 变更内容 | 老数据初始化方式 |
|----------|----------|------------------|
| `20260701120000_commission_global_default` | `SalesCommissionRule` 增加 `isGlobalDefault`；插入全局默认规则（3%） | 表重定义保留已有规则；若无全局默认则插入一条 |
| `20260701150000_stock_movements` | 新建 `StockMovement`（初版）；`Order.stockDeducted`；`ProductSpec.lowStockThreshold` | 新表空；新列 **DEFAULT** |
| `20260701180000_wine_material_inventory` | 新建 `Material`、`ProductWineStock`、`ProductSpecStockBasisLine`；**重建 `ProductSpec`**（移除 `stockQty`）；重建 `StockMovement`（酒体/物料维度） | 旧规格 `stockQty × bottlesPerUnit` **汇总为酒体瓶数**；每规格生成默认酒体依据行；无物料数据 |
| `20260701190000_wine_stock_sku_types` | `ProductWineStock` → **`WineStock`**（支持 **瓶 / 升** SKU）；依据行与流水增加 `wineSkuType` | 原瓶库存迁移为 `WineStock(skuType=BOTTLE)`；依据行默认 `BOTTLE` |

> ✅ **数据安全要点（生产必读）**
>
> 1. **升级前必做**：按 [6.0 节](#60-生产更新安全流程推荐按顺序执行) 备份 `prod.db` 与 uploads 卷；确认 `.env` 中 **`INIT_DB=false`**。
> 2. **只允许 migrate**：使用 `prisma migrate deploy`（容器 entrypoint 自动执行）。**禁止** `db:init` / `db:seed` / `db:reset` / `db push --accept-data-loss`（会覆盖或丢失生产数据）。
> 3. **init.db 不适用生产恢复**：`prisma/init.db` 仅为演示快照；生产事故恢复用 gzip 备份（见 [8.3 节](#83-恢复数据库)）。
> 4. **规格库存字段变更**：v1.0 的 `ProductSpec.stockQty` 已废弃；旧值在迁移时折算为**产品级酒体瓶数**，并写入默认「酒体 × bottlesPerUnit」依据行。迁移后请在「库存管理」核对酒体数量，并在「产品管理 → 规格 → 配置库存」按需补充物料依据。
> 5. **升级后需人工核对**（高级版）：
>    - 「库存管理 → 酒体库存」：确认各产品 **瓶 / 升** SKU 与数量；散酒需手动新增「升」SKU。
>    - 「库存管理 → 物料库存」：新建礼盒等物料并入库。
>    - 「产品管理」各规格「配置库存」：检查依据是否完整（仅迁移默认酒体行的规格显示已配置）。
> 6. **订单库存联动**：仅对**已配置库存依据**的规格，在发货时扣减酒体/物料；未配置规格显示「尚未配置」，不参与出库。已发货订单的 `stockDeducted` 新列默认 `false`，**不会**对历史订单追溯扣库。
> 7. **迁移失败恢复**：若 `20260701180000_wine_material_inventory` 报 `FOREIGN KEY constraint failed`（SQLite 重建规格表），先**不要**执行 `db:init`：
>    ```bash
>    docker compose exec app npx prisma migrate resolve --rolled-back 20260701180000_wine_material_inventory
>    docker compose up -d   # 重新 apply（当前仓库迁移脚本已含 PRAGMA foreign_keys=OFF）
>    ```
>    若仍失败，用备份恢复 `prod.db` 后联系维护者，**勿**手工删表。
> 8. **无需** `RUN_SYNC` / `sync-customer-status`；建议按需执行 `sync-performance`（提成统计）。

**功能与路由变更（高级版）：**

| 模块 | 说明 | 访问路径 |
|------|------|----------|
| 库存管理 | 酒体（瓶/升）、物料、规格最大可售数、流水 | `/inventory`（ADMIN/OPERATIONS） |
| 库存一览 | 销售只读查看各规格最大可售数 | `/stock-overview`（SALES） |
| 规格库存依据 | 产品管理 → 各规格「配置库存」 | 产品列表规格行 |
| 账期账龄 | 账期核销页 30/60/90 天账龄 Tab | `/credit` |

升级后抽查：创建酒体 SKU 并入库 → 配置规格依据（含物料）→ 库存管理「规格最大可售数」→ 销售「库存一览」→ 订单发货后酒体/物料扣减 → 取消发货回库。

### 7.3.1 功能与路由说明（v0.8+ / v0.9+）

| 模块 | 说明 | 访问路径 / 备注 |
|------|------|-----------------|
| 职能工作台 | 待发货、待收款、**核销待审核**、待核销；豆腐块可筛选 | `/workbench`（**OPERATIONS**；登录后自动跳转） |
| 产品管理 | 相册、规格、零售价体系；**高级版**右上角「产品展示」入口 | `/products`（**ADMIN**、**OPERATIONS**） |
| 产品展示 | 销售侧目录与分享链接；高级版 ADMIN/OPERATIONS 从产品管理进入 | `/catalog`（ADMIN、SALES、**OPERATIONS**） |
| 系统管理 | 渠道 + 账号（**高级版 ADMIN**） | `/system` |
| 销售提成 | 提成规则与月度统计（**高级版 ADMIN**） | `/commissions` |
| 账期核销 | 销售提交核销申请待审核；职能/管理员可直接核销 | `/credit` |
| 订单导出 | 按筛选条件导出 Excel；管理员含毛利字段 | 订单管理页（ADMIN、OPERATIONS） |
| 客户 360 | 客户概览、订单与跟进汇总 | `/customers/[id]` |

公开分享路由已在中间件放行，无需 JWT。分享链接由后台「分享」按钮生成并写入 `shareToken` 字段。

**上传文件目录**（容器内 `/app/data/uploads/`）：

| 子目录 | 内容 |
|--------|------|
| `orders/` | 订单收款凭证 |
| `products/` | 产品相册、规格缩略图 |

> v0.7 及更早版本若未挂载 uploads 卷，升级 v0.8 后请在 `docker-compose.yml` 中启用 `maofu-uploads` 卷并 `docker compose up -d`，此后上传文件将持久化；升级前容器内已有文件请先手动复制到新卷（见 8.4 节）。

### 7.4 生产允许 / 禁止的命令

| 命令 | Docker 生产环境 |
|------|-----------------|
| `docker compose exec app npx tsx prisma/sync-performance.ts` | ✅ 推荐 |
| `docker compose exec app npx tsx prisma/sync-customer-status.ts` | ✅ v0.5+ 推荐 |
| `docker compose exec app npm run db:init` | ❌ **整库覆盖**，与 entrypoint 空卷初始化不同 |
| `docker compose exec app npx prisma db push --accept-data-loss` | ❌ 可能丢列/丢数据 |
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

### 8.4 备份上传文件（v0.8+ 推荐）

产品相册与订单凭证存于 Docker 卷 `maofu-crm-uploads`，**不会**进入 `prod.db` 备份，需单独归档：

```bash
# 打包 uploads 卷
docker run --rm \
  -v maofu-crm-uploads:/uploads:ro \
  -v "$(pwd)/backups:/backup" \
  alpine sh -c "cd /uploads && tar czf /backup/uploads_$(date +%Y%m%d_%H%M%S).tar.gz ."

# 从 v0.7 升级且 uploads 仍在容器内时，先导出再挂卷
docker cp maofu-crm:/app/data/uploads ./backups/uploads-migrate
docker run --rm \
  -v maofu-crm-uploads:/uploads \
  -v "$(pwd)/backups/uploads-migrate:/src:ro" \
  alpine sh -c "cp -a /src/. /uploads/"
```

恢复 uploads：

```bash
docker compose down
docker run --rm \
  -v maofu-crm-uploads:/uploads \
  -v /path/to/uploads_backup.tar.gz:/backup.tar.gz:ro \
  alpine sh -c "rm -rf /uploads/* && tar xzf /backup.tar.gz -C /uploads"
docker compose up -d
```

### 8.5 异地备份

定期将 `/var/backups/maofu-crm/*.gz`（数据库 + uploads 压缩包）上传至阿里云 OSS 或云盘快照。

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

### Q8：手机端布局异常或输入框过宽

v0.7.0 起已适配移动端。更新后请 **强制刷新浏览器缓存**（或清除站点数据）后再测。  
若使用 CDN / Nginx 静态缓存，确认未缓存旧的 `_next/static` 资源过久。

### Q9：产品相册或分享页图片 404

1. 确认 `docker compose` 已挂载 `maofu-uploads` 卷（v0.8+）
2. 检查卷内文件：`docker compose exec app ls -la /app/data/uploads/products/`
3. 若从旧版升级，按 [8.4 节](#84-备份上传文件v08-推荐) 迁移 uploads

### Q10：职能账号登录后看不到工作台

职能账号（`ops01`）登录后应进入 `/workbench`；管理员账号不显示工作台菜单。确认用户角色为 **OPERATIONS**。

### Q11：误执行了 db:init 或删除了 prod.db

1. **立即停止**容器，避免继续写入
2. 从最近 gzip 备份恢复（[8.3 节](#83-恢复数据库)）
3. 若无备份，数据无法从 `init.db` 恢复真实业务（init 仅为演示快照）
4. 恢复后将 `.env` 设为 `INIT_DB=false`，排查为何会执行 init/删库

### Q12：migrate deploy 失败（P3009 / failed migration）

```bash
docker compose logs app
docker compose exec app npx prisma migrate status
```

在**已备份**前提下，根据 Prisma 文档处理 failed migration；勿在未备份时 `migrate resolve` 或手动改库。

---

不使用 Docker 时，可参考以下要点（完整步骤见 Git 历史或自行维护）：

- Node.js **22.x** + PM2 + 宿主机 Nginx
- 数据库路径：`/var/lib/maofu-crm/prod.db`
- 首次初始化：`npx prisma migrate deploy` → 空库时可选 `INIT_DB=true` 逻辑需自行复制 `init.db`；**勿对已有 prod.db 执行 `db:init`**
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
Docker Volume: maofu-crm-uploads → /app/data/uploads/

上传文件目录：
- `data/uploads/orders/` — 订单收款凭证
- `data/uploads/products/` — 产品相册、规格缩略图

**未**纳入 `init.db`。生产环境通过 `maofu-crm-uploads` 卷持久化，并与数据库一并定期备份（见 8.4 节）。
```

---

## 附录 C：演示账号（初始密码）

| 角色 | 用户名 | 初始密码 |
|------|--------|----------|
| 管理员 | admin, liuyc | 123456 |
| 销售 | sales01, sales02 | 123456 |
| 职能 | ops01 | 123456 |

**上线后务必在「账号管理」修改全部默认密码。** 登录页不再展示默认密码提示。

`INIT_DB=true` 且数据卷为空时，从 `prisma/init.db` 导入的快照含上述演示账号及样例客户、订单等；**不含**上传文件与真实生产数据。

---

GitHub Issues：https://github.com/ranmannic/maofu-crm/issues
