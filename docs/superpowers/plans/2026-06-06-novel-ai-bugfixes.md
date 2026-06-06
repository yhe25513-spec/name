# AI Novel Bugfixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical bugs, architectural issues, and code smells in the AI novel writing system.

**Architecture:** Consolidate duplicated code (Supabase client, JSON parser), fix field overwrites in the workflow, replace hardcoded DeepSeek with multi-provider config, add missing DB schema, and remove dead code.

**Tech Stack:** Next.js App Router, Supabase, LangChain/LangGraph, TypeScript

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/novel/store.ts` | Modify | Single Supabase client, remove in-memory `currentNovelId` |
| `lib/novel/ai-config.ts` | Modify | Add `parseJsonFromLLM` (consolidated), add `callAIStreaming` |
| `lib/novel/agents/workflow.ts` | Modify | Use shared `parseJsonFromLLM`, fix `characterReview` overwrite |
| `lib/novel/agents/director.ts` | Modify | Use shared `parseJsonFromLLM` |
| `lib/novel/agents/missing-agents.ts` | Modify | Export `parseJsonFromLLM` → re-export from `ai-config` |
| `lib/novel/agents/state-machine.ts` | Modify | Import supabase from `store.ts` |
| `lib/novel/foreshadows.ts` | Modify | Fix ID collision with UUID |
| `app/api/novel/route.ts` | Modify | Add auth check, fix sync error handling |
| `app/api/novel/generate/route.ts` | Modify | Use multi-provider `ai-config` instead of hardcoded DeepSeek |
| `app/api/novel/memory/route.ts` | Modify | Import supabase from `store.ts` |
| `app/api/novel/import/route.ts` | Modify | Import supabase from `store.ts` |
| `app/api/novel/export/route.ts` | Modify | Import supabase from `store.ts` |
| `app/api/novel/workflow/route.ts` | Modify | Import supabase from `store.ts` |
| `app/api/novel/workflow/nine-segment/route.ts` | Modify | Import supabase from `store.ts`, use shared `parseJsonFromLLM` |
| `supabase-novel.sql` | Modify | Add 5 missing tables |

---

## Task 1: Consolidate Supabase Client

**Files:**
- Modify: `lib/novel/store.ts`

**Why:** 6 files create their own `createClient()` instances. This risks connection pool exhaustion and makes configuration changes error-prone. All should import from one place.

- [ ] **Step 1: Verify current `store.ts` exports**

Read `lib/novel/store.ts` — it already exports `supabase`. Good. The problem is other files ignoring it.

- [ ] **Step 2: Remove `currentNovelId` from `store.ts`**

The in-memory `currentNovelId` is useless in serverless/multi-instance deployments and causes multi-tenancy bugs. Remove it entirely.

Replace the entire file with:

```typescript
import { createClient } from '@supabase/supabase-js'

// Server-side: single Supabase client instance using service role key
// All novel API routes are server-side, so service role is appropriate here
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

- [ ] **Step 3: Remove `setCurrentNovel` / `getCurrentNovel` imports from `app/api/novel/route.ts`**

Open `app/api/novel/route.ts` line 3. Change:

```typescript
import { setCurrentNovel, supabase } from '@/lib/novel/store'
```

to:

```typescript
import { supabase } from '@/lib/novel/store'
```

Then remove the two places that call `setCurrentNovel`:
- Line 72: delete `await setCurrentNovel(d.id)`
- Line 76: delete `await setCurrentNovel(s[1])`

Also remove the `switch` route entirely (lines 75-78) since it only set the in-memory state:

```typescript
    if (s[0] === 'novels' && s[2] === 'switch') {
      await setCurrentNovel(s[1])
      return NextResponse.json({ ok: true })
    }
```

- [ ] **Step 4: Replace Supabase clients in other files**

In each of these files, replace the local `createClient(...)` block with an import:

**`lib/novel/agents/state-machine.ts`** — lines 4-9, replace with:
```typescript
import { supabase } from '../store'
```
Delete lines 4-9 (the `createClient` import and instantiation).

**`app/api/novel/memory/route.ts`** — lines 2-7, replace with:
```typescript
import { supabase } from '@/lib/novel/store'
```

**`app/api/novel/import/route.ts`** — find the `createClient` block, replace with:
```typescript
import { supabase } from '@/lib/novel/store'
```

**`app/api/novel/export/route.ts`** — same pattern.

**`app/api/novel/workflow/route.ts`** — lines 2-7, replace with:
```typescript
import { supabase } from '@/lib/novel/store'
```

**`app/api/novel/workflow/nine-segment/route.ts`** — lines 4-9, replace with:
```typescript
import { supabase } from '@/lib/novel/store'
```

- [ ] **Step 5: Verify no remaining local `createClient` in novel files**

Run: `grep -r "createClient" lib/novel/ app/api/novel/ --include="*.ts"`

Expected: only `lib/novel/store.ts` should have `createClient`. All other files should import from `store.ts`.

- [ ] **Step 6: Commit**

```bash
git add lib/novel/store.ts lib/novel/agents/state-machine.ts app/api/novel/route.ts app/api/novel/memory/route.ts app/api/novel/import/route.ts app/api/novel/export/route.ts app/api/novel/workflow/route.ts app/api/novel/workflow/nine-segment/route.ts
git commit -m "fix: consolidate Supabase client to single instance, remove in-memory currentNovelId"
```

---

## Task 2: Consolidate `parseJsonFromLLM`

**Files:**
- Modify: `lib/novel/ai-config.ts` — add canonical `parseJsonFromLLM`
- Modify: `lib/novel/agents/workflow.ts` — import from `ai-config`
- Modify: `lib/novel/agents/director.ts` — import from `ai-config`
- Modify: `lib/novel/agents/missing-agents.ts` — re-export from `ai-config`
- Modify: `app/api/novel/workflow/nine-segment/route.ts` — import from `ai-config`

**Why:** The same JSON extraction function is duplicated 4 times with slightly different error handling. One canonical version prevents bugs.

- [ ] **Step 1: Add `parseJsonFromLLM` to `ai-config.ts`**

Append to `lib/novel/ai-config.ts` (after the existing `extractJson` function):

```typescript
// Canonical JSON extraction from LLM output (used by all agents)
// Handles: markdown code blocks, raw JSON, common LLM formatting issues
export function parseJsonFromLLM(text: string): any {
  // Try markdown code block first
  const codeBlock = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()) } catch {}
  }

  // Try direct JSON match
  const match = text.match(/\{[\s\S]*\}/)
  if (match) {
    try { return JSON.parse(match[0]) } catch {
      // Fix common LLM formatting issues
      try {
        const fixed = match[0]
          .replace(/\bundefined\b/g, 'null')
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
        return JSON.parse(fixed)
      } catch {}
    }
  }

  return null
}
```

- [ ] **Step 2: Update `workflow.ts` to import from `ai-config`**

In `lib/novel/agents/workflow.ts`, change line 11:

```typescript
import { STYLE_GUARD_SYSTEM_PROMPT, FORESHADOW_AGENT_SYSTEM_PROMPT, POWER_SYSTEM_AGENT_PROMPT, parseJsonFromLLM as parseMissing } from './missing-agents'
```

to:

```typescript
import { STYLE_GUARD_SYSTEM_PROMPT, FORESHADOW_AGENT_SYSTEM_PROMPT, POWER_SYSTEM_AGENT_PROMPT } from './missing-agents'
```

Then add this import (near the other imports):

```typescript
import { parseJsonFromLLM } from '../ai-config'
```

Delete the local `parseJsonFromLLM` function (lines 73-90).

- [ ] **Step 3: Update `missing-agents.ts` to re-export from `ai-config`**

In `lib/novel/agents/missing-agents.ts`, find the local `parseJsonFromLLM` function (around line 157). Delete it and add at the top of the file:

```typescript
export { parseJsonFromLLM } from '../ai-config'
```

This ensures any file that was importing from `missing-agents` still works.

- [ ] **Step 4: Update `nine-segment/route.ts` to use shared parser**

In `app/api/novel/workflow/nine-segment/route.ts`, replace the local `parseJson` function (lines 23-31) with:

```typescript
import { parseJsonFromLLM as parseJson } from '@/lib/novel/ai-config'
```

- [ ] **Step 5: Check `director.ts` for local `parseJsonFromLLM`**

Read `lib/novel/agents/director.ts`. If it has a local `parseJsonFromLLM`, delete it and add:

```typescript
import { parseJsonFromLLM } from '../ai-config'
```

- [ ] **Step 6: Verify no duplicate definitions remain**

Run: `grep -rn "function parseJson" lib/novel/ app/api/novel/ --include="*.ts"`

Expected: only `lib/novel/ai-config.ts` should define it. Others should import.

- [ ] **Step 7: Commit**

```bash
git add lib/novel/ai-config.ts lib/novel/agents/workflow.ts lib/novel/agents/missing-agents.ts lib/novel/agents/director.ts app/api/novel/workflow/nine-segment/route.ts
git commit -m "fix: consolidate parseJsonFromLLM into ai-config, remove 4 duplicates"
```

---

## Task 3: Fix Character Review Overwrite Bug

**Files:**
- Modify: `lib/novel/agents/workflow.ts`

**Why:** `reviewByStyleGuard` (line 223) and `reviewByForeshadow` (line 240) both write to `characterReview` by spreading `state.characterReview`, which overwrites the OOC data from the actual character director review. Each reviewer should have its own state field.

- [ ] **Step 1: Add new state fields for each reviewer**

In `lib/novel/agents/workflow.ts`, add these fields to the `ChapterState` definition (after `characterReview` on line 54):

```typescript
  styleGuardReview: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),
  foreshadowReview: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),
  powerSystemReview: Annotation<any>({ reducer: (_, prev) => prev, default: () => null }),
```

- [ ] **Step 2: Fix `reviewByStyleGuard` return value**

Change line 223 from:

```typescript
  return { characterReview: { ...state.characterReview, styleGuard: review }, logs }
```

to:

```typescript
  return { styleGuardReview: review, logs }
```

- [ ] **Step 3: Fix `reviewByForeshadow` return value**

Change line 240 from:

```typescript
  return { characterReview: { ...state.characterReview, foreshadow: review }, logs }
```

to:

```typescript
  return { foreshadowReview: review, logs }
```

- [ ] **Step 4: Fix `reviewByPowerSystem` return value**

Change line 258 from:

```typescript
  return { characterReview: { ...state.characterReview, powerSystem: review }, logs }
```

to:

```typescript
  return { powerSystemReview: review, logs }
```

- [ ] **Step 5: Update `synthesizeReviews` to include new fields in `allScores`**

In the `synthesizeReviews` function (around line 306), add these to the `allScores` object:

```typescript
    styleGuard: state.styleGuardReview,
    foreshadow: state.foreshadowReview,
    powerSystem: state.powerSystemReview,
```

- [ ] **Step 6: Update `initialState` in `runChapterWorkflow`**

In `runChapterWorkflow` (around line 404), add to `initialState`:

```typescript
    styleGuardReview: null,
    foreshadowReview: null,
    powerSystemReview: null,
```

- [ ] **Step 7: Commit**

```bash
git add lib/novel/agents/workflow.ts
git commit -m "fix: separate state fields for style/foreshadow/power reviewers to prevent characterReview overwrite"
```

---

## Task 4: Fix Generate Endpoint to Use Multi-Provider Config

**Files:**
- Modify: `app/api/novel/generate/route.ts`

**Why:** Currently hardcoded to DeepSeek. Should use `ai-config.ts` like the workflow and nine-segment paths do.

- [ ] **Step 1: Replace the entire file**

Replace `app/api/novel/generate/route.ts` with:

```typescript
import { NextRequest } from 'next/server'
import { getCurrentConfig, getHeaders, buildMessages } from '@/lib/novel/ai-config'

export async function POST(req: NextRequest) {
  try {
    const { novelId, chapter, prompt } = await req.json()

    if (!prompt) {
      return new Response(JSON.stringify({ error: '缺少写作提示' }), { status: 400 })
    }

    const config = getCurrentConfig()
    if (!config.hasApiKey) {
      return new Response(JSON.stringify({ error: `未配置 ${config.providerName} API Key` }), { status: 500 })
    }

    const url = `${config.baseUrl}/v1/chat/completions`
    const headers = getHeaders()
    const body = buildMessages(
      '你是一位专业的网络小说作家，擅长写长篇小说。请直接输出章节正文，不要输出任何元数据或标注。',
      prompt,
      { temperature: 0.85, maxTokens: 4096 }
    )

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, stream: true }),
    })

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `${config.providerName} API 错误: ${response.status}` }),
        { status: 500 }
      )
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/novel/generate/route.ts
git commit -m "fix: use multi-provider ai-config for generate endpoint instead of hardcoded DeepSeek"
```

---

## Task 5: Fix Sync Endpoint Error Handling

**Files:**
- Modify: `app/api/novel/route.ts`

**Why:** `.catch(() => {})` silently swallows errors. Users see "saved" even when extraction data fails to persist.

- [ ] **Step 1: Replace the sync handler**

In `app/api/novel/route.ts`, replace lines 88-104 (the sync block) with:

```typescript
    if (s[0] === 'novels' && s[2] === 'sync' && s[3]) {
      const ch = parseInt(s[3])
      const ext = d.extraction || {}
      const errors: string[] = []

      for (const f of ext.new_foreshadows || []) {
        try {
          await addForeshadow(s[1], f.content, ch, f.importance, f.tier, f.category, f.expected_reveal_range)
        } catch (e: any) {
          errors.push(`伏笔: ${e.message}`)
        }
      }
      for (const id of ext.closed_foreshadows || []) {
        try {
          await closeForeshadow(s[1], id, ch)
        } catch (e: any) {
          errors.push(`关闭伏笔 ${id}: ${e.message}`)
        }
      }
      for (const r of ext.revelations || []) {
        try {
          await revealMystery(s[1], r.mystery_id, ch, r.delta, r.note)
        } catch (e: any) {
          errors.push(`悬念 ${r.mystery_id}: ${e.message}`)
        }
      }
      for (const r of ext.relationship_updates || []) {
        try {
          await updateTrust(s[1], r.from, r.to, r.trust_delta || r.delta || 0, ch, r.reason, r.type)
        } catch (e: any) {
          errors.push(`关系 ${r.from}->${r.to}: ${e.message}`)
        }
      }

      await updateProgress(s[1], ch, ext.word_count || 0)

      if (errors.length > 0) {
        return NextResponse.json({ ok: true, warnings: errors })
      }
      return NextResponse.json({ ok: true })
    }
```

- [ ] **Step 2: Commit**

```bash
git add app/api/novel/route.ts
git commit -m "fix: report sync errors as warnings instead of silently swallowing them"
```

---

## Task 6: Fix Foreshadow ID Collision

**Files:**
- Modify: `lib/novel/foreshadows.ts`

**Why:** Current ID generation (`existing.length + 1`) is vulnerable to race conditions. Two concurrent requests can produce the same ID.

- [ ] **Step 1: Replace ID generation in `addForeshadow`**

In `lib/novel/foreshadows.ts`, replace lines 19-21:

```typescript
  const { data: existing } = await supabase.from('foreshadows').select('id').eq('novel_id', novelId)
  const nextNum = (existing?.length || 0) + 1
  const id = `fs_${String(nextNum).padStart(3, '0')}`
```

with:

```typescript
  // Use timestamp + random suffix to avoid ID collisions in concurrent requests
  const id = `fs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
```

- [ ] **Step 2: Commit**

```bash
git add lib/novel/foreshadows.ts
git commit -m "fix: use unique ID generation for foreshadows to prevent collision"
```

---

## Task 7: Add Missing Database Tables to Schema

**Files:**
- Modify: `supabase-novel.sql`

**Why:** Code references 5 tables (`worlds`, `characters`, `timelines`, `story_states`, `novel_souls`) that don't exist in the schema file. New deployments will fail.

- [ ] **Step 1: Append missing tables to `supabase-novel.sql`**

Add these table definitions after the existing `power_systems` table (before the indexes section):

```sql
-- 7. 世界观设定
CREATE TABLE IF NOT EXISTS worlds (
  id TEXT PRIMARY KEY,
  novel_id TEXT REFERENCES novels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  category TEXT DEFAULT 'general',
  importance INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 角色设定
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  novel_id TEXT REFERENCES novels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  identity TEXT,
  faction TEXT,
  realm TEXT,
  personality JSONB DEFAULT '{}',
  beliefs TEXT,
  weaknesses TEXT,
  first_appearance INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 时间线事件
CREATE TABLE IF NOT EXISTS timelines (
  id BIGSERIAL PRIMARY KEY,
  novel_id TEXT REFERENCES novels(id) ON DELETE CASCADE,
  chapter_num INTEGER NOT NULL,
  event_order INTEGER DEFAULT 1,
  event_type TEXT DEFAULT 'plot',
  title TEXT NOT NULL,
  description TEXT,
  characters_involved TEXT[] DEFAULT '{}',
  importance INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. 剧情状态
CREATE TABLE IF NOT EXISTS story_states (
  id TEXT PRIMARY KEY,
  novel_id TEXT REFERENCES novels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'main_plot',
  description TEXT,
  progress NUMERIC DEFAULT 0,
  current_stage INTEGER DEFAULT 1,
  max_stages INTEGER DEFAULT 6,
  last_updated_chapter INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. 小说灵魂（核心设定）
CREATE TABLE IF NOT EXISTS novel_souls (
  id TEXT PRIMARY KEY,
  novel_id TEXT REFERENCES novels(id) ON DELETE CASCADE UNIQUE,
  core_selling_points TEXT[] DEFAULT '{}',
  forbidden_directions TEXT[] DEFAULT '{}',
  tone TEXT,
  reader_promise TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Also add indexes for the new tables:

```sql
CREATE INDEX IF NOT EXISTS idx_worlds_novel ON worlds(novel_id);
CREATE INDEX IF NOT EXISTS idx_characters_novel ON characters(novel_id);
CREATE INDEX IF NOT EXISTS idx_timelines_novel ON timelines(novel_id, chapter_num);
CREATE INDEX IF NOT EXISTS idx_story_states_novel ON story_states(novel_id);
```

And RLS policies:

```sql
ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE novel_souls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own worlds" ON worlds
  FOR ALL USING (novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own characters" ON characters
  FOR ALL USING (novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own timelines" ON timelines
  FOR ALL USING (novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own story_states" ON story_states
  FOR ALL USING (novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own novel_souls" ON novel_souls
  FOR ALL USING (novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid()));
```

- [ ] **Step 2: Commit**

```bash
git add supabase-novel.sql
git commit -m "fix: add missing tables (worlds, characters, timelines, story_states, novel_souls) to schema"
```

---

## Task 8: Add Auth Check to Novel Routes

**Files:**
- Modify: `app/api/novel/route.ts`

**Why:** The API uses `service_role_key` which bypasses RLS. Without explicit auth checks, anyone can access any novel. `listNovels()` never receives `userId`.

- [ ] **Step 1: Add auth helper at top of `app/api/novel/route.ts`**

Add after imports:

```typescript
import { createClient } from '@supabase/supabase-js'

// User-facing Supabase client (respects RLS)
function getUserSupabase(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return null

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

async function getUserId(req: NextRequest): Promise<string | null> {
  const userClient = getUserSupabase(req)
  if (!userClient) return null
  const { data: { user } } = await userClient.auth.getUser()
  return user?.id || null
}
```

- [ ] **Step 2: Add auth check to `GET /novels` (list all)**

Change line 22 from:

```typescript
    if (s[0] === 'novels' && !s[1]) return NextResponse.json(await listNovels())
```

to:

```typescript
    if (s[0] === 'novels' && !s[1]) {
      const userId = await getUserId(req)
      return NextResponse.json(await listNovels(userId || undefined))
    }
```

- [ ] **Step 3: Add ownership verification for novel access**

Add a helper function:

```typescript
async function verifyNovelOwnership(novelId: string, userId: string): Promise<boolean> {
  const { data } = await supabase.from('novels').select('user_id').eq('id', novelId).single()
  return data?.user_id === userId
}
```

Then add ownership checks to the key GET/POST routes that access specific novels. For example, the chapters GET (line 41):

```typescript
    if (s[0] === 'novels' && s[2] === 'chapters' && !s[3]) {
      const userId = await getUserId(req)
      if (userId && !(await verifyNovelOwnership(s[1], userId))) {
        return NextResponse.json({ error: '无权访问' }, { status: 403 })
      }
      const { data } = await supabase.from('chapters').select('chapter_num, title, word_count').eq('novel_id', s[1]).order('chapter_num')
      return NextResponse.json((data || []).map(c => ({ chapter: c.chapter_num, title: c.title || `第${c.chapter_num}章`, word_count: c.word_count || 0 })))
    }
```

Apply the same pattern to other novel-specific routes (POST chapters, POST sync, POST foreshadows, etc.).

- [ ] **Step 4: Commit**

```bash
git add app/api/novel/route.ts
git commit -m "fix: add auth checks to novel routes, pass userId to listNovels"
```

---

## Task 9: Fix `checkMysteryConstraints` Unused Variable

**Files:**
- Modify: `lib/novel/agents/state-machine.ts`

**Why:** `maxRevelationAllowed` is initialized to 100 and never modified, making it meaningless.

- [ ] **Step 1: Calculate actual max revelation in `checkMysteryConstraints`**

Replace the function body (lines 242-286) with:

```typescript
export function checkMysteryConstraints(snapshot: StoryStateSnapshot, chapter: number): {
  canReveal: boolean
  maxRevelationAllowed: number
  blockedMysteries: string[]
  notes: string[]
} {
  const notes: string[] = []
  const blockedMysteries: string[] = []
  let totalMaxDelta = 0

  const allMysteries = [...snapshot.characterMysteries, ...snapshot.worldMysteries]

  for (const mystery of allMysteries) {
    if (mystery.progress >= 100) {
      notes.push(`${mystery.name} 已完全揭露`)
      continue
    }

    if (mystery.currentStage >= mystery.maxStages) {
      notes.push(`${mystery.name} 已达最大阶段，不能继续揭露`)
      blockedMysteries.push(mystery.name)
      continue
    }

    const remainingProgress = 100 - mystery.progress
    const remainingStages = mystery.maxStages - mystery.currentStage
    const maxDelta = remainingStages > 0 ? Math.min(remainingProgress, 100 / mystery.maxStages) : 0
    totalMaxDelta += maxDelta

    notes.push(`${mystery.name}: 本章最多揭露 ${maxDelta.toFixed(0)}%`)
  }

  return {
    canReveal: blockedMysteries.length === 0,
    maxRevelationAllowed: totalMaxDelta,
    blockedMysteries,
    notes,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/novel/agents/state-machine.ts
git commit -m "fix: calculate actual maxRevelationAllowed in checkMysteryConstraints"
```

---

## Task 10: Remove Orphaned `data/novels/` Directory

**Files:**
- Delete: `data/novels/` directory

**Why:** This local filesystem storage is never referenced by any code. All data operations go through Supabase. It confuses developers.

- [ ] **Step 1: Verify no code references `data/novels/`**

Run: `grep -r "data/novels" lib/ app/ components/ --include="*.ts" --include="*.tsx"`

Expected: no results.

- [ ] **Step 2: Remove the directory**

```bash
rm -rf data/novels
```

- [ ] **Step 3: Commit**

```bash
git add -A data/novels
git commit -m "chore: remove orphaned data/novels/ directory (unused filesystem storage)"
```

---

## Summary

| Task | Issue | Severity | Files Changed |
|------|-------|----------|---------------|
| 1 | Consolidate Supabase client | 🔴 Critical | 8 files |
| 2 | Consolidate `parseJsonFromLLM` | 🟠 Important | 5 files |
| 3 | Fix character review overwrite | 🔴 Critical | 1 file |
| 4 | Fix generate endpoint providers | 🔴 Critical | 1 file |
| 5 | Fix sync error handling | 🟠 Important | 1 file |
| 6 | Fix foreshadow ID collision | 🟠 Important | 1 file |
| 7 | Add missing DB tables | 🔴 Critical | 1 file |
| 8 | Add auth checks | 🔴 Critical | 1 file |
| 9 | Fix mystery constraints | 🟡 Minor | 1 file |
| 10 | Remove orphaned data | 🟡 Minor | delete dir |

**Estimated effort:** ~2-3 hours for all tasks
