-- =============================================
-- 更新：允许普通用户创建和发布游戏场景
-- 在 Supabase Dashboard > SQL Editor 中执行
-- =============================================

-- 1. 添加 created_by 字段（记录场景创建者）
ALTER TABLE public.game_scenarios 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. 删除旧的策略
DROP POLICY IF EXISTS "Admins can manage all scenarios" ON public.game_scenarios;

-- 3. 创建新的策略

-- 策略1：所有人可以查看已发布的场景
-- （保留原策略）

-- 策略2：认证用户可以创建场景
CREATE POLICY "Users can create scenarios" ON public.game_scenarios
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 策略3：场景创建者和 admin 可以编辑自己的场景
CREATE POLICY "Owners and admins can update scenarios" ON public.game_scenarios
  FOR UPDATE USING (
    created_by = auth.uid() OR public.is_admin(auth.uid())
  );

-- 策略4：场景创建者和 admin 可以删除自己的场景
CREATE POLICY "Owners and admins can delete scenarios" ON public.game_scenarios
  FOR DELETE USING (
    created_by = auth.uid() OR public.is_admin(auth.uid())
  );

-- 策略5：场景创建者可以查看自己所有的场景（包括未发布的）
CREATE POLICY "Owners can view own scenarios" ON public.game_scenarios
  FOR SELECT USING (
    created_by = auth.uid() OR public.is_admin(auth.uid())
  );

-- 4. 为现有场景设置 created_by（如果没有的话，设为第一个 admin）
UPDATE public.game_scenarios 
SET created_by = (
  SELECT id FROM auth.users 
  WHERE id IN (SELECT id FROM public.profiles WHERE role = 'admin')
  LIMIT 1
)
WHERE created_by IS NULL;

-- 5. 设置默认值（可选：新场景自动关联当前用户）
-- 这个需要在应用层处理，或者使用触发器

-- =============================================
-- 完成！现在普通用户可以：
-- 1. 创建自己的场景
-- 2. 编辑/删除自己创建的场景
-- 3. 发布/下线自己的场景
-- 4. 查看所有已发布的场景
-- =============================================
