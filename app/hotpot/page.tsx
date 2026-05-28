'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Minus, Sparkles } from 'lucide-react'

const categories = ['锅底', '佐料', '菜品']

const dishes: Record<string, { name: string; price: number }[]> = {
  '锅底': [
    { name: '清汤', price: 20 },
    { name: '滋补', price: 40 },
    { name: '鸳鸯', price: 60 },
    { name: '红汤', price: 40 },
  ],
  '佐料': [
    { name: '香菜', price: 10 },
    { name: '麻酱', price: 20 },
    { name: '韭菜', price: 20 },
    { name: '葱', price: 10 },
    { name: '大蒜', price: 10 },
  ],
  '菜品': [
    { name: '羊肉', price: 30 },
    { name: '肥牛', price: 40 },
    { name: '白菜', price: 10 },
    { name: '茼蒿', price: 20 },
    { name: '肥肠', price: 35 },
  ],
}

const discounts = [
  { label: '普通价', rate: 1 },
  { label: '会员价（九折）', rate: 0.9 },
  { label: 'VIP价（八折）', rate: 0.8 },
]

interface OrderItem {
  id: number
  category: string
  dish: string
  price: number
  quantity: number
}

export default function HotpotPage() {
  const router = useRouter()
  const [category, setCategory] = useState('锅底')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [order, setOrder] = useState<OrderItem[]>([])
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set())
  const [discountIdx, setDiscountIdx] = useState(0)
  const [hint, setHint] = useState<{ text: string; color: string }>({ text: '', color: '' })

  const discount = discounts[discountIdx].rate
  const totalCost = order.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const finalCost = Math.round(totalCost * discount)

  const currentDishes = dishes[category]
  let nextId = order.length > 0 ? Math.max(...order.map(o => o.id)) + 1 : 1

  const getQty = useCallback(
    (dishName: string) => quantities[dishName] ?? 1,
    [quantities]
  )

  const setQty = useCallback((dishName: string, val: number) => {
    setQuantities(prev => ({ ...prev, [dishName]: Math.max(1, Math.min(1000, val)) }))
  }, [])

  const handleAdd = () => {
    setHint({ text: '', color: '' })
    const dish = currentDishes.find(d => d.name === category)
    if (!dish) {
      setHint({ text: '请先选择一道菜', color: 'red' })
      return
    }
    // 如果 currentDishes 没有选中逻辑，默认选中第一个
    setOrder(prev => [
      ...prev,
      {
        id: nextId++,
        category,
        dish: currentDishes[0].name,
        price: currentDishes[0].price,
        quantity: getQty(currentDishes[0].name),
      },
    ])
  }

  const handleDelete = () => {
    if (selectedOrderIds.size === 0) {
      setHint({ text: '请先在订单中勾选要删除的菜品', color: 'red' })
      return
    }
    setOrder(prev => prev.filter(item => !selectedOrderIds.has(item.id)))
    setSelectedOrderIds(new Set())
    setHint({ text: '', color: '' })
  }

  const toggleOrderSelect = (id: number) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="min-h-screen flex flex-col" style={{
      backgroundColor: '#010102',
      color: '#f7f8f8',
      '--bg-primary': '#010102',
      '--bg-secondary': '#0f1011',
      '--bg-card': '#141516',
      '--text-primary': '#f7f8f8',
      '--text-secondary': '#d0d6e0',
      '--text-muted': '#8a8f98',
      '--accent': '#e85d3a',
      '--accent-soft': 'rgba(232,93,58,0.12)',
      '--border': '#23252a',
    } as React.CSSProperties}>
      {/* 纯色背景 */}
      <div className="fixed inset-0 pointer-events-none bg-[#010102]" />

      {/* 顶栏 */}
      <header className="relative border-b border-[var(--border)] bg-[var(--bg-secondary)]/80 backdrop-blur-sm z-20">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid var(--accent)' }}>
              <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
            </div>
            <span className="font-medium text-[var(--text-primary)]">Python火锅店</span>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="relative flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
          {/* 欢迎横幅 */}
          <div className="text-center py-4 px-4 rounded-xl border" style={{
            backgroundColor: 'var(--accent-soft)',
            borderColor: 'var(--accent)',
          }}>
            <p className="text-sm" style={{ color: 'var(--accent)' }}>
              欢迎光临 Python火锅店 🔥
            </p>
          </div>

          {/* 分类标签 */}
          <div className="flex gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  backgroundColor: category === cat ? 'var(--accent)' : 'var(--bg-card)',
                  color: category === cat ? '#fff' : 'var(--text-secondary)',
                  border: category === cat ? '1px solid var(--accent)' : '1px solid var(--border)',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* 菜品列表 */}
          <div className="rounded-xl border border-[var(--border)] overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
            {currentDishes.map((dish, idx) => (
              <div
                key={dish.name}
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: idx < currentDishes.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-[var(--text-primary)]">{dish.name}</span>
                  <span className="ml-2 text-xs" style={{ color: 'var(--accent)' }}>{dish.price}元</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setQty(dish.name, getQty(dish.name) - 1)}
                    className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 text-center text-sm tabular-nums text-[var(--text-primary)]">
                    {getQty(dish.name)}
                  </span>
                  <button
                    onClick={() => setQty(dish.name, getQty(dish.name) + 1)}
                    className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => {
                      setOrder(prev => [
                        ...prev,
                        { id: nextId++, category, dish: dish.name, price: dish.price, quantity: getQty(dish.name) },
                      ])
                      setHint({ text: '', color: '' })
                    }}
                    className="ml-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: '#fff',
                    }}
                  >
                    添加
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 已点菜单 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-[var(--text-secondary)]">
                我的餐桌 <span className="text-[var(--text-muted)]">（{order.length} 项）</span>
              </h3>
              {order.length > 0 && (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all"
                  style={{
                    color: '#ef4444',
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.2)',
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                  删除选中
                </button>
              )}
            </div>

            {order.length === 0 ? (
              <div className="text-center py-8 rounded-xl border border-dashed border-[var(--border)]" style={{ backgroundColor: 'var(--bg-card)' }}>
                <p className="text-xs text-[var(--text-muted)]">还没有点菜，快去点单吧</p>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border)] overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
                {order.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggleOrderSelect(item.id)}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                    style={{
                      borderBottom: '1px solid var(--border)',
                      backgroundColor: selectedOrderIds.has(item.id) ? 'var(--accent-soft)' : 'transparent',
                    }}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0`}
                      style={{
                        borderColor: selectedOrderIds.has(item.id) ? 'var(--accent)' : 'var(--border)',
                        backgroundColor: selectedOrderIds.has(item.id) ? 'var(--accent)' : 'transparent',
                      }}
                    >
                      {selectedOrderIds.has(item.id) && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                      {item.category}
                    </span>
                    <span className="text-sm text-[var(--text-primary)] flex-1">{item.dish}</span>
                    <span className="text-xs text-[var(--text-muted)]">x{item.quantity}</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>{item.price * item.quantity}元</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 提示信息 */}
          {hint.text && (
            <p className="text-xs text-center" style={{ color: hint.color }}>{hint.text}</p>
          )}

          {/* 价格与折扣 */}
          <div className="rounded-xl border border-[var(--border)] p-4 space-y-3" style={{ backgroundColor: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-muted)]">菜品总价</span>
              <span className="text-sm text-[var(--text-primary)]">{totalCost}元</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-muted)]">折扣</span>
              <span className="text-sm" style={{ color: 'var(--accent)' }}>
                {discountIdx === 0 ? '无' : `${Math.round((1 - discount) * 100)}% OFF`}
              </span>
            </div>
            <div className="border-t border-[var(--border)] pt-3 flex items-center justify-between">
              <span className="text-base font-medium text-[var(--text-primary)]">应付金额</span>
              <span className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{finalCost}元</span>
            </div>

            <div className="pt-2 space-y-2">
              <p className="text-xs text-[var(--text-muted)]">选择优惠：</p>
              <div className="flex gap-2">
                {discounts.map((d, idx) => (
                  <button
                    key={d.label}
                    onClick={() => setDiscountIdx(idx)}
                    className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      backgroundColor: discountIdx === idx ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: discountIdx === idx ? '#fff' : 'var(--text-muted)',
                      border: `1px solid ${discountIdx === idx ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 底部留白 */}
          <div className="h-8" />
        </div>
      </main>
    </div>
  )
}
