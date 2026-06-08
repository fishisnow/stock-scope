# Frontend

Next.js App Router 应用，使用 `output: 'export'` **静态导出**，生产环境由 Flask 托管 `out/` 目录，不单独运行 Next 服务。

## 本地开发

在 `frontend/.env.local` 中配置：

```bash
NEXT_PUBLIC_API_URL=http://localhost:5001/api
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

先启动后端（见根目录 README），再：

```bash
npm ci
npm run dev
```

打开 [http://localhost:3000/zh](http://localhost:3000/zh)。

## 静态构建（与 Docker / 生产一致）

```bash
npm run build   # 输出到 frontend/out
```

构建后由 `backend/app/api/api_app.py` 在 5001 端口提供页面；本地可只启后端访问 `http://localhost:5001`。

## Docker 构建参数

镜像构建时通过根目录 `.env` 注入（见 `scripts/push_to_aliyun.sh`）：

```bash
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

生产环境 API 与页面同域，使用相对路径 `/api` 即可。
