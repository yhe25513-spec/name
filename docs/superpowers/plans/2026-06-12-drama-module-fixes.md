# AI 短剧创作模块修复计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复 AI 短剧创作模块的 24 个问题，优先修复 4 个严重 + 5 个高危问题。

**Architecture:** 在现有 Next.js + Supabase 架构上修复，不改变整体架构。核心改动：修复状态管理、API 字段映射、超时配置、权限校验。

**Tech Stack:** Next.js App Router, Supabase, Agnes AI API, DeepSeek API

---

## Task 1: 修复图片生成状态 bug（Critical #1）

**问题：** 图片生成成功后 status 设为 `pending` 而非 `done`，导致每次重新生成所有图片。

**Files:**
- Modify: `app/api/drama/generate-images/route.ts:97`

- [ ] **Step 1: 修改状态值**

将第 97 行的 `status: imageUrl ? 'pending' : 'generating_image'` 改为 `status: imageUrl ? 'done' : 'generating_image'`

- [ ] **Step 2: 验证**

确认 generate-images 查询条件 `eq('status', 'pending')` 不会选中已生成图片的分镜。

- [ ] **Step 3: Commit**

```bash
git add app/api/drama/generate-images/route.ts
git commit -m "fix: 图片生成成功后状态设为 done 而非 pending"
```

---

## Task 2: 修复视频状态查询字段（High #7）

**问题：** 用 `data.request_id` 查询视频状态，但 Agnes AI 返回的字段是 `data.id` 或 `data.video_id`。

**Files:**
- Modify: `app/api/drama/generate-videos/route.ts:100`
- Modify: `app/api/drama/check-status/route.ts` (查询视频状态部分)

- [ ] **Step 1: 修复 generate-videos 的 request_id 字段**

参考 `app/api/generate-video/route.ts` 的正确字段映射：
```typescript
const videoId = data.id || data.video_id || data.request_id || ''
```

- [ ] **Step 2: 修复 check-status 的查询字段**

确保查询视频状态时使用相同的字段名。

- [ ] **Step 3: Commit**

```bash
git add app/api/drama/generate-videos/route.ts app/api/drama/check-status/route.ts
git commit -m "fix: 修复视频状态查询字段映射"
```

---

## Task 3: 修复视频提交超时（High #6）

**问题：** Agnes API 提交超时只设了 8 秒，太短。

**Files:**
- Modify: `app/api/drama/generate-videos/route.ts:81`
- Modify: `app/api/drama/check-status/route.ts` (视频提交部分)

- [ ] **Step 1: 将超时从 8 秒改为 30 秒**

参考 `app/api/generate-video/route.ts` 使用 `AbortController` + 60 秒超时的模式，但考虑到 Vercel 10 秒限制，折中用 30 秒。

- [ ] **Step 2: Commit**

```bash
git add app/api/drama/generate-videos/route.ts app/api/drama/check-status/route.ts
git commit -m "fix: 视频提交超时从8秒改为30秒"
```

---

## Task 4: 修复 check-status Vercel 超时（Critical #4）

**问题：** check-status 遍历所有生成中的分镜，每个都做 HTTP 请求，Vercel 10 秒超时。

**Files:**
- Modify: `app/api/drama/check-status/route.ts`

- [ ] **Step 1: 限制每次只检查 1 个分镜**

```typescript
// 只取第一个生成中的分镜检查，避免超时
const { data: scenes } = await adminSupabase
  .from('drama_scenes')
  .select('*')
  .eq('project_id', projectId)
  .eq('status', 'generating_video')
  .limit(1)
```

- [ ] **Step 2: 移除 check-status 中的视频提交逻辑**

视频提交应该由前端驱动，check-status 只负责检查状态。提交下一个视频的逻辑移到前端轮询中。

- [ ] **Step 3: Commit**

```bash
git add app/api/drama/check-status/route.ts
git commit -m "fix: check-status 限制每次只检查1个分镜，移除提交逻辑"
```

---

## Task 5: 前端轮询改为队列驱动

**问题：** check-status 不再自动提交下一个视频，需要前端在检测到视频完成后主动提交下一个。

**Files:**
- Modify: `components/drama/DramaStudio.tsx`

- [ ] **Step 1: 修改轮询逻辑**

在轮询回调中，如果 check-status 返回 `updated > 0`（有视频完成了），自动调用 generate-videos 接口提交下一个分镜。

- [ ] **Step 2: Commit**

```bash
git add components/drama/DramaStudio.tsx
git commit -m "fix: 前端轮询检测到视频完成后自动提交下一个"
```

---

## Task 6: 修复视频 URL 字段（High #8）

**问题：** `remixed_from_video_id` 是 ID 不是 URL。

**Files:**
- Modify: `app/api/drama/check-status/route.ts`

- [ ] **Step 1: 移除 remixed_from_video_id 作为 URL 的逻辑**

```typescript
// 修复前
let videoUrl = data.video_url || data.remixed_from_video_id || ''
// 修复后
let videoUrl = data.video_url || ''
```

- [ ] **Step 2: Commit**

```bash
git add app/api/drama/check-status/route.ts
git commit -m "fix: 移除 remixed_from_video_id 作为视频URL的错误逻辑"
```

---

## Task 7: 前端添加 HTTP 响应检查（High #9）

**Files:**
- Modify: `components/drama/DramaStudio.tsx`

- [ ] **Step 1: 在所有 fetch 调用后添加 res.ok 检查**

```typescript
const res = await fetch(...)
if (!res.ok) {
  const err = await res.json().catch(() => ({ error: '请求失败' }))
  throw new Error(err.error || `HTTP ${res.status}`)
}
const data = await res.json()
```

- [ ] **Step 2: Commit**

```bash
git add components/drama/DramaStudio.tsx
git commit -m "fix: 前端所有 API 调用添加 HTTP 响应状态检查"
```

---

## Task 8: 修复权限校验（Critical #2 + #3）

**Files:**
- Modify: `app/api/drama/generate-scenes/route.ts`
- Modify: `app/api/drama/generate-images/route.ts`
- Modify: `app/api/drama/generate-videos/route.ts`
- Modify: `app/api/drama/check-status/route.ts`
- Modify: `app/api/drama/project/route.ts`

- [ ] **Step 1: 在每个 API 接口中添加 projectId 归属校验**

```typescript
// 在每个接口开头添加
const { data: project } = await adminSupabase
  .from('drama_projects')
  .select('id')
  .eq('id', projectId)
  .eq('user_id', user.id)
  .single()
if (!project) return NextResponse.json({ error: '无权访问' }, { status: 403 })
```

- [ ] **Step 2: 修复 DELETE 接口**

将 scenes 删除也加上 user_id 校验。

- [ ] **Step 3: Commit**

```bash
git add app/api/drama/
git commit -m "fix: 所有 drama API 添加 projectId 归属校验"
```

---

## Task 9: 清理代码质量（Medium + Low）

**Files:**
- Modify: `lib/drama/types.ts`
- Modify: `app/api/drama/generate-audio/route.ts`
- Modify: `app/api/drama/generate-script/route.ts`

- [ ] **Step 1: 修复 types.ts 字段名**

`character` → `character_name`，`imageRequestId` → `image_request_id`，`videoRequestId` → `video_request_id`

- [ ] **Step 2: 清理 generate-audio 死代码**

移除未使用的 imports。

- [ ] **Step 3: 清理 generate-script 死代码**

移除未使用的 `resolveAIConfig` import。

- [ ] **Step 4: Commit**

```bash
git add lib/drama/types.ts app/api/drama/generate-audio/route.ts app/api/drama/generate-script/route.ts
git commit -m "fix: 清理死代码和修复类型定义"
```

---

## Task 10: 最终验证 + 推送

- [ ] **Step 1: TypeScript 编译检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: 提交所有剩余改动**

```bash
git add -A && git commit -m "fix: drama module 全面修复" && git push
```
