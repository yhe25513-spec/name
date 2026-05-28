'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, CookingPot, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react'

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: '待确认', color: 'bg-amber-500' },
  confirmed: { label: '已确认', color: 'bg-blue-500' },
  done: { label: '已完成', color: 'bg-green-500' },
  cancelled: { label: '已取消', color: 'bg-zinc-500' },
}

interface Order {
  id: string
  customer_name: string
  items: { text: string; price: number }[]
  total_cost: number
  discount: number
  final_cost: number
  status: string
  created_at: string
}

export function HotpotOrdersTab() {
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadOrders()
  }, [])

  const loadOrders = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('hotpot_orders')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[HotpotOrdersTab] load error:', error)
    } else {
      setOrders(data || [])
    }
    setLoading(false)
  }

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('hotpot_orders')
      .update({ status })
      .eq('id', id)
    if (error) {
      console.error('[HotpotOrdersTab] update error:', error)
    } else {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    }
  }

  const filtered = search
    ? orders.filter(o =>
        o.customer_name.includes(search) ||
        o.items.some(i => i.text.includes(search))
      )
    : orders

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <CookingPot className="w-5 h-5 text-orange-400" />
          <h2 className="text-lg font-bold text-white">火锅订单</h2>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="搜索顾客或菜品..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 bg-zinc-900 border-zinc-700 text-white text-sm"
          />
        </div>
        <Button variant="outline" size="sm" onClick={loadOrders}
          className="border-zinc-700 text-zinc-400 hover:text-white">
          <Loader2 className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-zinc-500 text-sm">
          {search ? '没有匹配的订单' : '暂无订单数据'}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(order => (
            <Card key={order.id} className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm text-white">{order.customer_name}</CardTitle>
                    <Badge className={`${statusLabels[order.status]?.color || 'bg-zinc-500'} text-white text-xs`}>
                      {statusLabels[order.status]?.label || order.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-zinc-500">
                    <Clock className="w-3 h-3" />
                    {new Date(order.created_at).toLocaleString('zh-CN', {
                      month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                <ScrollArea className="max-h-32">
                  <div className="space-y-1">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-zinc-400">
                        <span>{item.text}</span>
                        <span className="text-zinc-300">{item.price}元</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800">
                  <div className="text-xs text-zinc-500">
                    总价 {order.total_cost}元 × {order.discount === 1 ? '无折扣' : `${Math.round((1 - order.discount) * 100)}%off`}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-orange-400">{order.final_cost}元</span>
                    {order.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost"
                          onClick={() => updateStatus(order.id, 'confirmed')}
                          className="h-7 px-2 text-green-400 hover:text-green-300 hover:bg-green-950/30">
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          确认
                        </Button>
                        <Button size="sm" variant="ghost"
                          onClick={() => updateStatus(order.id, 'cancelled')}
                          className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-950/30">
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          取消
                        </Button>
                      </div>
                    )}
                    {order.status === 'confirmed' && (
                      <Button size="sm" variant="ghost"
                        onClick={() => updateStatus(order.id, 'done')}
                        className="h-7 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-950/30">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                        完成
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 统计 */}
      {!loading && orders.length > 0 && (
        <div className="flex gap-3 text-xs text-zinc-500 pt-2">
          <span>总计: {orders.length} 单</span>
          <span>待确认: {orders.filter(o => o.status === 'pending').length}</span>
          <span>已完成: {orders.filter(o => o.status === 'done').length}</span>
        </div>
      )}
    </div>
  )
}
