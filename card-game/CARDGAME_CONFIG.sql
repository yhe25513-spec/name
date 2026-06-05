-- 在 Supabase SQL Editor 中执行
-- 创建配置表（如果不存在）

CREATE TABLE IF NOT EXISTS app_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入斗地主 API Key 配置项
INSERT INTO app_config (key, value) VALUES ('cardgame_api_key', '')
ON CONFLICT (key) DO NOTHING;
