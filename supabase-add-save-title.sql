-- 给 game_saves 表添加 title 和 summary 列
ALTER TABLE public.game_saves
  ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS summary TEXT DEFAULT '';
