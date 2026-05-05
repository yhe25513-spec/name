-- =============================================
-- 文字冒险游戏 - Supabase 初始化 SQL
-- 在 Supabase Dashboard > SQL Editor 中执行
-- =============================================

-- 1. profiles 表（用户扩展信息）
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 新用户注册时自动创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    'player'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. game_scenarios 表（游戏场景）
CREATE TABLE IF NOT EXISTS public.game_scenarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  initial_state JSONB NOT NULL DEFAULT '{"hp":100,"maxHp":100,"attributes":{},"inventory":[],"flags":{},"location":"起点"}',
  background_image_url TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.game_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published scenarios" ON public.game_scenarios
  FOR SELECT USING (is_published = TRUE);

CREATE POLICY "Admins can manage all scenarios" ON public.game_scenarios
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. game_saves 表（玩家存档）
CREATE TABLE IF NOT EXISTS public.game_saves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  scenario_id UUID REFERENCES public.game_scenarios(id) ON DELETE CASCADE NOT NULL,
  current_state JSONB NOT NULL DEFAULT '{}',
  conversation_history JSONB NOT NULL DEFAULT '[]',
  turn_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.game_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own saves" ON public.game_saves
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all saves" ON public.game_saves
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. conversation_logs 表（对话日志）
CREATE TABLE IF NOT EXISTS public.conversation_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  save_id UUID REFERENCES public.game_saves(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_input TEXT NOT NULL,
  ai_response JSONB NOT NULL,
  tokens_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.conversation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs" ON public.conversation_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all logs" ON public.conversation_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 5. admin_config 表（管理配置）
CREATE TABLE IF NOT EXISTS public.admin_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deepseek_api_key TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'deepseek-chat',
  temperature FLOAT DEFAULT 0.8,
  max_tokens INT DEFAULT 1024,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage config" ON public.admin_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 插入默认配置
INSERT INTO public.admin_config (deepseek_api_key, model, temperature, max_tokens)
VALUES ('', 'deepseek-chat', 0.8, 1024)
ON CONFLICT DO NOTHING;

-- 6. 插入示例场景（末日废土）
INSERT INTO public.game_scenarios (title, description, system_prompt, initial_state, is_published)
VALUES (
  '末日废土：生存者',
  '2047年，核战争摧毁了大部分文明。你是一名废土中的幸存者，在废墟中寻找希望。',
  '这是一个末日废土世界，时间是2047年。核战争已经过去20年，大多数城市沦为废墟，辐射区随处可见。幸存者聚集在几个庇护所和废土定居点中。资源极度匮乏，人性的善恶在生存压力下无处遁形。

世界特点：
- 辐射区域：部分地区辐射严重，进入需要防护装备
- 派系：庇护所管理委员会（秩序）、废土流浪者（自由）、地下黑市（利益）
- 资源：食物、水、药品、弹药是最宝贵的东西
- 危险：变异生物、匪帮、辐射风暴

叙事风格：写实、沉重，有黑暗幽默。强调生存选择的道德复杂性。每个NPC都有自己的动机和故事。',
  '{"hp":80,"maxHp":100,"attributes":{"力量":5,"敏捷":6,"智慧":4,"魅力":3},"inventory":["生锈的手枪","3颗子弹","净化药片×2","干粮×1"],"flags":{},"location":"废土定居点·门口"}',
  TRUE
)
ON CONFLICT DO NOTHING;

-- =============================================
-- 设置管理员账号（注册后执行，替换 email）
-- UPDATE public.profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'your-admin@email.com');
-- =============================================
