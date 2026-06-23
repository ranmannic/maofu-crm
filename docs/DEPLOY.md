# 毛府酒庄 CRM — 阿里云 Linux 部署指南

本文档适用于 **阿里云 ECS** + **Alibaba Cloud Linux 3**（或兼容的 RHEL/CentOS 系发行版），介绍从零部署、日常更新、以及**如何保证生产数据不丢失**。

---

## 目录

1. [架构概览](#1-架构概览)
2. [服务器要求](#2-服务器要求)
3. [首次部署（完整步骤）](#3-首次部署完整步骤)
4. [环境变量说明](#4-环境变量说明)
5. [进程管理与 Nginx](#5-进程管理与-nginx)
6. [后续版本更新部署](#6-后续版本更新部署)
7. [生产数据保护与迁移策略](#7-生产数据保护与迁移策略)
8. [备份与恢复](#8-备份与恢复)
9. [回滚方案](#9-回滚方案)
10. [常见问题](#10-常见问题)

---

## 1. 架构概览

```
用户浏览器
    │
    ▼
Nginx (:80 / :443)  ──反向代理──▶  Next.js (:3000, PM2)
                                        │
                                        ▼
                              SQLite 文件数据库
                              /var/lib/maofu-crm/prod.db
```

| 组件 | 说明 |
|------|------|
| Next.js 16 | 前后端一体，生产模式 `next start` |
| Prisma 7 + SQLite | 单文件数据库，适合中小规模 B 端 |
| PM2 | 守护进程、崩溃自动重启 |
| Nginx | 反向代理、HTTPS 终结 |

> **重要**：SQLite 数据库文件必须放在**持久化目录**（如 `/var/lib/maofu-crm/`），**不要**放在项目代码目录内，避免 `git pull` 时被覆盖或误删。

---

## 2. 服务器要求

| 项目 | 最低建议 |
|------|----------|
| 规格 | 2 vCPU / 2 GB 内存 |
| 系统 | Alibaba Cloud Linux 3 / CentOS 7+ / Rocky 8+ |
| 磁盘 | 40 GB+（含备份空间） |
| Node.js | **20.19+** 或 **22.x**（Prisma 7 硬性要求） |
| 安全组 | 放行 22（SSH）、80（HTTP）、443（HTTPS） |

---

## 3. 首次部署（完整步骤）

### 3.1 登录服务器并安装依赖

```bash
# 更新系统
sudo yum update -y

# 编译 better-sqlite3 所需工具
sudo yum groupinstall -y "Development Tools"
sudo yum install -y git nginx sqlite

# 安装 Node.js 22（推荐 NodeSource）
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo yum install -y nodejs

node -v   # 应 >= v20.19
npm -v
```

### 3.2 创建运行用户与目录

```bash
# 专用系统用户（可选但推荐）
sudo useradd -r -m -d /opt/maofu-crm -s /sbin/nologin maofu || true

# 代码目录
sudo mkdir -p /opt/maofu-crm
sudo chown -R $USER:$USER /opt/maofu-crm

# 数据目录（数据库持久化）
sudo mkdir -p /var/lib/maofu-crm
sudo mkdir -p /var/backups/maofu-crm
sudo chown -R $USER:$USER /var/lib/maofu-crm /var/backups/maofu-crm
```

### 3.3 拉取代码

```bash
cd /opt/maofu-crm
git clone https://github.com/ranmannic/maofu-crm.git .
# 若已有仓库：git pull origin main
```

### 3.4 配置环境变量

```bash
cp .env.example .env
nano .env
```

生产环境 `.env` 示例：

```env
DATABASE_URL="file:/var/lib/maofu-crm/prod.db"
JWT_SECRET="请替换为至少32位随机字符串"
```

生成随机 JWT 密钥：

```bash
openssl rand -base64 32
```

### 3.5 安装依赖并构建

```bash
cd /opt/maofu-crm
npm ci          # 比 npm install 更适合生产，严格按 lock 文件安装
npm run build   # 含 prisma generate + next build
```

### 3.6 初始化数据库（仅首次）

```bash
# 同步表结构到空库
npx prisma db push

# 写入演示账号与渠道数据（仅首次、空库时执行）
npm run db:seed
```

> ⚠️ **生产环境切勿再次执行 `npm run db:seed` 或 `npm run db:reset`**，否则会覆盖或清空业务数据。详见 [第 7 节](#7-生产数据保护与迁移策略)。

### 3.7 使用 PM2 启动

```bash
# 全局安装 PM2
sudo npm install -g pm2

# 使用项目自带配置（可按需修改 deploy/ecosystem.config.cjs 中的路径）
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup    # 按提示执行输出的命令，实现开机自启
```

验证：

```bash
pm2 status
curl -I http://127.0.0.1:3000/login
```

### 3.8 配置 Nginx

```bash
sudo cp deploy/nginx-maofu-crm.conf.example /etc/nginx/conf.d/maofu-crm.conf
sudo nano /etc/nginx/conf.d/maofu-crm.conf   # 修改 server_name 为实际域名

sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

### 3.9 配置 HTTPS（推荐）

```bash
# 阿里云 Linux 3 可使用 certbot
sudo yum install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 3.10 修改默认密码

登录 `https://your-domain.com`，使用演示账号 `admin / 123456` 登录后，**立即在「账号管理」中修改所有默认密码**。

---

## 4. 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | SQLite 路径，生产必须用绝对路径，如 `file:/var/lib/maofu-crm/prod.db` |
| `JWT_SECRET` | 是 | 会话签名密钥，生产环境必须强随机，更换后所有用户需重新登录 |

---

## 5. 进程管理与 Nginx

### 常用 PM2 命令

```bash
pm2 status                  # 查看状态
pm2 logs maofu-crm          # 查看日志
pm2 restart maofu-crm       # 重启应用
pm2 stop maofu-crm          # 停止
```

### 日志位置

- PM2 日志：`~/.pm2/logs/`
- Nginx 访问日志：`/var/log/nginx/access.log`
- Nginx 错误日志：`/var/log/nginx/error.log`

---

## 6. 后续版本更新部署

每次发布新版本，请严格按以下顺序操作：

```bash
cd /opt/maofu-crm

# ── 第 1 步：备份数据库（必做）──
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh /var/lib/maofu-crm/prod.db /var/backups/maofu-crm

# ── 第 2 步：拉取新代码 ──
git fetch origin
git checkout main
git pull origin main

# ── 第 3 步：安装依赖 ──
npm ci

# ── 第 4 步：数据库结构迁移（见第 7 节）──
# 若本次更新包含 prisma/schema.prisma 变更，执行其一：
npx prisma migrate deploy    # 推荐：有正式 migration 文件时
# 或
npx prisma db push           # 仅当开发侧尚未生成 migration、且已确认变更安全时

npx prisma generate

# ── 第 5 步：构建 ──
npm run build

# ── 第 6 步：重启服务 ──
pm2 restart maofu-crm

# ── 第 7 步：业绩数据初始化（含 PerformanceRecord 的版本升级后执行）──
npm run db:sync-performance

# ── 第 8 步：验证 ──
curl -I http://127.0.0.1:3000/login
pm2 logs maofu-crm --lines 50
```

### 更新检查清单

- [ ] 已备份 `prod.db`
- [ ] 已阅读本次更新的 CHANGELOG / commit 说明
- [ ] 确认是否涉及 `prisma/schema.prisma` 变更
- [ ] **未**执行 `db:seed` / `db:reset`
- [ ] 已执行 `npx prisma migrate deploy`（或 `db push`）+ `npx prisma generate`
- [ ] 构建成功、PM2 运行正常
- [ ] 若升级含业绩/退款模块：已执行 `npm run db:sync-performance`
- [ ] 登录并抽查：客户列表、订单列表、首页统计明细、账期核销页

### 6.1 两种更新路径

| 场景 | 数据库命令 |
|------|------------|
| 生产一直使用 `migrate deploy` 跟踪 migration | `npx prisma migrate deploy` |
| 生产此前仅用 `db push`、migration 历史与库不一致 | 备份后 `npx prisma db push` |

两种路径之后均需：

```bash
npx prisma generate
npm run build
pm2 restart maofu-crm
npm run db:sync-performance   # 回填历史业绩/核销业绩，首页统计依赖此步骤
```

> 若 `migrate deploy` 报 migration 冲突，**不要**强行 reset；改用 `db push` 或联系维护人员处理。

### 6.2 版本升级标准流程（含数据结构变更）

适用于本次及后续含 Prisma schema 变更的发布：

```bash
cd /opt/maofu-crm
./scripts/backup-db.sh /var/lib/maofu-crm/prod.db /var/backups/maofu-crm

git pull origin main
npm ci

# 1. 同步表结构（二选一，见 6.1）
npx prisma migrate deploy
# 或：npx prisma db push

# 2. 重新生成 Client（必须，否则 API 报 Unknown field）
npx prisma generate

# 3. 构建并重启
npm run build
pm2 restart maofu-crm

# 4. 初始化/回填业务数据（不修改账号、客户、产品、渠道）
npm run db:sync-performance

# 5. 验证
curl -I http://127.0.0.1:3000/login
```

**说明：**

| 命令 | 作用 | 是否覆盖业务主数据 |
|------|------|-------------------|
| `db:sync-performance` | 从核销记录/已收款订单回填 `PerformanceRecord`、补全核销业绩字段 | 否，仅补业绩记录 |
| `db:seed` | 写入演示账号与样例数据 | ⚠️ 会 upsert 演示配置，生产禁用 |
| `db:clear-orders` | 清空全部订单及账期库存 | 仅保留账号/客户/产品/渠道，生产慎用 |

> **重要**：`schema` 变更后必须 `prisma generate` + **重启 PM2**，否则首页/账期页可能出现 500（Prisma Client 与数据库不一致）。

---

## 7. 生产数据保护与迁移策略

这是本系统最容易出事故的部分，请仔细阅读。

### 7.1 核心原则

| 原则 | 说明 |
|------|------|
| **数据库与代码分离** | `prod.db` 放在 `/var/lib/maofu-crm/`，不提交 Git、不随代码更新覆盖 |
| **先备份再变更** | 任何 `migrate` / `db push` 前必须备份 |
| **生产禁止 seed/reset** | `npm run db:seed` 仅用于空库初始化；`db:reset` 会清空全部数据 |
| **软删除即数据保留** | 客户、订单删除均为软删除（`deletedAt`），历史订单不因客户删除而丢失 |
| **迁移可回滚** | 保留备份 + 上一版代码 tag，便于回滚 |

### 7.2 两种数据库变更方式对比

| 方式 | 命令 | 适用场景 | 风险 |
|------|------|----------|------|
| **Migration（推荐）** | `prisma migrate deploy` | 生产标准流程；有版本化 SQL 文件 | 低，可审计、可重复 |
| **DB Push** | `prisma db push` | 开发环境快速同步；小型 additive 变更 | 中，无历史 migration 记录 |

**推荐工作流（开发 → 生产）：**

```bash
# 开发机：schema 变更后生成 migration
npx prisma migrate dev --name describe_your_change

# 提交 migration 文件到 Git
git add prisma/migrations/
git commit -m "db: add order deletedAt field"

# 生产机：仅 deploy，不 dev、不 seed
./scripts/backup-db.sh /var/lib/maofu-crm/prod.db /var/backups/maofu-crm
npx prisma migrate deploy
npm run build
pm2 restart maofu-crm
```

### 7.3 常见 schema 变更类型与处理

#### 新增字段（带默认值）

例如新增 `Order.shippingFee`、`Order.deletedAt`：

- Prisma migration 会自动 `ALTER TABLE ADD COLUMN`
- **现有行自动获得默认值**，业务数据不丢失
- 部署：`migrate deploy` → `build` → `restart`

#### 新增枚举值

例如 `PaymentStatus` 增加 `PARTIAL`：

- SQLite 通常需重建表，Prisma 会生成安全 SQL
- **必须先备份**；部署后检查历史订单的付款状态显示是否正常

#### 渠道结构变更（两级分类）

- 旧一级渠道不会自动删除；seed 脚本会迁移客户到新渠道
- **生产环境不要跑 seed**；应在管理后台手动调整渠道，或在维护窗口执行经过评审的 SQL/脚本

#### 账期核销与产品规格（v0.2+）

新增表：`CustomerInventory`、`OrderCreditLine`、`CreditReconciliationRecord`；`Order` 增加 `creditStatus`、坏账字段；`ProductSpec` 增加 `bottlesPerUnit`（折合瓶数）。

- 部署后**无需 seed**：打开「账期核销」页会自动补全符合条件的部分付款 / 未付款已发货订单
- 已有产品规格 `bottlesPerUnit` 默认为 1；整箱等规格请在「产品管理」中设置折合瓶数
- 若生产库此前仅用 `db push` 同步、未跑过 migration，见下方 [6.1 节](#61-两种更新路径)

#### 业绩按收款时间 & 退款（v0.3+）

新增：

- `Order`：`refundStatus`、`refundAmount`、`refundedAt`
- `PerformanceRecord` 表：按收款/核销时间记录业绩（`COLLECT` / `REFUND`）
- `CreditReconciliationRecord`：`performanceAmount`、`paidAt`

**生产升级步骤（在 migrate deploy 之后）：**

```bash
npm run db:sync-performance
pm2 restart maofu-crm
```

该命令会：

1. 从已有核销记录的 `detail` 回填 `performanceAmount`
2. 为历史已收款/已核销订单生成 `PerformanceRecord`
3. **不修改**客户、账号、产品、渠道、订单本体数据

首页统计、退款业绩、账期核销「计入业绩」均依赖 `PerformanceRecord`；升级后若首页无数据或报 500，请确认已执行上述命令且 PM2 已重启。

#### 仅清空订单（保留主数据）

维护场景（如测试环境重置订单、生产清账前已备份）：

```bash
./scripts/backup-db.sh /var/lib/maofu-crm/prod.db /var/backups/maofu-crm
npm run db:clear-orders
```

清空范围：全部订单、订单行、发货、审计、账期行、核销记录、业绩记录、客户账期库存。  
**保留**：User、Customer、Product、ProductSpec、ChannelType。

#### 重命名 / 删除字段

- **高风险**：可能导致数据丢失
- 应分两步：先加新字段并双写 → 迁移数据 → 再删旧字段
- 生产环境删除字段前务必确认无业务依赖

### 7.4 什么命令可以在生产执行 / 禁止执行

| 命令 | 生产环境 |
|------|----------|
| `npm run db:seed` | ❌ 禁止（会 upsert 演示数据，可能覆盖配置） |
| `npm run db:reset` | ❌ 禁止（清空全部数据） |
| `npm run db:sync-performance` | ✅ 升级后推荐（回填业绩，不改主数据） |
| `npm run db:clear-orders` | ⚠️ 仅维护窗口、已备份；清空全部订单 |
| `npx prisma migrate deploy` | ✅ 推荐 |
| `npx prisma db push` | ⚠️ 谨慎，仅 additive 小变更且已备份 |
| `npx prisma generate` | ✅ 安全 |
| `npm run build` | ✅ 安全 |
| `./scripts/backup-db.sh` | ✅ 强烈推荐 |

### 7.5 零停机更新建议（可选）

本系统为单实例 SQLite，无法真正多实例写扩展。更新时：

1. 选择业务低峰期（如凌晨）
2. `pm2 stop maofu-crm` → 备份 → 迁移 → 构建 → `pm2 start maofu-crm`
3. 停机窗口通常 1～3 分钟

若需更短停机，可先 `build` 完成后再短暂 stop/start。

---

## 8. 备份与恢复

### 8.1 手动备份

```bash
./scripts/backup-db.sh /var/lib/maofu-crm/prod.db /var/backups/maofu-crm
```

### 8.2 定时自动备份（crontab）

```bash
crontab -e
```

添加（每天凌晨 3 点备份，保留 30 天）：

```cron
0 3 * * * /opt/maofu-crm/scripts/backup-db.sh /var/lib/maofu-crm/prod.db /var/backups/maofu-crm >> /var/log/maofu-backup.log 2>&1
```

### 8.3 异地备份（强烈建议）

- 使用阿里云 OSS：`ossutil cp` 定期上传 `/var/backups/maofu-crm/*.gz`
- 或挂载云盘快照策略

### 8.4 恢复数据库

```bash
pm2 stop maofu-crm

# 解压备份
gunzip -c /var/backups/maofu-crm/prod_YYYYMMDD_HHMMSS.db.gz > /var/lib/maofu-crm/prod.db

pm2 start maofu-crm
```

恢复后请验证订单数、客户数与关键业务数据。

---

## 9. 回滚方案

若新版本上线后出现严重问题：

```bash
cd /opt/maofu-crm

# 1. 停止服务
pm2 stop maofu-crm

# 2. 回滚代码到上一版本
git log --oneline -5          # 查看 commit
git checkout <上一版本commit或tag>

# 3. 若数据库已被 migrate 破坏，恢复备份（见 8.4）
#    若仅代码问题、数据库未变，可跳过此步

# 4. 重新安装与构建
npm ci
npm run build

# 5. 启动
pm2 start maofu-crm
```

> 若新版本执行了**不可逆**的数据库 migration（如删列），仅靠代码回滚不够，**必须恢复备份**。

---

## 10. 常见问题

### Q1：构建时报 `Prisma only supports Node.js versions 20.19+`

Node 版本过低。执行：

```bash
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo yum install -y nodejs
```

### Q2：`better-sqlite3` 编译失败

确保已安装编译工具：

```bash
sudo yum groupinstall -y "Development Tools"
npm rebuild better-sqlite3
```

### Q3：页面 502 Bad Gateway

```bash
pm2 status                    # 确认进程在运行
pm2 logs maofu-crm --lines 100
curl http://127.0.0.1:3000/login  # 直连 Next.js
sudo nginx -t && sudo systemctl status nginx
```

### Q4：更新后 API 报 `Unknown field` / Prisma 校验错误 / 首页 500

通常是 **Prisma Client 未重新生成** 或 **进程未重启**：

```bash
npx prisma migrate deploy   # 或 db push
npx prisma generate
npm run build
pm2 restart maofu-crm
npm run db:sync-performance
```

### Q4b：首页无业绩数据 / 核销记录业绩显示 NaN

历史订单未生成 `PerformanceRecord` 或核销业绩未回填：

```bash
npm run db:sync-performance
pm2 restart maofu-crm
```

刷新首页（切换「本月」查看）和账期核销页即可。

### Q5：管理员删除客户失败

已修复为软删除。若仍失败，检查 PM2 日志；确保未使用旧版硬删除逻辑。

### Q6：数据库文件权限错误

```bash
sudo chown -R $(whoami):$(whoami) /var/lib/maofu-crm
chmod 600 /var/lib/maofu-crm/prod.db
```

### Q7：账期核销页无数据 / 部分付款订单未出现

打开账期核销页时会自动同步符合条件的订单。若仍缺失：

1. 确认订单为**部分付款**，或**未付款且已发货**
2. 确认订单未结清（已全额收款的不会显示）
3. 重启应用确保 Prisma Client 已更新（见 Q4）

### Q8：未核销瓶数统计不准

在「产品管理 → 编辑规格」中设置**折合瓶数**（如整箱 6 瓶填 `6`）。

---

## 附录：目录结构（生产推荐）

```
/opt/maofu-crm/              # 应用代码（git 管理）
├── .env                     # 环境变量（不提交 Git）
├── deploy/
│   ├── ecosystem.config.cjs
│   └── nginx-maofu-crm.conf.example
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── scripts/
    ├── backup-db.sh
    └── (npm scripts: db:sync-performance, db:clear-orders)

/var/lib/maofu-crm/
└── prod.db                  # 生产数据库（持久化，不随 git pull 变化）

/var/backups/maofu-crm/
└── prod_*.db.gz             # 自动/手动备份
```

---

## 附录：演示账号（首次 seed 后）

| 角色 | 用户名 | 初始密码 |
|------|--------|----------|
| 管理员 | admin | 123456 |
| 销售 | sales01, sales02 | 123456 |
| 职能 | ops01 | 123456 |

**上线后务必修改全部默认密码。**

---

如有问题，请在 GitHub Issues 反馈：https://github.com/ranmannic/maofu-crm/issues
