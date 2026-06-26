# 毛府酒庄 CRM — Docker 部署指南

本文档说明如何使用 Docker / Docker Compose 将 **maofu_crm_main** 部署到 Linux 服务器。

---

## 架构概览

```
用户浏览器
    │
    ▼
Docker 宿主机 :3001  ──▶  maofu_crm_main 容器 (:3001)
                                │
                                ▼
                      宿主机 maofu_crm_data/
                      ├── db/prod.db
                      └── uploads/
```

| 组件 | 说明 |
|------|------|
| Next.js 16 | 生产模式 `node server.js`（standalone 构建） |
| Prisma 7 + SQLite | 单文件数据库，挂载至宿主机 `maofu_crm_data/db/` |
| Docker Compose | 一键构建、启动、重启 |

---

## 服务器要求

| 项目 | 最低建议 |
|------|----------|
| 系统 | Linux（Ubuntu 22.04+ / Debian 12+ / Alibaba Cloud Linux 3） |
| 内存 | 2 GB |
| 磁盘 | 20 GB+ |
| 软件 | Docker 24+、Docker Compose v2 |

安装 Docker（官方脚本）：

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 重新登录 SSH 后生效
```

---

## 阿里云构建加速（推荐）

首次构建约 5～15 分钟，主要耗时在 `npm ci` 与 `next build`。按以下配置可明显缩短**二次构建**时间。

### 1. 配置 Docker 镜像加速

编辑 `/etc/docker/daemon.json`：

```json
{
  "registry-mirrors": [
    "https://registry.cn-hangzhou.aliyuncs.com"
  ]
}
```

```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```

> 阿里云容器镜像服务 ACR 可获取专属加速地址，替换上方 URL 效果更好。

### 2. 开启 BuildKit 缓存

项目 Dockerfile 已启用 npm / Next.js 构建缓存，**必须**开启 BuildKit：

```bash
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# 写入 ~/.bashrc 持久生效
echo 'export DOCKER_BUILDKIT=1' >> ~/.bashrc
echo 'export COMPOSE_DOCKER_CLI_BUILD=1' >> ~/.bashrc
```

### 3. 使用国内 npm 镜像（已内置）

项目含 `.npmrc`，默认 `registry.npmmirror.com`。可在 `.env` 覆盖：

```env
NPM_REGISTRY=https://registry.npmmirror.com
```

### 4. 构建命令

```bash
cd /data/service/maofu/maofu_crm/maofu_crm_main

# 首次完整构建
DOCKER_BUILDKIT=1 docker compose build

# 仅改业务代码后重建（依赖层可命中缓存，通常 2～5 分钟）
DOCKER_BUILDKIT=1 docker compose up -d --build
```

### 5. 耗时参考

| 阶段 | 首次 | 二次（仅改 src） |
|------|------|------------------|
| npm ci | 3～8 分钟 | 缓存命中，秒级 |
| next build | 2～5 分钟 | 2～4 分钟 |
| better-sqlite3 编译 | 1～3 分钟 | 缓存命中，跳过 |

### 6. 低配 ECS 建议

- 规格至少 **2 vCPU / 2 GB**；1 核 1G 构建易 OOM 或极慢
- 构建时避免同时跑其他重负载服务
- 可加 2 GB swap 防止内存不足：

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 7. 构建卡在 `apt-get` 或报 Certificate verification failed

**原因**：直接用 HTTPS 阿里云源时，容器内尚无 CA 证书，会报 `Certificate verification failed`。

**当前 Dockerfile 已修复**：
1. 先用镜像内置 Debian 官方源安装 `ca-certificates`
2. 再切换阿里云 **HTTP** 源（`http://mirrors.aliyun.com`）

请上传最新 `Dockerfile` 与 `deploy/debian.aliyun.sources` 后重建：

```bash
export DOCKER_BUILDKIT=1
cd /data/service/maofu/maofu_crm/maofu_crm_main
docker compose build --no-cache
docker compose up -d
```

若 `npm ci` 报 `better-sqlite3` 编译错误（ARM 架构较常见），改用带编译工具的备用 Dockerfile：

```bash
docker build -f Dockerfile.with-build-tools -t maofu_crm_main:latest .
docker compose up -d
```

---

## 目录规划

| 路径 | 用途 |
|------|------|
| `/data/service/maofu/maofu_crm/maofu_crm_main` | 应用代码 |
| `/data/service/maofu/maofu_crm/maofu_crm_data` | **业务数据**（数据库 + 上传文件） |
| `/data/service/maofu/maofu_crm/maofu_crm_data/db/` | SQLite `prod.db` |
| `/data/service/maofu/maofu_crm/maofu_crm_data/uploads/` | 订单凭证、产品图片 |
| `/data/service/maofu/maofu_crm/backups` | 备份（建议） |

`.env` 中配置：

```env
DATA_DIR=/data/service/maofu/maofu_crm/maofu_crm_data
```

---

## 首次部署

### 1. 创建目录并上传代码

```bash
sudo mkdir -p /data/service/maofu/maofu_crm/maofu_crm_main
sudo mkdir -p /data/service/maofu/maofu_crm/maofu_crm_data/db
sudo mkdir -p /data/service/maofu/maofu_crm/maofu_crm_data/uploads
sudo mkdir -p /data/service/maofu/maofu_crm/backups
sudo chown -R $USER:$USER /data/service/maofu/maofu_crm
cd /data/service/maofu/maofu_crm/maofu_crm_main
```

**方式 A：Git 克隆**

```bash
git clone <your-repo-url> .
```

**方式 B：打包上传后解压**

```bash
cd /data/service/maofu/maofu_crm/maofu_crm_main
tar -xzf /path/to/maofu_crm_main.tar.gz --strip-components=1
```

### 2. 配置环境变量

```bash
cd /data/service/maofu/maofu_crm/maofu_crm_main
cp .env.example .env
nano .env
```

`.env` 示例：

```env
APP_PORT=3001
JWT_SECRET="请替换为至少32位随机字符串"
AUTO_SEED=true
DATA_DIR=/data/service/maofu/maofu_crm/maofu_crm_data
```

生成随机 JWT 密钥：

```bash
openssl rand -base64 32
```

> **AUTO_SEED**：仅**首次空库**部署时设为 `true`，写入演示账号与渠道数据。  
> 初始化完成后改回 `false` 并 `docker compose up -d`，避免重复 upsert。

### 3. 构建并启动

```bash
cd /data/service/maofu/maofu_crm/maofu_crm_main
docker compose up -d --build
```

### 4. 验证

```bash
docker compose ps
docker compose logs -f app
curl -I http://127.0.0.1:3001/login
```

浏览器访问 `http://服务器公网IP:3001`，使用 `admin / 123456` 登录，**立即修改密码**。

### 5. 关闭 AUTO_SEED

```bash
nano .env   # AUTO_SEED=false
docker compose up -d
```

---

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `JWT_SECRET` | 是 | 会话签名密钥，生产必须强随机 |
| `APP_PORT` | 否 | 宿主机映射端口，默认 `3001` |
| `AUTO_SEED` | 否 | `true` 时空库写入演示数据，默认 `false` |
| `INIT_DB` | 否 | `true` 且存在 `prisma/init.db` 时从快照初始化空库 |
| `RUN_SYNC` | 否 | `true` 时启动后执行业绩与客户状态回填，升级后推荐 |

容器内固定：

| 变量 | 值 |
|------|-----|
| `DATABASE_URL` | `file:/data/prod.db` |
| `NODE_ENV` | `production` |
| `PORT` | `3001` |

---

## 从 Docker 命名卷迁移到宿主机目录

若此前使用 `maofu_crm_main_data` / `maofu_crm_main_uploads` 卷：

```bash
cd /data/service/maofu/maofu_crm/maofu_crm_main
grep DATA_DIR .env || echo 'DATA_DIR=/data/service/maofu/maofu_crm/maofu_crm_data' >> .env
bash scripts/migrate-docker-volumes-to-host.sh
curl -s http://127.0.0.1:3001/api/health
```

确认无误后可删旧卷：`docker volume rm maofu_crm_main_data maofu_crm_main_uploads`

---

## 版本更新

```bash
cd /data/service/maofu/maofu_crm/maofu_crm_main

# 1. 备份
bash scripts/backup-data.sh

# 2. 拉取/上传新代码
git pull

# 3. 重建并启动
export DOCKER_BUILDKIT=1
docker compose build
docker compose up -d

# 4. 验证
docker compose logs --tail 50 app
curl -I http://127.0.0.1:3001/login
```

### 更新检查清单

- [ ] 已执行 `bash scripts/backup-data.sh`
- [ ] **未**设置 `AUTO_SEED=true`（生产）
- [ ] `DATA_DIR` 指向 `maofu_crm_data` 且目录可写
- [ ] 构建成功、容器健康
- [ ] 登录并抽查订单凭证、上传文件是否正常

---

## 数据备份与恢复

### 备份

```bash
cd /data/service/maofu/maofu_crm/maofu_crm_main
bash scripts/backup-data.sh
# 输出至 /data/service/maofu/maofu_crm/backups/
```

或手动：

```bash
DATA_DIR=/data/service/maofu/maofu_crm/maofu_crm_data
STAMP=$(date +%Y%m%d_%H%M%S)
cp -a "$DATA_DIR/db/prod.db" "/data/service/maofu/maofu_crm/backups/prod_${STAMP}.db"
tar czf "/data/service/maofu/maofu_crm/backups/uploads_${STAMP}.tar.gz" -C "$DATA_DIR/uploads" .
```

### 定时备份（crontab）

```cron
0 3 * * * cd /data/service/maofu/maofu_crm/maofu_crm_main && bash scripts/backup-data.sh
```

### 恢复

```bash
cd /data/service/maofu/maofu_crm/maofu_crm_main
docker compose stop app
cp /data/service/maofu/maofu_crm/backups/prod_YYYYMMDD.db /data/service/maofu/maofu_crm/maofu_crm_data/db/prod.db
# 上传: tar xzf backups/uploads_YYYYMMDD.tar.gz -C maofu_crm_data/uploads/
docker compose start app
```

---

## HTTPS 反向代理（可选）

建议在宿主机使用 Nginx 或 Caddy 终结 HTTPS，反代至 `127.0.0.1:3001`。

Nginx 示例：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 生产环境禁止执行的命令

| 命令 | 说明 |
|------|------|
| `npm run db:seed` | 生产勿用（会 upsert 演示数据） |
| `npm run db:reset` | 清空全部数据 |
| `docker compose down` 且误删 `maofu_crm_data` 目录 | 删除业务数据 |
| `rm -rf maofu_crm_data` | 删除数据库与全部上传 |

安全命令：

| 命令 | 说明 |
|------|------|
| `npm run db:sync-performance` | 升级后回填业绩 |
| `npm run db:sync-customer-status` | 升级后回填客户成交状态 |
| `npx prisma migrate deploy` | 由 entrypoint 自动执行 |

---

## 常见问题

### Q1：容器启动后立即退出

```bash
docker compose logs app
```

常见原因：`JWT_SECRET` 未设置。检查 `.env` 后 `docker compose up -d`。

### Q2：`better-sqlite3` / Could not locate the bindings file

**原因**：`npm ci --ignore-scripts` 跳过了 better-sqlite3 原生模块安装，导致 `db:seed` 和登录均 500。

**当前 Dockerfile 已修复**：`npm ci --ignore-scripts` 后会执行 `npm rebuild better-sqlite3`。

请重新构建镜像：

```bash
export DOCKER_BUILDKIT=1
cd /data/service/maofu/maofu_crm/maofu_crm_main
docker compose build --no-cache
docker compose up -d
docker compose exec app npm run db:seed
```

若 rebuild 预编译包仍失败，改用源码编译 Dockerfile：

```bash
docker build -f Dockerfile.with-build-tools -t maofu_crm_main:latest .
docker compose up -d
docker compose exec app npm run db:seed
```

### Q3：页面无法访问

```bash
docker compose ps
sudo ufw allow 3001/tcp   # 若启用防火墙
curl http://127.0.0.1:3001/login
# 检查云服务器安全组是否放行 3001
```

### Q4：登录报 500 / Internal Server Error

**401** 表示用户名密码错误或库中无账号；**500** 表示服务端异常（多为数据库问题）。

**第 1 步：健康检查**

```bash
curl -s http://127.0.0.1:3001/api/health
# 或在浏览器访问 https://crm.maofujiuzhuang.com/api/health
```

正常应返回：

```json
{"ok":true,"database":"connected","userCount":4,"hasAdmin":true}
```

若 `ok: false`，查看 `message` 字段和容器日志：

```bash
docker compose logs app --tail 100
```

**第 2 步：常见原因与处理**

| 现象 | 处理 |
|------|------|
| `unable to open database file` | 检查数据卷权限：`docker compose exec app ls -la /data/` |
| `no such column` / Prisma 字段错误 | 执行 migration 并重建：`docker compose up -d --build` |
| `userCount: 0` | 空库未初始化，临时设 `AUTO_SEED=true` 后 `docker compose up -d`，登录后改回 `false` |
| migration 失败 | `docker compose exec app npx prisma migrate status` |

**第 3 步：手动初始化演示账号（空库）**

```bash
docker compose exec app npm run db:seed
docker compose restart app
```

默认账号：`admin / 123456`

### Q5：更新后 API 500 / Unknown field

```bash
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma generate
docker compose up -d --build
docker compose exec app npm run db:sync-performance
docker compose exec app npm run db:sync-customer-status
```

---

## 目录结构

```
/data/service/maofu/maofu_crm/
├── maofu_crm_main/          # 应用代码
├── maofu_crm_data/          # 业务数据（持久化）
│   ├── db/prod.db           # SQLite
│   └── uploads/             # 凭证、产品图
└── backups/                 # 备份

| SQLite 数据库 | 宿主机 `maofu_crm_data/db/prod.db` | 容器内 `/data/prod.db` |
| 订单凭证（图片/PDF） | 宿主机 `maofu_crm_data/uploads/` | 容器内 `/app/data/uploads` |

删除容器不会丢失上述数据；请勿删除 `maofu_crm_data` 目录。
```
