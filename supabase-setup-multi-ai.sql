-- =============================================
-- 多 AI 配置支持 - 完整设置脚本
-- =============================================

-- 1. 创建 ai_configs 表
CREATE TABLE IF NOT EXISTS public.ai_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'custom',
  model TEXT NOT NULL DEFAULT 'gpt-3.5-turbo',
  api_key TEXT NOT NULL DEFAULT '',
  api_base_url TEXT,
  temperature REAL NOT NULL DEFAULT 0.8,
  max_tokens INT NOT NULL DEFAULT 1024,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 启用 RLS
ALTER TABLE public.ai_configs ENABLE ROW LEVEL SECURITY;

-- 3. 创建 RLS 策略
DROP POLICY IF EXISTS "Only admins can manage ai_configs" ON public.ai_configs;
CREATE POLICY "Only admins can manage ai_configs" ON public.ai_configs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. 为 game_scenarios 添加 ai_config_id 字段
ALTER TABLE public.game_scenarios 
ADD COLUMN IF NOT EXISTS ai_config_id UUID REFERENCES public.ai_configs(id) ON DELETE SET NULL;

-- 5. 创建索引
CREATE INDEX IF NOT EXISTS idx_ai_configs_default ON public.ai_configs(is_default);
CREATE INDEX IF NOT EXISTS idx_scenarios_ai_config ON public.game_scenarios(ai_config_id);

-- 6. 迁移现有 admin_config 数据到 ai_configs
DO $$
DECLARE
  existing_config RECORD;
  new_config_id UUID;
BEGIN
  -- 获取现有配置
  SELECT * INTO existing_config FROM public.admin_config LIMIT 1;
  
  IF existing_config IS NOT NULL THEN
    -- 检查是否已有默认配置
    IF NOT EXISTS (SELECT 1 FROM public.ai_configs WHERE is_default = TRUE) THEN
      -- 插入为默认配置
      INSERT INTO public.ai_configs (
        name,
        provider,
        model,
        api_key,
        api_base_url,
        temperature,
        max_tokens,
        is_default
      ) VALUES (
        '默认配置',
        COALESCE(existing_config.provider, 'deepseek'),
        existing_config.model,
        COALESCE(existing_config.api_key, existing_config.deepseek_api_key, ''),
        existing_config.api_base_url,
        existing_config.temperature,
        existing_config.max_tokens,
        TRUE
      )
      RETURNING id INTO new_config_id;
      
      -- 更新所有没有绑定配置的场景
      UPDATE public.game_scenarios 
      SET ai_config_id = new_config_id 
      WHERE ai_config_id IS NULL;
    END IF;
  END IF;
END $$;

-- 7. 如果没有配置，插入一个默认 DeepSeek 配置
INSERT INTO public.ai_configs (name, provider, model, api_key, temperature, max_tokens, is_default)
SELECT 'DeepSeek 默认', 'deepseek', 'deepseek-chat', '', 0.8, 1024, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.ai_configs);

-- 8. 确认字段已添加
SELECT 'ai_configs 表字段:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ai_configs' 
ORDER BY ordinal_position;

SELECT 'game_scenarios 表字段:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'game_scenarios' 
ORDER BY ordinal_position;
