-- =============================================
-- 更新：允许普通用户创建和发布游戏场景
-- 在 Supabase Dashboard > SQL Editor 中执行
-- =============================================

-- 1. 添加 created_by 字段（记录场景创建者）
ALTER TABLE public.game_scenarios 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. 删除旧的策略
DROP POLICY IF EXISTS "Admins can manage all scenarios" ON public.game_scenarios;
DROP POLICY IF EXISTS "Anyone can view published scenarios" ON public.game_scenarios;
DROP POLICY IF EXISTS "Owners can view own scenarios" ON public.game_scenarios;

-- 3. 创建新的策略

-- 策略1：所有人（包括未登录用户）可以查看已发布的场景
CREATE POLICY "Anyone can view published scenarios" ON public.game_scenarios
  FOR SELECT USING (is_published = TRUE);

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

-- 策略5：场景创建者可以查看自己所有的场景（包括未发布的），admin 可看所有
CREATE POLICY "Owners can view own scenarios" ON public.game_scenarios
  FOR SELECT USING (
    created_by = auth.uid() OR public.is_admin(auth.uid())
  );
-- 注意：与"Anyone can view published scenarios"策略叠加，用户可以看到：
-- 1. 所有 is_published = TRUE 的场景（策略1）
-- 2. 自己创建的所有场景（策略5）
-- 3. admin 可看所有场景（策略5）

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
