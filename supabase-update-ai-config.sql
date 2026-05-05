-- 更新 admin_config 表以支持多模型配置
-- 运行此脚本添加新的字段

-- 添加 provider 字段
ALTER TABLE public.admin_config ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'deepseek';

-- 刷新 schema cache（解决 Supabase "Could not find the column" 错误）
-- 方法1：注释掉一个现有列再取消注释
COMMENT ON COLUMN public.admin_config.model IS 'AI model name';
COMMENT ON COLUMN public.admin_config.model IS NULL;

-- 添加通用 api_key 字段
ALTER TABLE public.admin_config ADD COLUMN IF NOT EXISTS api_key TEXT;

-- 将旧的 deepseek_api_key 复制到新的 api_key 字段
UPDATE public.admin_config SET api_key = deepseek_api_key WHERE deepseek_api_key IS NOT NULL AND api_key IS NULL;

-- 添加 api_base_url 字段（用于自定义API）
ALTER TABLE public.admin_config ADD COLUMN IF NOT EXISTS api_base_url TEXT;

-- 确认字段已添加
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'admin_config'
ORDER BY ordinal_position;
