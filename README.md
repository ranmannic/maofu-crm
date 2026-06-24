# 毛府酒庄订单与CRM管理后台

支持销售、职能、管理员三角色的 B 端订单与 CRM 管理系统。

## 技术栈

- Next.js 16 + TypeScript + Tailwind CSS
- Prisma 7 + SQLite
- JWT 会话认证 + 角色权限控制

## 快速开始（本地开发）

> Node.js 要求 **20.19+** 或 **22.x**

```bash
git clone https://github.com/ranmannic/maofu-crm.git
cd maofu-crm
npm install
cp .env.example .env
npx prisma db push
npm run db:seed
npm run dev
```

访问 http://localhost:3000

## 生产部署

详见 **[docs/DEPLOY.md](./docs/DEPLOY.md)**（阿里云 Linux 完整部署、更新流程、数据备份与迁移指南）。

## 演示账号（密码均为 `123456`）

| 角色 | 用户名 | 权限 |
|------|--------|------|
| 管理员 | admin | 全功能：渠道/产品/账号/客户转移与恢复/毛利分析 |
| 销售 | sales01, sales02 | 客户管理、下单、业绩同比曲线 |
| 职能 | ops01 | 订单收款、发货、运单、账期核销 |

## 主要功能

- **两级渠道管理**：团购/批发/直销/分销/特渠 + 12 类二级渠道
- **客户管理**：软删除/恢复、转移销售、手机号脱敏；删除客户不影响历史订单
- **订单管理**：产品金额 + 运费 + 其它费用；部分付款；软删除/恢复；修改审计
- **账期核销**：部分付款或未付款已发货订单自动纳入；按客户管理库存；付款核销与坏账处理；未核销数量统一折算为瓶数
- **权限隔离**：非管理员不可见成本、毛利、毛利率；销售可查看账期页但不可编辑
- **数据概览**：业绩按收款/核销时间统计；订单数/业绩/退款/已收款业绩均可点击查看明细
- **退款管理**：职能/管理员可设置退款；退款业绩不计入收款业绩
- **水墨中国风 UI**：宣纸底色、墨色文字、朱砂点缀；左侧菜单固定、右侧内容滚动
- **移动端适配**：手机端抽屉导航、订单卡片列表、筛选/统计紧凑布局；弹窗底部抽屉样式

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 本地开发 |
| `npm run build` | 生产构建 |
| `npm run start` | 生产启动 |
| `npm run db:migrate` | 开发环境生成 migration |
| `npm run db:deploy` | 生产环境执行 migration |
| `npm run db:seed` | 初始化演示数据（**仅空库/开发**） |
| `npm run db:sync-performance` | 回填历史业绩记录（升级后推荐） |
| `npm run db:clear-orders` | 清空全部订单，保留客户/账号/产品/渠道 |

## 仓库

https://github.com/ranmannic/maofu-crm
