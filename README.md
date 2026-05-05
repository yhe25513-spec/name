# 文字冒险游戏

AI 驱动的沉浸式文字冒险游戏，支持 PC 和移动端。

## 技术栈

- **前端**: Next.js 14 (App Router) + TypeScript + TailwindCSS + shadcn/ui
- **后端**: Next.js API Routes
- **数据库**: Supabase (PostgreSQL + Auth)
- **AI**: DeepSeek API（流式输出）
- **部署**: Vercel

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `env.example` 为 `.env.local`，填入以下内容：

```
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase 项目 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service role key
DEEPSEEK_API_KEY=你的 DeepSeek API Key
```

### 3. 初始化数据库

在 Supabase Dashboard > SQL Editor 中执行 `supabase-init.sql` 文件的全部内容。

### 4. 设置管理员账号

注册账号后，在 Supabase SQL Editor 执行：

```sql
UPDATE public.profiles SET role = 'admin' 
WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
```

### 5. 配置 DeepSeek API Key

登录管理后台 (`/admin`) > AI 配置，填入 API Key。

### 6. 启动开发服务器

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
