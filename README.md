# 考勤检查器 · Attendance Checker

> 一个基于 Next.js 16 + Prisma + shadcn/ui 的考勤分析小工具，支持上传 Excel 考勤表，自动分类缺勤原因、统计出勤率、生成缺勤名单。

## ✨ 功能特性

- 📤 **拖拽上传** Excel/CSV 考勤表（`.xlsx` / `.xls` / `.csv`）
- 🧠 **智能识别** 12 种考勤状态：签到、病假、事假、年假、调休、婚假、丧假、产假、出差、迟到、早退、缺勤
- 📊 **多维统计**：
  - 每日考勤明细
  - 缺勤汇总（按人聚合）
  - 出勤率预警（低于阈值自动标红）
  - 纯缺勤名单（仅统计无故缺勤）
- 🎨 现代化 UI，支持暗色模式、响应式布局
- ⚡ 服务端解析，前端零等待

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Next.js 16 (App Router) + React 19 |
| 语言 | TypeScript 5 |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| 数据库 | PostgreSQL (Prisma ORM) |
| Excel 解析 | SheetJS (xlsx) |
| 部署 | Vercel (推荐) |

## 🚀 本地开发

### 前置要求

- Node.js ≥ 20
- PostgreSQL 数据库（本地或云端，推荐 [Neon](https://neon.tech) 免费版）

### 步骤

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 PostgreSQL 连接字符串

# 3. 生成 Prisma Client
npx prisma generate

# 4. 同步数据库表结构
npx prisma db push

# 5. 启动开发服务器
npm run dev
```

访问 http://localhost:3000

## ☁️ 部署到 Vercel

详见 [DEPLOY.md](./DEPLOY.md)

## 📁 项目结构

```
attendance-checker/
├── prisma/
│   └── schema.prisma          # 数据库模型定义
├── public/                    # 静态资源
├── src/
│   ├── app/
│   │   ├── api/attendance/    # 考勤解析 API 路由
│   │   ├── layout.tsx
│   │   ├── page.tsx           # 主页面
│   │   └── globals.css
│   ├── components/ui/         # shadcn/ui 组件库
│   ├── hooks/
│   └── lib/
├── .env.example               # 环境变量样例
├── next.config.ts
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## 📝 许可证

MIT License
