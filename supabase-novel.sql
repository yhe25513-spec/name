-- ============================================
-- AI Novel Studio 数据库表
-- 在 Supabase SQL Editor 中运行此脚本
-- ============================================

-- 1. 小说列表
CREATE TABLE IF NOT EXISTS novels (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  genre TEXT DEFAULT '未分类',
  soul JSONB DEFAULT '{}',
  progress JSONB DEFAULT '{"current_chapter": 0, "total_words": 0}',
  style JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. 章节正文
CREATE TABLE IF NOT EXISTS chapters (
  id BIGSERIAL PRIMARY KEY,
  novel_id TEXT REFERENCES novels(id) ON DELETE CASCADE,
  chapter_num INTEGER NOT NULL,
  title TEXT,
  content TEXT,
  word_count INTEGER DEFAULT 0,
  extraction JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(novel_id, chapter_num)
);

-- 3. 伏笔
CREATE TABLE IF NOT EXISTS foreshadows (
  id TEXT PRIMARY KEY,
  novel_id TEXT REFERENCES novels(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chapter_planted INTEGER NOT NULL,
  importance TEXT DEFAULT '支线',
  tier TEXT DEFAULT 'sub',
  status TEXT DEFAULT '未回收',
  category TEXT DEFAULT 'plot_hook',
  expected_reveal_range INTEGER[] DEFAULT '{0,0}',
  actual_reveal_chapter INTEGER,
  evidence TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 悬念
CREATE TABLE IF NOT EXISTS mysteries (
  id TEXT PRIMARY KEY,
  novel_id TEXT REFERENCES novels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tier TEXT DEFAULT '支线',
  revelation_progress NUMERIC DEFAULT 0,
  planted_chapter INTEGER DEFAULT 1,
  current_stage INTEGER DEFAULT 1,
  max_per_chapter NUMERIC DEFAULT 5,
  revelation_stages JSONB DEFAULT '[]',
  forbidden_chapters INTEGER[] DEFAULT '{}',
  last_updated_chapter INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 角色关系
CREATE TABLE IF NOT EXISTS relationships (
  id BIGSERIAL PRIMARY KEY,
  novel_id TEXT REFERENCES novels(id) ON DELETE CASCADE,
  from_char TEXT NOT NULL,
  to_char TEXT NOT NULL,
  rel_type TEXT DEFAULT '未知',
  trust_level NUMERIC DEFAULT 0,
  trust_history JSONB DEFAULT '[]',
  last_updated_chapter INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(novel_id, from_char, to_char)
);

-- 6. 战力体系
CREATE TABLE IF NOT EXISTS power_systems (
  id BIGSERIAL PRIMARY KEY,
  novel_id TEXT REFERENCES novels(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL,
  realm TEXT,
  sub_realm TEXT,
  combat_power_est NUMERIC DEFAULT 0,
  key_abilities TEXT[] DEFAULT '{}',
  last_updated_chapter INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(novel_id, character_id)
);

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

-- 索引
CREATE INDEX IF NOT EXISTS idx_chapters_novel ON chapters(novel_id, chapter_num);
CREATE INDEX IF NOT EXISTS idx_foreshadows_novel ON foreshadows(novel_id, status);
CREATE INDEX IF NOT EXISTS idx_mysteries_novel ON mysteries(novel_id);
CREATE INDEX IF NOT EXISTS idx_relationships_novel ON relationships(novel_id);
CREATE INDEX IF NOT EXISTS idx_worlds_novel ON worlds(novel_id);
CREATE INDEX IF NOT EXISTS idx_characters_novel ON characters(novel_id);
CREATE INDEX IF NOT EXISTS idx_timelines_novel ON timelines(novel_id, chapter_num);
CREATE INDEX IF NOT EXISTS idx_story_states_novel ON story_states(novel_id);

-- RLS 策略（允许登录用户读写自己的数据）
ALTER TABLE novels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE foreshadows ENABLE ROW LEVEL SECURITY;
ALTER TABLE mysteries ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE power_systems ENABLE ROW LEVEL SECURITY;

-- 用户只能读写自己的小说
CREATE POLICY "Users can manage own novels" ON novels
  FOR ALL USING (auth.uid() = user_id);

-- 章节通过novel_id关联，需要joins控制
CREATE POLICY "Users can manage own chapters" ON chapters
  FOR ALL USING (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage own foreshadows" ON foreshadows
  FOR ALL USING (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage own mysteries" ON mysteries
  FOR ALL USING (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage own relationships" ON relationships
  FOR ALL USING (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage own power_systems" ON power_systems
  FOR ALL USING (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

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
