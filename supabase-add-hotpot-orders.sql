-- 火锅店订单表
-- 在 Supabase Dashboard > SQL Editor 中执行
CREATE TABLE IF NOT EXISTS public.hotpot_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL DEFAULT '匿名顾客',
  items JSONB NOT NULL DEFAULT '[]',
  total_cost INT NOT NULL DEFAULT 0,
  discount FLOAT NOT NULL DEFAULT 1,
  final_cost INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'done', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.hotpot_orders ENABLE ROW LEVEL SECURITY;

-- 允许任何人下单（不需要登录）
CREATE POLICY "Anyone can insert orders" ON public.hotpot_orders
  FOR INSERT WITH CHECK (true);

-- 只有管理员可以查看所有订单
CREATE POLICY "Admins can view all orders" ON public.hotpot_orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 管理员可以更新订单状态
CREATE POLICY "Admins can update orders" ON public.hotpot_orders
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
