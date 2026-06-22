# 🚀 Cloudflare Pages 部署指南

本项目已适配 **Cloudflare Pages**（通过 `@opennextjs/cloudflare` 适配器 + 自定义转换脚本，支持 Next.js 16 SSR + Edge Runtime）。

> 💡 **方案说明**：Cloudflare 已将 Pages 和 Workers 统一为新版平台。本项目选择 Pages 是因为：
> 1. Pages 支持 Git 自动部署（Workers 也支持但配置更复杂）
> 2. Pages 项目天然适合带静态资源 + 边缘函数的应用
> 3. Pages 部署不需要 Workers Scripts:Edit 这种较高权限的 Token

---

## ✅ 已部署

**生产地址**：
```
https://attendance-checker-9dz.pages.dev
```

**生产分支**：`cloudflare`（每次 push 自动触发新部署，前提是已连接 Git）

**当前部署方式**：Direct Upload（wrangler CLI），后续可切换为 Git 自动部署

---

## 已做的改动

1. **移除 Prisma / PostgreSQL 依赖**：原代码中 `db.ts` 和 `schema.prisma` 从未被实际使用（API 只解析 Excel，不读写数据库），已彻底移除以适配边缘运行时。
2. **新增 Cloudflare 适配配置**：
   - `wrangler.jsonc`：Pages 配置（含 `nodejs_compat` 兼容标志，支持 `Buffer`）
   - `open-next.config.ts`：OpenNext 适配器入口
   - `scripts/prepare-pages.mjs`：将 OpenNext 的 Workers 产物（`.open-next/`）转换为 Pages 兼容结构（`.open-next-pages/`）—— 把 `worker.js` 重命名为 `_worker.js`、合并静态资源、生成 `_routes.json`
3. **package.json 脚本**：
   - `npm run build:cf`：构建 OpenNext 产物 + 转换为 Pages 结构
   - `npm run preview`：本地用 wrangler pages dev 预览
   - `npm run deploy`：构建 + 推送到 Pages 生产分支

---

## 部署架构

```
[GitHub: cloudflare 分支]
       ↓ git push (或 wrangler pages deploy)
[Cloudflare Pages]
       ├─ .open-next-pages/_worker.js → Pages Function (Edge)
       │     ↓ import
       │   .open-next-pages/cloudflare/*.js
       │   .open-next-pages/server-functions/default/*
       │   .open-next-pages/.build/durable-objects/*
       │
       ├─ .open-next-pages/_next/static/* → 静态资源 CDN
       ├─ .open-next-pages/cache/* → ISR/SSG 缓存
       └─ .open-next-pages/_routes.json → 函数路由规则
              include: /* (除静态资源外都走 Function)
```

---

## 步骤 1：本地部署（Direct Upload）

适合快速验证或手动控制部署时机。

### 前置条件
- Node.js 18+
- Cloudflare 账号 + 一个有 `Cloudflare Pages:Edit` 权限的 API Token

### 操作
```bash
cd attendance-checker
npm install

# 设置环境变量（或写入 .env）
export CLOUDFLARE_API_TOKEN=cfut_xxx
export CLOUDFLARE_ACCOUNT_ID=你的账号ID

# 一键构建 + 部署
npm run deploy
```

输出示例：
```
✨ Deployment complete! Take a peek over at https://xxx.attendance-checker-9dz.pages.dev
✨ Deployment alias URL: https://cloudflare.attendance-checker-9dz.pages.dev
```

### 自定义部署分支
```bash
# 部署到预览分支（不会影响生产）
npx wrangler pages deploy .open-next-pages --branch=preview

# 部署到生产分支
npx wrangler pages deploy .open-next-pages --branch=cloudflare
```

---

## 步骤 2：Git 自动部署（推荐生产用法）

适合希望"push 即部署"的工作流。

### 操作
1. 进入 Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 选择 GitHub，授权 Cloudflare 访问 `104-momo/attendance-checker` 仓库
3. 配置：
   - **Project name**: `attendance-checker`
   - **Production branch**: `cloudflare`
   - **Framework preset**: None（不是 Next.js，因为我们用 OpenNext）
   - **Build command**: `npm run build:cf`
   - **Build output directory**: `.open-next-pages`
   - **Environment variables**:
     - `NODE_VERSION` = `20`
     - `NPM_FLAGS` = `--legacy-peer-deps`（如有依赖冲突）
4. 点击 **Save and Deploy**

之后每次 `git push origin cloudflare` 都会自动触发部署。预览分支（非 `cloudflare` 的分支）会自动生成 `https://<branch>.attendance-checker-9dz.pages.dev` 预览链接。

---

## 步骤 3（可选）：绑定自定义域名

1. Cloudflare Dashboard → **Workers & Pages** → 选择 `attendance-checker` 项目
2. **Custom domains** → **Set up a custom domain**
3. 输入你的域名（域名需托管在 Cloudflare DNS 上）
4. Cloudflare 自动签发 SSL 证书，几分钟生效

---

## 改动文件清单

| 文件 | 改动 |
|------|------|
| `package.json` | 移除 prisma/@prisma/client，新增 `@opennextjs/cloudflare` + `wrangler`，新增 build:cf/preview/deploy 脚本 |
| `wrangler.jsonc` | 新增 - Pages 配置（`pages_build_output_dir` + `nodejs_compat`） |
| `open-next.config.ts` | 新增 - OpenNext 适配器入口 |
| `scripts/prepare-pages.mjs` | 新增 - Workers 产物 → Pages 结构转换脚本 |
| `next.config.ts` | 微调注释 |
| `.gitignore` | 新增 `.open-next/` 和 `.open-next-pages/` |
| `prisma/` | 删除（未使用） |
| `src/lib/db.ts` | 删除（未使用） |
| `.env.example` | 删除（不再需要 DATABASE_URL） |

---

## 故障排查

### 部署失败：`_worker.js is not being bundled by Wrangler but it is importing from another file`

**原因**：用了 `--no-bundle` 标志，但 `_worker.js` 引用了 `./cloudflare/*.js` 等外部文件。

**解决**：不要用 `--no-bundle`。`npm run deploy` 已经移除了这个标志。

### 部署成功但访问 404

**原因 1**：部署到了非生产分支。Cloudflare Pages 的 `https://<project>.pages.dev` 主域名只指向生产分支的部署。

**解决**：
- 检查 `wrangler pages deploy` 命令的 `--branch` 参数是否等于生产分支名（本项目为 `cloudflare`）
- 或访问 `https://<branch>.<project>.pages.dev` 查看预览分支
- 或在 Cloudflare Dashboard → 项目设置中修改生产分支

**原因 2**：DNS 路由传播未完成（10-30 秒延迟）。

**解决**：等待 30 秒后重试。

### 部署成功但 API 返回 500 / Edge Function 出错

**原因**：可能 `nodejs_compat` 标志未生效，导致 `Buffer`、`process` 等 Node.js API 不可用。

**解决**：确认 `wrangler.jsonc` 中包含：
```jsonc
"compatibility_flags": ["nodejs_compat"]
```

### 上传大文件失败

**原因**：Cloudflare Pages 免费版单次部署静态资源总大小上限 25MB，单文件 25MB；函数执行 CPU 时间 10ms。

**解决**：考勤表通常很小（<1MB），不会触及限制。

### Git 自动部署失败：`Cannot find module '@opennextjs/cloudflare'`

**原因**：构建命令缺少 `npm install` 步骤。

**解决**：Cloudflare Pages 默认会自动 `npm install`，但若失败可在 Build command 改为：
```
npm install && npm run build:cf
```

---

## 与原 Vercel 方案对比

| 维度 | 原 Vercel 方案 | Cloudflare Pages 方案 |
|------|---------------|---------------------|
| 数据库 | Neon PostgreSQL（实际未用） | 无（已移除） |
| 运行时 | Node.js | Edge (V8 Isolates) |
| 全球延迟 | 区域部署 | 全球 300+ 节点 |
| 免费额度 | Hobby 永久免费 | Pages 免费版无限请求 + 500次构建/月 |
| 文件上传上限 | 4.5MB | 100MB |
| 冷启动 | 有 | 无 |
| Git 自动部署 | 原生支持 | 原生支持 |

---

## 备选方案

如果 Pages 不满足需求：
- **Cloudflare Workers**：相同代码可用 `@opennextjs/cloudflare deploy` 直接部署到 Workers，但需要更高权限的 API Token
- **Vercel**：原 DEPLOY.md 中的方案
