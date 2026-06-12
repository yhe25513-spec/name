-- AI 短剧创作工作室 - 数据库表
-- 在 Supabase SQL Editor 中执行

-- 短剧项目表
CREATE TABLE IF NOT EXISTS public.drama_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT '未命名短剧',
  synopsis TEXT DEFAULT '',
  genre TEXT DEFAULT '其他',
  style TEXT DEFAULT '写实',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'editing', 'composing', 'done')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.drama_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own projects" ON public.drama_projects
  FOR ALL USING (auth.uid() = user_id);

-- 短剧分镜表
CREATE TABLE IF NOT EXISTS public.drama_scenes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.drama_projects(id) ON DELETE CASCADE NOT NULL,
  scene_number INT NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  image_prompt TEXT DEFAULT '',
  dialogue TEXT DEFAULT '',
  character_name TEXT DEFAULT '',
  character_description TEXT DEFAULT '',
  emotion TEXT DEFAULT 'neutral',
  image_url TEXT DEFAULT '',
  video_url TEXT DEFAULT '',
  audio_url TEXT DEFAULT '',
  subtitle TEXT DEFAULT '',
  duration INT DEFAULT 5,
  image_request_id TEXT DEFAULT '',
  video_request_id TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  error TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.drama_scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own scenes" ON public.drama_scenes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.drama_projects
      WHERE id = project_id AND user_id = auth.uid()
    )
  );
