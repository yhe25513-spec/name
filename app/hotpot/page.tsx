'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const categories = ['锅底', '佐料', '菜品']

const dishes: Record<string, { name: string; price: number }[]> = {
  '锅底': [
    { name: '清汤(20元)', price: 20 },
    { name: '滋补(40元)', price: 40 },
    { name: '鸳鸯(60元)', price: 60 },
    { name: '红汤(40元)', price: 40 },
  ],
  '佐料': [
    { name: '香菜(10元)', price: 10 },
    { name: '麻酱(20元)', price: 20 },
    { name: '韭菜(20元)', price: 20 },
    { name: '葱(10元)', price: 10 },
    { name: '大蒜(10元)', price: 10 },
  ],
  '菜品': [
    { name: '羊肉(30元)', price: 30 },
    { name: '肥牛(40元)', price: 40 },
    { name: '白菜(10元)', price: 10 },
    { name: '茼蒿(20元)', price: 20 },
    { name: '肥肠(35元)', price: 35 },
  ],
}

const discountRates = [1, 0.9, 0.8]

interface OrderItem {
  id: number
  text: string
  price: number
}

export default function HotpotPage() {
  const router = useRouter()
  const supabase = createClient()
  const [categoryIdx, setCategoryIdx] = useState(0)
  const [dishList, setDishList] = useState(dishes['锅底'])
  const [selectedDish, setSelectedDish] = useState(0)
  const [quantity, setQuantity] = useState('1')
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set())
  const [discount, setDiscount] = useState(1)
  const [totalCost, setTotalCost] = useState(0)
  const [hint, setHint] = useState('饭菜总价: 0元')
  const [hintColor, setHintColor] = useState('black')
  const [customerName, setCustomerName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const nextId = useRef(1)

  const currentCat = categories[categoryIdx]

  const switchCategory = (idx: number) => {
    setCategoryIdx(idx)
    setDishList(dishes[categories[idx]])
    setSelectedDish(0)
  }

  const handleAdd = () => {
    const dish = dishList[selectedDish]
    if (!dish) {
      setHint('请先选中一道菜')
      setHintColor('red')
      return
    }
    const qty = parseInt(quantity) || 1
    const price = dish.price * qty
    const text = `[${currentCat}]${dish.name} X${qty}`
    setOrderItems(prev => [...prev, { id: nextId.current++, text, price }])
    setTotalCost(prev => prev + price)
    setHint(`饭菜总价: ${Math.round((totalCost + price) * discount)}元`)
    setHintColor('black')
  }

  const handleDelete = () => {
    if (selectedOrders.size === 0) {
      setHint('请先在订单中选中要删除的菜')
      setHintColor('red')
      return
    }
    let deducted = 0
    const newItems = orderItems.filter(item => {
      if (selectedOrders.has(item.id)) {
        deducted += item.price
        return false
      }
      return true
    })
    setOrderItems(newItems)
    setTotalCost(prev => prev - deducted)
    setSelectedOrders(new Set())
    setHint(`饭菜总价: ${Math.round((totalCost - deducted) * discount)}元`)
    setHintColor('black')
  }

  const toggleOrder = (id: number) => {
    setSelectedOrders(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const changeDiscount = (rate: number) => {
    setDiscount(rate)
    setHint(`饭菜总价: ${Math.round(totalCost * rate)}元`)
    setHintColor('black')
  }

  const selectDish = (idx: number) => {
    setSelectedDish(idx)
    setQuantity('1')
  }

  const doubleClickAdd = (idx: number) => {
    setSelectedDish(idx)
    setQuantity('1')
    const dish = dishList[idx]
    if (!dish) return
    const qty = 1
    const price = dish.price * qty
    const text = `[${currentCat}]${dish.name} X${qty}`
    setOrderItems(prev => [...prev, { id: nextId.current++, text, price }])
    setTotalCost(prev => prev + price)
    setHint(`饭菜总价: ${Math.round((totalCost + price) * discount)}元`)
    setHintColor('black')
  }

  const handleSubmit = async () => {
    if (orderItems.length === 0) {
      setHint('请先点菜再提交订单')
      setHintColor('red')
      return
    }
    setSubmitting(true)
    const finalCost = Math.round(totalCost * discount)
    const { error } = await supabase.from('hotpot_orders').insert({
      customer_name: customerName.trim() || '匿名顾客',
      items: orderItems.map(item => ({
        text: item.text,
        price: item.price,
      })),
      total_cost: totalCost,
      discount: discount,
      final_cost: finalCost,
      status: 'pending',
    })
    setSubmitting(false)

    if (error) {
      setHint(`提交失败: ${error.message}`)
      setHintColor('red')
      console.error('[Hotpot] submit error:', error)
    } else {
      setSubmitted(true)
      setHint(`下单成功！应付 ${finalCost} 元`)
      setHintColor('green')
    }
  }

  const handleNewOrder = () => {
    setOrderItems([])
    setSelectedOrders(new Set())
    setTotalCost(0)
    setDiscount(1)
    setHint('饭菜总价: 0元')
    setHintColor('black')
    setSubmitted(false)
    setCustomerName('')
  }

  return (
    <div style={{
      fontFamily: '"Segoe UI", "Microsoft YaHei", "黑体", sans-serif',
      backgroundColor: '#f0f0f0',
      minHeight: '100vh',
      color: '#000',
    }}>
      {/* 顶栏返回 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 8px',
        backgroundColor: '#1a56db',
        color: '#fff',
        fontSize: 14,
        gap: 4,
      }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}>
          <ChevronLeft size={20} />
        </button>
        <span>Python火锅店</span>
      </div>

      {/* 蓝色标题横幅 */}
      <div style={{
        backgroundColor: '#1a56db',
        color: '#ff0000',
        textAlign: 'center',
        padding: '12px 16px',
        fontWeight: 'bold',
        fontSize: 20,
        fontFamily: '"黑体", "Microsoft YaHei", sans-serif',
      }}>
        欢迎光临 第五组的Python火锅店
      </div>

      {/* 分类选择 */}
      <div style={{ padding: '8px 12px', backgroundColor: '#fff', borderBottom: '1px solid #ccc' }}>
        <select
          value={categoryIdx}
          onChange={e => switchCategory(parseInt(e.target.value))}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 15,
            border: '1px solid #999',
            borderRadius: 4,
            backgroundColor: '#fff',
            color: '#000',
            appearance: 'auto',
          }}
        >
          {categories.map((cat, idx) => (
            <option key={cat} value={idx}>{cat}</option>
          ))}
        </select>
      </div>

      {/* 主内容区 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        maxWidth: 800,
        margin: '0 auto',
      }}>
        {/* 菜品列表 */}
        <div style={{
          backgroundColor: '#fff',
          borderBottom: '1px solid #ccc',
          padding: 8,
        }}>
          <div style={{
            border: '1px solid #999',
            borderRadius: 2,
            maxHeight: 200,
            overflowY: 'auto',
            backgroundColor: '#fff',
          }}>
            {dishList.map((dish, idx) => (
              <div
                key={dish.name}
                onClick={() => selectDish(idx)}
                onDoubleClick={() => doubleClickAdd(idx)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: 15,
                  color: idx === selectedDish ? '#fff' : '#000',
                  backgroundColor: idx === selectedDish ? '#1a56db' : 'transparent',
                  borderBottom: idx < dishList.length - 1 ? '1px solid #e0e0e0' : 'none',
                  userSelect: 'none',
                }}
              >
                {dish.name}
              </div>
            ))}
          </div>
        </div>

        {/* 操作区 */}
        <div style={{
          backgroundColor: '#fff',
          borderBottom: '1px solid #ccc',
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 14, color: '#000', whiteSpace: 'nowrap' }}>数量:</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              style={{
                width: 80,
                padding: '6px 8px',
                fontSize: 14,
                border: '1px solid #999',
                borderRadius: 2,
                color: '#000',
                backgroundColor: '#fff',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd} style={{
              flex: 1, padding: '8px 0', fontSize: 14, border: '1px solid #666',
              borderRadius: 2, backgroundColor: '#e0e0e0', color: '#000', cursor: 'pointer', fontWeight: 500,
            }}>添加</button>
            <button onClick={handleDelete} style={{
              flex: 1, padding: '8px 0', fontSize: 14, border: '1px solid #666',
              borderRadius: 2, backgroundColor: '#e0e0e0', color: '#000', cursor: 'pointer', fontWeight: 500,
            }}>删除</button>
          </div>

          {/* 折扣 */}
          <div style={{
            border: '1px solid #999', borderRadius: 2, padding: '8px 10px', backgroundColor: '#fafafa',
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#000' }}>价格</div>
            {[
              { label: '普通价', rate: 1 },
              { label: '会员价(九折)', rate: 0.9 },
              { label: 'VIP价(八折)', rate: 0.8 },
            ].map((opt) => (
              <label key={opt.rate} style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#000',
                marginBottom: opt.rate === 0.9 ? 4 : 0, cursor: 'pointer',
              }}>
                <input
                  type="radio" name="discount"
                  checked={discount === opt.rate}
                  onChange={() => changeDiscount(opt.rate)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* 我的餐桌 */}
        <div style={{ backgroundColor: '#fff', padding: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, color: '#000' }}>
            我的餐桌
          </div>
          <div style={{
            border: '1px solid #999', borderRadius: 2, maxHeight: 220, overflowY: 'auto', backgroundColor: '#fff',
          }}>
            {orderItems.length === 0 ? (
              <div style={{ padding: '12px 10px', fontSize: 14, color: '#888' }}>还没有点菜</div>
            ) : (
              orderItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => toggleOrder(item.id)}
                  style={{
                    padding: '8px 10px', cursor: 'pointer', fontSize: 14, color: '#000',
                    backgroundColor: selectedOrders.has(item.id) ? '#d0e0ff' : 'transparent',
                    borderBottom: '1px solid #e0e0e0', userSelect: 'none',
                  }}
                >
                  {item.text}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 已下单提示 */}
      {submitted && (
        <div style={{
          padding: '8px 12px', backgroundColor: '#e8f5e9',
          borderTop: '1px solid #ccc', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#2e7d32',
        }}>
          <CheckCircle size={16} />
          订单已提交，等待确认
        </div>
      )}

      {/* 顾客姓名 + 提交订单 */}
      <div style={{
        backgroundColor: '#fff', padding: '8px 12px',
        borderTop: '1px solid #ccc', display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <input
          placeholder="顾客姓名（选填）"
          value={customerName}
          onChange={e => setCustomerName(e.target.value)}
          disabled={submitted}
          style={{
            flex: 1, padding: '8px 10px', fontSize: 14, border: '1px solid #999',
            borderRadius: 2, color: '#000', backgroundColor: submitted ? '#f0f0f0' : '#fff',
          }}
        />
        {submitted ? (
          <button onClick={handleNewOrder} style={{
            padding: '8px 16px', fontSize: 14, border: '1px solid #4caf50',
            borderRadius: 2, backgroundColor: '#4caf50', color: '#fff', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap',
          }}>
            再来一单
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting} style={{
            padding: '8px 16px', fontSize: 14, border: '1px solid #1a56db',
            borderRadius: 2, backgroundColor: '#1a56db', color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer',
            fontWeight: 500, whiteSpace: 'nowrap', opacity: submitting ? 0.7 : 1,
          }}>
            {submitting ? '提交中...' : '提交订单'}
          </button>
        )}
      </div>

      {/* 底部提示 */}
      <div style={{
        padding: '8px 12px', backgroundColor: '#fff',
        borderTop: '1px solid #ccc', fontSize: 15, color: hintColor, fontWeight: 500,
      }}>
        {hint}
      </div>
    </div>
  )
}
