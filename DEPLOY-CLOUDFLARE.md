# 🚀 Cloudflare 部署指南

本项目已适配 **Cloudflare Workers**（通过 `@opennextjs/cloudflare` 适配器，支持 Next.js 16 SSR + Edge Runtime）。

> 💡 说明：Cloudflare 已将 Pages 和 Workers 统一为新版 Workers 平台（Workers + Static Assets），新版 Next.js 应用推荐部署到 Workers。部署后默认获得 `*.workers.dev` 域名，也可绑定自定义域名。

---

## 当前部署状态

✅ **已临时部署（预览）**：
```
https://attendance-checker.marbled-toaster.workers.dev
```

⚠️ 临时账号有效期 **60 分钟**。请按下方步骤切换到你自己的 Cloudflare 账号重新部署。

---

## 已做的改动

1. **移除 Prisma / PostgreSQL 依赖**：原代码中 `db.ts` 和 `schema.prisma` 从未被实际使用（API 只解析 Excel，不读写数据库），已彻底移除以适配边缘运行时。
2. **新增 Cloudflare 适配配置**：
   - `wrangler.jsonc`：Workers 配置（含 `nodejs_compat` 兼容标志，支持 `Buffer`）
   - `open-next.config.ts`：OpenNext 适配器配置
3. **package.json 新增脚本**：
   - `npm run build:cf`：构建 Cloudflare Worker 产物到 `.open-next/`
   - `npm run preview`：本地用 wrangler 预览
   - `npm run deploy`：一键构建 + 部署

---

## 步骤 1：登录你的 Cloudflare 账号

```bash
cd attendance-checker
npx wrangler login
```

浏览器会自动打开 Cloudflare 授权页面，点击 **Allow** 即可。

验证登录：
```bash
npx wrangler whoami
```

---

## 步骤 2：部署到你的账号

```bash
npm run deploy
```

这条命令会：
1. 调用 `opennextjs-cloudflare build` 重新构建产物到 `.open-next/`
2. 调用 `wrangler deploy` 推送到你的 Cloudflare 账号

部署成功后你会看到类似输出：
```
Deployed attendance-checker triggers
  https://attendance-checker.<your-account>.workers.dev
```

---

## 步骤 3（可选）：本地预览

部署前先在本地用 wrangler 预览（端口 8787）：

```bash
npm run preview
# 访问 http://localhost:8787
```

---

## 步骤 4（可选）：绑定自定义域名

1. 进入 Cloudflare Dashboard → **Workers & Pages** → 找到 `attendance-checker`
2. 进入 **Settings** → **Domains & Routes** → **Add Custom Domain**
3. 输入你的域名（域名需托管在 Cloudflare DNS 上），按提示完成配置
4. Cloudflare 会自动签发 SSL 证书

---

## 步骤 5（可选）：开启 Git 自动部署

如果希望通过 `git push` 自动部署：

1. 把本仓库推送到 GitHub
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Connect to Git**
3. 选择仓库，框架选择 **Next.js**，构建命令填 `npx opennextjs-cloudflare build`，部署命令填 `npx wrangler deploy`
4. 之后每次 `git push` 到 `main` 分支会自动触发部署

---

## 改动文件清单

| 文件 | 改动 |
|------|------|
| `package.json` | 移除 prisma/@prisma/client，新增 `@opennextjs/cloudflare` + `wrangler`，新增 build:cf/preview/deploy 脚本 |
| `wrangler.jsonc` | 新增 - Workers 配置 |
| `open-next.config.ts` | 新增 - OpenNext 适配器入口 |
| `next.config.ts` | 微调注释 |
| `.gitignore` | 新增 `.open-next/` 和 `.wrangler/` |
| `prisma/` | 删除（未使用） |
| `src/lib/db.ts` | 删除（未使用） |
| `.env.example` | 删除（不再需要 DATABASE_URL） |

---

## 故障排查

### 部署失败：`Buffer is not defined`

**原因**：`nodejs_compat` 标志未生效。

**解决**：确认 `wrangler.jsonc` 中包含：
```jsonc
"compatibility_flags": ["nodejs_compat"]
```

### 部署失败：`OpenNext build error`

**原因**：本地构建产物残留导致缓存问题。

**解决**：
```bash
rm -rf .next .open-next
npm run deploy
```

### 上传大文件失败

**原因**：Cloudflare Workers 免费版请求体上限 100MB（远大于 Vercel Hobby 的 4.5MB），但单次 Excel 解析仍受 CPU 时间限制（10ms / 50ms）。

**解决**：考勤表超过 1MB 建议拆分。

### 临时预览账号过期

临时账号 60 分钟后会失效，正式部署请用 `wrangler login` 登录自己的账号后 `npm run deploy`。

---

## 与原 Vercel 方案对比

| 维度 | 原 Vercel 方案 | Cloudflare 方案 |
|------|---------------|----------------|
| 数据库 | Neon PostgreSQL（实际未用） | 无（已移除） |
| 运行时 | Node.js | Edge (V8 Isolates) |
| 全球延迟 | 区域部署 | 全球 300+ 节点 |
| 免费额度 | Hobby 永久免费 | Workers 免费版 10万 请求/天 |
| 文件上传上限 | 4.5MB | 100MB |
| 冷启动 | 有 | 无 |

---

## 备选方案

如果 Workers 不满足需求，可考虑：
- **Cloudflare Pages + 静态导出**：用 `next export` 输出纯静态站点，但会失去 `/api/attendance` 服务端接口
- **Vercel**：原 DEPLOY.md 中的方案，对 Next.js 兼容性最佳
