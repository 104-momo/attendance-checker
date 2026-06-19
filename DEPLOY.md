# 🚀 部署指南

本文档介绍如何将考勤检查器部署到 Vercel（推荐）+ Neon Postgres 的全栈云端方案。

---

## 方案概览

| 组件 | 平台 | 免费额度 |
|---|---|---|
| 应用托管 | [Vercel](https://vercel.com) | Hobby 计划永久免费 |
| 数据库 | [Neon](https://neon.tech) | 0.5GB 存储 + 100 计算小时/月 |
| 代码托管 | GitHub | 公开仓库无限 |

> 💡 替代方案：Vercel Postgres、Supabase、Railway 也可作为数据库，任选其一。

---

## 步骤 1：准备数据库（Neon）

1. 访问 https://neon.tech 注册账号（可用 GitHub 登录）
2. 点击 **New Project** → 命名为 `attendance-checker`
3. 区域选择：`AWS Asia Pacific (Singapore)` 或最近的区域
4. 创建完成后，在 Dashboard 找到 **Connection String**，类似：
   ```
   postgresql://neondb_owner:xxxx@ep-xxx-xxx.aws.neon.tech/attendance?sslmode=require
   ```
5. **保存这个连接字符串**，后面要用

---

## 步骤 2：导入 GitHub 仓库到 Vercel

1. 访问 https://vercel.com 用 GitHub 账号登录
2. 进入 Dashboard → **Add New** → **Project**
3. 在 Import Git Repository 列表中找到你刚推送的 `attendance-checker` 仓库
4. 点击 **Import**

---

## 步骤 3：配置环境变量

在 Vercel 的项目设置页面，找到 **Environment Variables** 区域，添加：

| Key | Value | Environments |
|---|---|---|
| `DATABASE_URL` | 你的 Neon 连接字符串（步骤 1 保存的） | Production, Preview, Development |

---

## 步骤 4：配置 Build Settings

Vercel 会自动识别 Next.js 项目，默认配置即可：

- **Framework Preset**: Next.js
- **Build Command**: `next build`（Vercel 自动调用 `npm run build`）
- **Output Directory**: `.next`（自动）
- **Install Command**: `npm install`（自动，会触发 `postinstall: prisma generate`）

无需修改，直接点击 **Deploy**。

---

## 步骤 5：初始化数据库表结构

部署成功后，需要在数据库中创建表结构。**两种方式任选**：

### 方式 A：本地执行（推荐）

```bash
# 克隆你的仓库到本地
git clone https://github.com/<your-username>/attendance-checker.git
cd attendance-checker

# 安装依赖
npm install

# 配置环境变量（用你的 Neon 连接字符串）
cp .env.example .env
# 编辑 .env，填入 DATABASE_URL

# 推送 schema 到数据库
npx prisma db push
```

### 方式 B：通过 Vercel CLI

```bash
npm i -g vercel
vercel login
vercel link  # 关联到你的项目
vercel env pull .env  # 拉取 Vercel 上的环境变量
npx prisma db push
```

执行成功后，Neon 数据库会创建 `User` 和 `Post` 两张表。

---

## 步骤 6：访问你的应用

部署完成后，Vercel 会分配一个域名：
```
https://attendance-checker-xxx.vercel.app
```

打开即可使用。后续每次 `git push` 到 `main` 分支，Vercel 会自动重新部署。

---

## 故障排查

### 部署失败：`PrismaClientInitializationError`

**原因**：数据库连接字符串未配置或格式错误。

**解决**：
1. 检查 Vercel 项目设置中 `DATABASE_URL` 环境变量是否已添加
2. 确认连接串包含 `?sslmode=require`（Neon 强制 SSL）
3. 重新部署：Vercel Dashboard → Deployments → Redeploy

### 部署成功但访问 500 错误

**原因**：数据库表未创建。

**解决**：执行步骤 5 初始化表结构。

### 上传文件大小限制

Vercel Hobby 计划请求体上限为 4.5MB。如果你的考勤表超过此大小：
1. 拆分为多个小文件
2. 或升级到 Vercel Pro 计划（上限 50MB）

---

## 可选：自定义域名

Vercel Dashboard → Settings → Domains → 添加你的域名 → 按 CNAME 指引配置 DNS 即可。

---

## 备选部署平台

如果 Vercel 不满足需求，可以考虑：

- **[Render](https://render.com)** - 支持 Next.js + 自带 PostgreSQL，免费层有冷启动
- **[Railway](https://railway.app)** - 试用免费，按用量付费
- **[Cloudflare Pages](https://pages.cloudflare.com)** + Cloudflare D1 - 边缘部署，需调整 Prisma 配置

但本项目已针对 Vercel 优化，推荐优先使用 Vercel。
