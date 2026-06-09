-- Agnes AI 集成迁移脚本
-- 添加视频每日次数限制字段

-- 添加视频每日次数字段到 profiles 表
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS daily_video_count INT NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS daily_video_date TEXT NOT NULL DEFAULT '';

-- 确认字段存在
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('daily_image_count', 'daily_image_date', 'daily_video_count', 'daily_video_date');
