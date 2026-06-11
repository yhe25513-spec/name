-- =============================================
-- 安全修复 SQL — 在 Supabase SQL Editor 中执行
-- =============================================

-- =============================================
-- 一、修复 3 个错误：RLS 未启用
-- =============================================

-- 1. 启用 image_generation_logs 的 RLS
ALTER TABLE public.image_generation_logs ENABLE ROW LEVEL SECURITY;
-- 管理员可读写，其他人不可见
CREATE POLICY "Admins can manage image_generation_logs" ON public.image_generation_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. 启用 app_config 的 RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
-- 只有管理员能读写
CREATE POLICY "Admins can manage app_config" ON public.app_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. 启用 doudizhu_rooms 的 RLS
ALTER TABLE public.doudizhu_rooms ENABLE ROW LEVEL SECURITY;
-- 登录用户可创建/加入房间（实际权限由应用逻辑控制）
CREATE POLICY "Users can create rooms" ON public.doudizhu_rooms
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view rooms" ON public.doudizhu_rooms
  FOR SELECT USING (true);
CREATE POLICY "Room owners can update rooms" ON public.doudizhu_rooms
  FOR UPDATE USING (
    auth.uid() = (players->0->>'userId')::uuid
    OR auth.uid() = (players->1->>'userId')::uuid
  );
CREATE POLICY "Room owners can delete rooms" ON public.doudizhu_rooms
  FOR DELETE USING (
    auth.uid() = (players->0->>'userId')::uuid
  );

-- =============================================
-- 二、修复 8 个警告
-- =============================================

-- 警告 1+2：handle_new_user 和 is_admin 缺少 search_path
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- is_admin 函数（如果不存在则创建，存在则替换）
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 警告 3：hotpot_orders 的 RLS 策略过于宽松（USING true）
-- 删除旧策略，重新创建
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.hotpot_orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.hotpot_orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.hotpot_orders;

-- 任何人都可以下单（合理——顾客不需要登录）
CREATE POLICY "Anyone can insert orders" ON public.hotpot_orders
  FOR INSERT WITH CHECK (true);

-- 只有管理员可以查看订单
CREATE POLICY "Admins can view all orders" ON public.hotpot_orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 只有管理员可以更新订单
CREATE POLICY "Admins can update orders" ON public.hotpot_orders
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 警告 4+6：handle_new_user 是 SECURITY DEFINER，已通过 SET search_path 修复
-- 警告 5+7：is_admin 是 SECURITY DEFINER，已通过 SET search_path 修复

-- =============================================
-- 三、关于 Auth 泄露密码保护（Supabase 控制台手动操作）
-- =============================================
-- 在 Supabase Dashboard > Authentication > Providers > Email
-- 启用 "Leaked password protection"
-- 这个无法通过 SQL 设置，需要手动在界面开启

-- =============================================
-- 执行完毕后点击 Rerun linter 验证
-- =============================================
