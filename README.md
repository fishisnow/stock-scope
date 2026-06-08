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

生产环境与 Docker **不运行 Next.js 服务**，而是：

1. 构建阶段：`next build` 静态导出到 `frontend/out`
2. 运行阶段：Flask（Gunicorn）在 **5001** 端口同时提供：
   - 静态页面（`frontend/out` 中的 HTML / JS / CSS）
   - 后端 API（`/api/*`）

本地有两种常用方式：

| 模式 | 前端 | 后端 | 访问地址 |
|------|------|------|----------|
| **开发**（热更新） | `npm run dev` → 3000 | `python app/main.py` → 5001 | 页面 `http://localhost:3000`，API 指向 `http://localhost:5001/api` |
| **贴近生产** | `npm run build` 生成 `out/` | Flask 托管静态 + API → 5001 | 全部 `http://localhost:5001` |

`frontend/next.config.ts` 使用 `output: 'export'`，**没有** dev proxy；开发时通过 `NEXT_PUBLIC_API_URL` 直连后端。

## 仓库结构

```text
.
├── backend/                  # Flask API、定时任务、数据访问与行情处理
├── frontend/                 # Next.js Web 应用
├── scripts/                  # Docker 部署与自动部署脚本
├── Dockerfile                # 多阶段构建：静态前端 + Python 运行时
├── .env.example              # 后端环境变量示例（含 Docker 构建前端用的 NEXT_PUBLIC_*）
└── SECURITY_CHECKLIST.md     # 安全加固与排查文档
```

## 快速开始

### 环境要求

- Node.js 20+
- npm
- Python 3.12+
- Docker（如需容器化部署）

### 1. 配置环境变量

**后端** — 项目根目录 `.env`（参考 `.env.example`）：

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

**前端** — 本地开发用 `frontend/.env.local`：

```bash
# 开发模式：Next dev 在 3000，API 在 5001，注意要带 /api 前缀
NEXT_PUBLIC_API_URL=http://localhost:5001/api
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

**Docker 构建** — 在根目录 `.env` 中配置（`scripts/push_to_aliyun.sh` 会作为 `--build-arg` 传入）：

```bash
# 与 Flask 同域部署时使用相对路径，浏览器请求 /api/...
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

### 2. 本地开发（前后端分离，推荐改 UI 时用）

终端 1 — 后端（API + 可选定时任务）：

```bash
cd backend
pip install -r requirements.txt
python app/main.py
```

终端 2 — 前端热更新：

```bash
cd frontend
npm ci
npm run dev
```

访问：

- 页面：`http://localhost:3000/zh`
- 健康检查：`http://localhost:5001/api/stock-analysis/health`

前端脚本：`npm run dev` · `npm run build` · `npm run lint`

### 3. 本地贴近生产（单端口，与 Docker 一致）

```bash
cd frontend && npm ci && npm run build    # 产出 frontend/out
cd ../backend && pip install -r requirements.txt && python app/main.py
```

访问：`http://localhost:5001/zh`（静态页与 API 均由 Flask 提供，见 `backend/app/api/api_app.py`）。

## 部署

Docker 镜像为 **单容器、单端口（5001）** 部署：

```text
┌─────────────────────────────────────────────┐
│  Docker 容器 (:5001)                         │
│  ┌─────────────────┐  ┌──────────────────┐  │
│  │ Gunicorn/Flask  │  │ 定时任务          │  │
│  │ · /api/*  API   │  │ schedule_stocks  │  │
│  │ · /*  静态页面   │  │                  │  │
│  │   (frontend/out)│  │                  │  │
│  └─────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────┘
         ▲ 构建时 npm run build → frontend/out
         ▲ 无 Next.js 运行时
```

- `Dockerfile`：Stage 1 用 Node 20 构建静态前端；Stage 2 用 Python 3.12 运行 Gunicorn + 定时任务
- 静态资源由 `api_app.py` 的 `serve_frontend` 从 `frontend/out` 提供
- `scripts/push_to_aliyun.sh`：构建镜像并推送；需提前在 `.env` 配置 `NEXT_PUBLIC_*`（生产建议 `NEXT_PUBLIC_API_URL=/api`）
- `scripts/deploy.sh`：拉取镜像、加载 `.env`、映射 **5001**、健康检查

```bash
./scripts/deploy.sh
```

部署后访问：`http://<主机>:5001`（页面与 API 同域，API 路径为 `/api/...`）。

## 安全与运维

项目包含单独的安全加固文档：

- `SECURITY_CHECKLIST.md`

该文档记录了容器安全配置、镜像检查、依赖扫描、运行时监控与应急排查步骤。

## 补充说明

- 项目当前支持 `en` 与 `zh` 两种 locale 路由
- 根路径会重定向到带 locale 的页面
- 如需进一步了解部署与安全策略，优先查阅 `scripts/deploy.sh`、`Dockerfile` 与 `SECURITY_CHECKLIST.md`
