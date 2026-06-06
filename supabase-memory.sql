-- ============================================
-- AI Novel Studio - 记忆层数据库
-- 5大核心数据库：世界观 / 角色 / 时间线 / 伏笔 / 剧情状态机
-- ============================================

-- 1. 世界观数据库
CREATE TABLE IF NOT EXISTS worlds (
  id TEXT PRIMARY KEY,
  novel_id TEXT REFERENCES novels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'rule',  -- rule/history/race/faction/taboo/location/item
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  importance NUMERIC DEFAULT 5,  -- 1-10
  chapter_introduced INTEGER DEFAULT 1,
  related_characters TEXT[] DEFAULT '{}',
  related_factions TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 角色数据库
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  novel_id TEXT REFERENCES novels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  alias TEXT[] DEFAULT '{}',        -- 别名/称号
  identity TEXT DEFAULT '',          -- 身份
  age TEXT DEFAULT '',               -- 年龄
  gender TEXT DEFAULT '',            -- 性别
  faction TEXT DEFAULT '',           -- 所属势力
  personality JSONB DEFAULT '{}',    -- 性格特征
  beliefs TEXT DEFAULT '',           -- 核心信念
  weaknesses TEXT DEFAULT '',        -- 弱点
  appearance TEXT DEFAULT '',        -- 外貌描述
  abilities TEXT[] DEFAULT '{}',     -- 能力列表
  realm TEXT DEFAULT '',             -- 境界/等级
  -- 台词系统 (Dialogue Profile)
  dialogue_profile JSONB DEFAULT '{}',
  -- 成长轨迹
  growth_trajectory JSONB DEFAULT '[]',
  -- 关系网
  relationships JSONB DEFAULT '{}',
  -- 角色状态
  status TEXT DEFAULT 'active',     -- active/dead/missing/unknown
  first_appearance INTEGER DEFAULT 1,
  last_appearance INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 时间线数据库
CREATE TABLE IF NOT EXISTS timelines (
  id BIGSERIAL PRIMARY KEY,
  novel_id TEXT REFERENCES novels(id) ON DELETE CASCADE,
  chapter_num INTEGER NOT NULL,
  event_order INTEGER DEFAULT 0,    -- 同一章节内的事件顺序
  event_type TEXT DEFAULT 'plot',    -- plot/character/world/battle/revelation
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  characters_involved TEXT[] DEFAULT '{}',
  locations TEXT[] DEFAULT '{}',
  factions_involved TEXT[] DEFAULT '{}',
  consequences TEXT DEFAULT '',      -- 事件后果
  foreshadow_ids TEXT[] DEFAULT '{}', -- 关联伏笔
  mystery_ids TEXT[] DEFAULT '{}',    -- 关联悬念
  importance NUMERIC DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(novel_id, chapter_num, event_order)
);

-- 4. 剧情状态机
CREATE TABLE IF NOT EXISTS story_states (
  id TEXT PRIMARY KEY,
  novel_id TEXT REFERENCES novels(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'main_plot',  -- main_plot/side_plot/character_mystery/world_mystery
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  progress NUMERIC DEFAULT 0,       -- 0-100 揭露度
  current_stage INTEGER DEFAULT 1,
  max_stages INTEGER DEFAULT 6,
  stages JSONB DEFAULT '[]',        -- 每个阶段的描述
  constraints JSONB DEFAULT '{}',   -- 约束条件（如：不能提前揭秘）
  last_updated_chapter INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 伏笔数据库（增强版，替代原有的 foreshadows 表）
-- 保留原有表结构，增加字段
ALTER TABLE foreshadows ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'sub';
ALTER TABLE foreshadows ADD COLUMN IF NOT EXISTS related_characters TEXT[] DEFAULT '{}';
ALTER TABLE foreshadows ADD COLUMN IF NOT EXISTS related_events TEXT[] DEFAULT '{}';
ALTER TABLE foreshadows ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- 6. 小说核心卖点（总导演守护）
CREATE TABLE IF NOT EXISTS novel_souls (
  id TEXT PRIMARY KEY,
  novel_id TEXT REFERENCES novels(id) ON DELETE CASCADE UNIQUE,
  core_selling_points JSONB DEFAULT '[]',  -- 核心卖点列表
  forbidden_directions JSONB DEFAULT '[]', -- 禁止方向
  tone TEXT DEFAULT '',                     -- 整体调性
  reader_promise TEXT DEFAULT '',           -- 读者承诺
  target_audience TEXT DEFAULT '',          -- 目标读者
  genre_tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_worlds_novel ON worlds(novel_id, category);
CREATE INDEX IF NOT EXISTS idx_characters_novel ON characters(novel_id, status);
CREATE INDEX IF NOT EXISTS idx_timelines_novel ON timelines(novel_id, chapter_num);
CREATE INDEX IF NOT EXISTS idx_story_states_novel ON story_states(novel_id, category);

-- RLS 策略（使用 service role 绕过，但保留基础策略）
ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE novel_souls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON worlds FOR ALL USING (true);
CREATE POLICY "Service role full access" ON characters FOR ALL USING (true);
CREATE POLICY "Service role full access" ON timelines FOR ALL USING (true);
CREATE POLICY "Service role full access" ON story_states FOR ALL USING (true);
CREATE POLICY "Service role full access" ON novel_souls FOR ALL USING (true);
