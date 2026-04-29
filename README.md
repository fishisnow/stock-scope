简体中文 | [English](./README_EN.md)

<div align="center">

# StockScope

一个面向股票研究、市场跟踪与投资机会发现的全栈项目。

基于 `Next.js` + `Flask` 构建，集成行情采集、AI 分析、交易记录管理、市场广度统计与定时简报能力。

</div>

---

## 价值

- 快速整合股票研究、交易复盘与市场观察所需的核心能力
- 将前端展示、后端 API、定时任务与部署脚本集中在同一仓库中维护
- 为 AI 驱动的投资机会发现与市场简报提供可运行的工程骨架

## 功能

- AI 驱动的股票分析与投资机会发现
- 市场广度与行业维度的数据统计
- 交易记录导入、查询与收益汇总
- 定时抓取行情数据并生成市场简报
- 支持 `zh` / `en` 双语言路由
- 提供本地开发与 Docker 部署方式

## 优势

- 统一架构：前端、后端、定时任务与部署脚本在同一仓库中协同维护
- 双运行模式：既支持本地分开启动，也支持通过 Docker 一体化部署
- 面向研究：覆盖机会发现、市场广度、AI 简报和交易记录等典型研究场景
- 便于扩展：前端采用 App Router，后端采用 Blueprint 注册 API，适合持续演进

## 架构概览

### 前端

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS 4
- `next-intl`
- Supabase JS

### 后端

- Python
- Flask
- Gunicorn
- Supabase
- Futu API
- OpenAI / DeepSeek

### 运行方式

- 前端默认运行在 `3000` 端口
- 后端 API 默认运行在 `5001` 端口
- 前端通过 `frontend/next.config.ts` 将 `/api/*` 代理到 `http://localhost:5001/api/*`
- 后端入口会同时启动定时任务线程与 API 服务

## 仓库结构

```text
.
├── backend/                  # Flask API、定时任务、数据访问与行情处理
├── frontend/                 # Next.js Web 应用
├── scripts/                  # Docker 部署与自动部署脚本
├── Dockerfile                # 前后端一体化镜像构建
├── .env.example              # 后端环境变量示例
├── frontend/.env.example     # 前端环境变量示例
└── SECURITY_CHECKLIST.md     # 安全加固与排查文档
```

## 快速开始

### 环境要求

- Node.js 20+
- npm
- Python 3.12+
- Docker（如需容器化部署）

### 1. 配置环境变量

前端 `frontend/.env`，参考 `frontend/.env.example`：

```bash
NEXT_PUBLIC_API_URL=http://localhost:5001
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

后端 `.env`，参考根目录 `.env.example`：

```bash
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

BOCHA_API_KEY=sk-your-bocha-api-key-here

DEEPSEEK_API_KEY=sk-your-deepseek-key
# or
OPENAI_API_KEY=sk-your-openai-key

OPENCLAW_AGENT_REPORT_KEY=your-openclaw-report-key
BRIEFING_REPORT_API_URL=http://localhost:5001
```

说明：AI 分析至少需要配置 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY` 之一。

### 2. 启动前端

```bash
cd frontend
npm ci
npm run dev
```

前端可用脚本：

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

### 3. 启动后端

```bash
cd backend
pip install -r requirements.txt
python app/main.py
```

启动后默认地址：

- 前端：`http://localhost:3000`
- 后端：`http://localhost:5001`
- 健康检查：`http://localhost:5001/api/stock-analysis/health`

## 部署

仓库提供了前后端一体化 Docker 构建与部署方案：

- `Dockerfile` 使用多阶段构建前端，并在运行镜像中安装后端依赖
- 容器会同时运行定时任务、Gunicorn 后端与 Next.js 前端
- `scripts/deploy.sh` 会拉取镜像、加载 `.env`、启动容器并执行健康检查

常用部署命令：

```bash
./scripts/deploy.sh
```

部署脚本默认暴露：

- `3000`：前端
- `5001`：后端

## 安全与运维

项目包含单独的安全加固文档：

- `SECURITY_CHECKLIST.md`

该文档记录了容器安全配置、镜像检查、依赖扫描、运行时监控与应急排查步骤。

## 补充说明

- 项目当前支持 `en` 与 `zh` 两种 locale 路由
- 根路径会重定向到带 locale 的页面
- 如需进一步了解部署与安全策略，优先查阅 `scripts/deploy.sh`、`Dockerfile` 与 `SECURITY_CHECKLIST.md`
